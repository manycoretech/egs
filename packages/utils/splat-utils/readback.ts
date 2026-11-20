import { type SourceTexture, type Splat, TextureFormat, __INTERNAL__ } from '@qunhe/egs';

const READBACK_BYTES = 16 * 1024 * 1024;

export async function readbackStream(splat: Splat, renderer: __INTERNAL__.IRenderer): Promise<void> {
    for (const texture of splat.extrasTex) {
        const image = texture.format === TextureFormat.Rgba8Unorm;
        if (texture.getLevelLayerSource(0, image ? 0 : undefined)) {
            continue;
        }
        const device = renderer.gpuDevice;
        if (!device) {
            throw new Error('Splat readback requires an initialized renderer.');
        }
        const handle = renderer.getGPUTextureHandle(texture);
        const pixels = image ? new Uint8Array(texture.byteSize) : new Uint32Array(texture.byteSize / 4);
        if ('queue' in device) {
            await readWebGPU(device, handle as GPUTexture, new Uint8Array(pixels.buffer));
        } else if (device instanceof WebGL2RenderingContext) {
            await readWebGL(device, handle as WebGLTexture, texture, pixels);
        } else {
            throw new Error('Splat readback requires WebGL2 or WebGPU.');
        }
        if (image) {
            const data = new ImageData(new Uint8ClampedArray(pixels.buffer), texture.width, texture.height);
            const bitmap = await createImageBitmap(data, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
            texture.setLevelLayerData(bitmap, 0, 0);
        } else {
            texture.setLevelData(pixels, 0);
        }
        texture.assumeUploaded();
    }
}

async function readWebGPU(device: GPUDevice, texture: GPUTexture, target: Uint8Array) {
    const { width, height } = texture;
    const rowBytes = target.byteLength / height;
    const bytesPerRow = Math.ceil(rowBytes / 256) * 256;
    const rows = Math.min(height, Math.max(1, Math.floor(READBACK_BYTES / bytesPerRow)));
    const buffer = device.createBuffer({
        size: bytesPerRow * rows,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    try {
        for (let y = 0; y < height; y += rows) {
            const count = Math.min(rows, height - y);
            const encoder = device.createCommandEncoder();
            encoder.copyTextureToBuffer({ texture, origin: [0, y] }, { buffer, bytesPerRow }, [width, count]);
            device.queue.submit([encoder.finish()]);
            await buffer.mapAsync(GPUMapMode.READ);
            const bytes = new Uint8Array(buffer.getMappedRange());
            if (rowBytes === bytesPerRow) {
                target.set(bytes.subarray(0, rowBytes * count), y * rowBytes);
            } else {
                for (let row = 0; row < count; row++) {
                    target.set(bytes.subarray(row * bytesPerRow, row * bytesPerRow + rowBytes), (y + row) * rowBytes);
                }
            }
            buffer.unmap();
        }
    } finally {
        buffer.destroy();
    }
}

async function readWebGL(
    gl: WebGL2RenderingContext,
    handle: WebGLTexture,
    texture: SourceTexture,
    target: Uint8Array | Uint32Array,
) {
    await __INTERNAL__.waitForWebGL(gl);
    const { width, height } = texture;
    const integer = target instanceof Uint32Array;
    const framebuffer = gl.createFramebuffer();
    const previous = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
    const packBuffer = gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING);
    const pack = [gl.PACK_ALIGNMENT, gl.PACK_ROW_LENGTH, gl.PACK_SKIP_PIXELS, gl.PACK_SKIP_ROWS];
    const values = pack.map(key => gl.getParameter(key));
    try {
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, handle, 0);
        if (gl.checkFramebufferStatus(gl.READ_FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error('Incomplete framebuffer for splat readback.');
        }
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
        pack.forEach((key, index) => gl.pixelStorei(key, index === 0 ? 4 : 0));
        if (texture.format !== TextureFormat.Rg32Uint) {
            gl.readPixels(
                0,
                0,
                width,
                height,
                integer ? gl.RGBA_INTEGER : gl.RGBA,
                integer ? gl.UNSIGNED_INT : gl.UNSIGNED_BYTE,
                target,
            );
            return;
        }
        const rows = Math.min(height, Math.max(1, Math.floor(READBACK_BYTES / (width * 16))));
        const rgba = new Uint32Array(width * rows * 4);
        for (let y = 0; y < height; y += rows) {
            const count = Math.min(rows, height - y);
            gl.readPixels(0, y, width, count, gl.RGBA_INTEGER, gl.UNSIGNED_INT, rgba);
            let destination = y * width * 2;
            for (let source = 0; source < width * count * 4; source += 4) {
                target[destination++] = rgba[source];
                target[destination++] = rgba[source + 1];
            }
        }
    } finally {
        pack.forEach((key, index) => gl.pixelStorei(key, values[index]));
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, packBuffer);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, previous);
        gl.deleteFramebuffer(framebuffer);
    }
}
