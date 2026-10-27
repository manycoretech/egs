import {
    TextureFormat,
    TextureDimension,
    TextureViewDimension,
    type Splat,
    SourceTexture,
    __INTERNAL__,
} from '@qunhe/egs';
import { SPLAT_STREAM_CHUNK_BYTES, type SplatData, type SogSplatData } from '@qunhe/egs-splat-loader';

type Renderer = __INTERNAL__.IRenderer;

function pixelSize(texture: SourceTexture) {
    return texture.format === TextureFormat.Rg32Uint ? 8 : texture.format === TextureFormat.Rgba32Uint ? 16 : 4;
}

function textureRanges(
    texture: SourceTexture,
    offset: number,
    source: Uint8Array,
    write: (x: number, y: number, width: number, height: number, bytes: Uint8Array) => void,
) {
    const stride = pixelSize(texture);
    if (offset + source.byteLength > texture.width * texture.height * stride) {
        throw new RangeError('Invalid splat texture range.');
    }
    let pixel = offset / stride;
    for (let start = 0; start < source.byteLength;) {
        const x = pixel % texture.width;
        const remaining = (source.byteLength - start) / stride;
        const width = Math.min(texture.width - x, remaining);
        const height = x === 0 && width === texture.width ? Math.floor(remaining / width) : 1;
        const size = width * height * stride;
        write(x, Math.floor(pixel / texture.width), width, height, source.subarray(start, start + size));
        start += size;
        pixel += width * height;
    }
}

function withUnpackState(gl: WebGL2RenderingContext, write: () => void) {
    const binding = gl.getParameter(gl.TEXTURE_BINDING_2D);
    const buffer = gl.getParameter(gl.PIXEL_UNPACK_BUFFER_BINDING);
    const keys = [
        gl.UNPACK_ALIGNMENT,
        gl.UNPACK_ROW_LENGTH,
        gl.UNPACK_SKIP_PIXELS,
        gl.UNPACK_SKIP_ROWS,
        gl.UNPACK_FLIP_Y_WEBGL,
        gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,
    ];
    const values = keys.map(key => gl.getParameter(key));
    try {
        gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null);
        keys.forEach((key, index) => gl.pixelStorei(key, index === 0 ? 4 : 0));
        write();
    } finally {
        keys.forEach((key, index) => gl.pixelStorei(key, values[index]));
        gl.bindTexture(gl.TEXTURE_2D, binding);
        gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, buffer);
    }
}

function readTexture(gl: WebGL2RenderingContext, texture: SourceTexture, instance: WebGLTexture) {
    const framebuffer = gl.createFramebuffer();
    const previous = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
    const packBuffer = gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING);
    const keys = [gl.PACK_ALIGNMENT, gl.PACK_ROW_LENGTH, gl.PACK_SKIP_PIXELS, gl.PACK_SKIP_ROWS];
    const values = keys.map(key => gl.getParameter(key));
    const integer = texture.format !== TextureFormat.Rgba8Unorm;
    const result = integer
        ? new Uint32Array(texture.width * texture.height * 4)
        : new Uint8Array(texture.width * texture.height * 4);
    try {
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, instance, 0);
        if (gl.checkFramebufferStatus(gl.READ_FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error('Splat readback framebuffer is incomplete.');
        }
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
        keys.forEach((key, index) => gl.pixelStorei(key, index === 0 ? 4 : 0));
        gl.readPixels(
            0,
            0,
            texture.width,
            texture.height,
            integer ? gl.RGBA_INTEGER : gl.RGBA,
            integer ? gl.UNSIGNED_INT : gl.UNSIGNED_BYTE,
            result,
        );
        if (texture.format !== TextureFormat.Rg32Uint) {
            return result;
        }
        const packed = new Uint32Array(result.length / 2);
        for (let i = 0; i < packed.length; i += 2) {
            packed[i] = result[i * 2];
            packed[i + 1] = result[i * 2 + 1];
        }
        return packed;
    } finally {
        keys.forEach((key, index) => gl.pixelStorei(key, values[index]));
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, packBuffer);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, previous);
        gl.deleteFramebuffer(framebuffer);
    }
}

async function readTextureWebGPU(
    device: GPUDevice,
    texture: SourceTexture,
    instance: GPUTexture,
    validate: () => void,
) {
    const rowBytes = texture.width * pixelSize(texture);
    const bytesPerRow = Math.ceil(rowBytes / 256) * 256;
    const rows = Math.min(texture.height, Math.max(1, Math.floor(SPLAT_STREAM_CHUNK_BYTES / bytesPerRow)));
    const result =
        texture.format === TextureFormat.Rgba8Unorm
            ? new Uint8Array(rowBytes * texture.height)
            : new Uint32Array((rowBytes * texture.height) / 4);
    const bytes = new Uint8Array(result.buffer);
    const staging = device.createBuffer({
        size: rows * bytesPerRow,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    try {
        for (let y = 0; y < texture.height; y += rows) {
            validate();
            const height = Math.min(rows, texture.height - y);
            const size = height * bytesPerRow;
            const encoder = device.createCommandEncoder();
            encoder.copyTextureToBuffer(
                { texture: instance, origin: { y } },
                { buffer: staging, bytesPerRow },
                { width: texture.width, height },
            );
            device.queue.submit([encoder.finish()]);
            await staging.mapAsync(GPUMapMode.READ, 0, size);
            const mapped = new Uint8Array(staging.getMappedRange(0, size));
            for (let row = 0; row < height; row++) {
                bytes.set(mapped.subarray(row * bytesPerRow, row * bytesPerRow + rowBytes), (y + row) * rowBytes);
            }
            staging.unmap();
        }
        return result;
    } finally {
        staging.destroy();
    }
}

/** SOG keeps its image representation; only the current encoded image is assembled on the consumer. */
export async function createStreamingSog(data: SogSplatData, renderer: Renderer): Promise<Splat> {
    const context = renderer.gpuDevice!;
    const textures: SourceTexture[] = [];
    let imageBytes: Uint8Array | undefined;
    try {
        await data.readChunks(async chunk => {
            data.signal?.throwIfAborted();
            for (const { index, offset, source } of chunk.samplers) {
                // The existing SOG renderer consumes the five base images.
                if (index >= 5) {
                    continue;
                }
                if (!offset) {
                    imageBytes = new Uint8Array(data.byteLengths[index]);
                }
                imageBytes!.set(source, offset);
                if (offset + source.byteLength !== imageBytes!.byteLength) {
                    continue;
                }
                const image = await createImageBitmap(new Blob([imageBytes! as Uint8Array<ArrayBuffer>]), {
                    premultiplyAlpha: 'none',
                    colorSpaceConversion: 'none',
                });
                imageBytes = undefined;
                try {
                    const texture = new SourceTexture(
                        TextureDimension.D2,
                        TextureViewDimension.D2,
                        TextureFormat.Rgba8Unorm,
                        image.width,
                        image.height,
                        1,
                        false,
                        false,
                    ).configAsDataTexture();
                    textures.push(texture);
                    const instance = renderer.getGPUTextureHandle(texture);
                    if ('queue' in context) {
                        context.queue.copyExternalImageToTexture(
                            { source: image },
                            { texture: instance as GPUTexture },
                            [image.width, image.height],
                        );
                    } else if (context instanceof WebGL2RenderingContext) {
                        withUnpackState(context, () => {
                            context.bindTexture(context.TEXTURE_2D, instance);
                            context.texSubImage2D(
                                context.TEXTURE_2D,
                                0,
                                0,
                                0,
                                context.RGBA,
                                context.UNSIGNED_BYTE,
                                image,
                            );
                        });
                    } else {
                        throw new Error('SOG streaming requires WebGL2.');
                    }
                } finally {
                    image.close();
                }
            }
        });
        if ('queue' in context) {
            await context.queue.onSubmittedWorkDone();
        }
        data.signal?.throwIfAborted();
        if (renderer.gpuDevice !== context || (!('queue' in context) && context.isContextLost())) {
            throw new Error('Splat context was lost.');
        }
        const [meansL, meansU, scales, quats, color] = textures;
        const splat = new __INTERNAL__.SogSplat(data.serialize().extras![0], meansL, meansU, quats, scales, color);
        splat.setStreamSource(createTextureSource(splat.extrasTex, renderer));
        return splat;
    } catch (error) {
        data.cancel(error);
        textures.forEach(texture => texture.freeGPU());
        throw error;
    }
}

function clearTextures(gl: WebGL2RenderingContext, instances: WebGLTexture[]) {
    // Initialize entire targets on the GPU before their first partial upload.
    const framebuffer = gl.createFramebuffer();
    const drawBinding = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING);
    const scissor = gl.isEnabled(gl.SCISSOR_TEST);
    const mask = gl.getParameter(gl.COLOR_WRITEMASK);
    try {
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, framebuffer);
        gl.disable(gl.SCISSOR_TEST);
        gl.colorMask(true, true, true, true);
        const zero = new Uint32Array(4);
        for (const instance of instances) {
            gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, instance, 0);
            gl.clearBufferuiv(gl.COLOR, 0, zero);
            gl.flush();
        }
    } finally {
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, drawBinding);
        gl.deleteFramebuffer(framebuffer);
        if (scissor) {
            gl.enable(gl.SCISSOR_TEST);
        }
        gl.colorMask(mask[0], mask[1], mask[2], mask[3]);
    }
}

function createTextureSource(textures: SourceTexture[], renderer: Renderer) {
    const context = renderer.gpuDevice!;
    if (!('queue' in context) && !(context instanceof WebGL2RenderingContext)) {
        throw new Error('Splat streaming requires WebGL2 or WebGPU.');
    }
    const instances = textures.map(texture => renderer.getGPUTextureHandle(texture));
    const validate = () => {
        if (renderer.gpuDevice !== context || (!('queue' in context) && context.isContextLost())) {
            throw new Error('Splat context was lost.');
        }
        textures.forEach((texture, index) => {
            if (renderer.getGPUTextureHandle(texture) !== instances[index]) {
                throw new Error('Splat source was released.');
            }
        });
    };
    return {
        validate,
        async upload(ranges: readonly { index: number; offset: number; source: Uint8Array }[]) {
            validate();
            if ('queue' in context) {
                for (const { index, offset, source } of ranges) {
                    const texture = textures[index];
                    textureRanges(texture, offset, source, (x, y, width, height, bytes) => {
                        context.queue.writeTexture(
                            { texture: instances[index] as GPUTexture, origin: { x, y } },
                            bytes as Uint8Array<ArrayBuffer>,
                            { bytesPerRow: width * pixelSize(texture) },
                            { width, height },
                        );
                    });
                }
                await context.queue.onSubmittedWorkDone();
                return;
            }
            const gl = context;
            const buffer = gl.createBuffer();
            let size = 0;
            const offsets = ranges.map(({ source }) => {
                const offset = Math.ceil(size / 16) * 16;
                size = offset + source.byteLength;
                return offset;
            });
            try {
                withUnpackState(gl, () => {
                    gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, buffer);
                    gl.bufferData(gl.PIXEL_UNPACK_BUFFER, size, gl.STREAM_DRAW);
                    ranges.forEach(({ source }, index) =>
                        gl.bufferSubData(gl.PIXEL_UNPACK_BUFFER, offsets[index], source),
                    );
                    for (let range = 0; range < ranges.length; range++) {
                        const { index, offset, source } = ranges[range];
                        const texture = textures[index];
                        gl.bindTexture(gl.TEXTURE_2D, instances[index]);
                        textureRanges(texture, offset, source, (x, y, width, height, bytes) => {
                            gl.texSubImage2D(
                                gl.TEXTURE_2D,
                                0,
                                x,
                                y,
                                width,
                                height,
                                texture.glFormat.external(renderer.backend),
                                texture.glFormat.dataType(renderer.backend),
                                offsets[range] + bytes.byteOffset - source.byteOffset,
                            );
                        });
                    }
                });
                await __INTERNAL__.waitForWebGL(gl);
            } finally {
                gl.deleteBuffer(buffer);
            }
        },
        async readback() {
            const sources: (Uint8Array | Uint32Array)[] = [];
            for (let index = 0; index < textures.length; index++) {
                validate();
                sources.push(
                    'queue' in context
                        ? await readTextureWebGPU(context, textures[index], instances[index] as GPUTexture, validate)
                        : readTexture(context, textures[index], instances[index] as WebGLTexture),
                );
            }
            return sources;
        },
    };
}

/** Consume encoded blocks directly into the Splat's source textures. */
export async function uploadSplatData(splat: Splat, data: SplatData, renderer: Renderer) {
    data.signal?.throwIfAborted();
    if (!splat.counts) {
        await data.collect();
        return;
    }
    const source = createTextureSource(splat.extrasTex, renderer);
    const context = renderer.gpuDevice!;
    if (context instanceof WebGL2RenderingContext) {
        clearTextures(
            context,
            splat.extrasTex.map(texture => renderer.getGPUTextureHandle(texture)),
        );
    }
    splat.setStreamSource(source);
    await data.readChunks(async chunk => {
        data.signal?.throwIfAborted();
        await source.upload(chunk.samplers);
    }, true);
    data.signal?.throwIfAborted();
}
