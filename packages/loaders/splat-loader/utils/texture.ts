let MAX_TEXTURE_SIZE: number;
export function getMaxTextureSize(): number {
    if (MAX_TEXTURE_SIZE !== undefined) {
        return MAX_TEXTURE_SIZE;
    }
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { stencil: false, depth: false });
    if (!gl) {
        throw new Error('WebGL2 not supported!');
    }
    MAX_TEXTURE_SIZE = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return MAX_TEXTURE_SIZE;
}

export function computeTextureSize(counts: number, maxTextureSize: number): { w: number; h: number; d: number } {
    if (counts === 0) {
        return { w: 0, h: 0, d: 0 };
    }
    const width = Math.min(2 ** Math.ceil(Math.log2(Math.sqrt(counts))), maxTextureSize);
    const height = Math.min(Math.ceil(counts / width), maxTextureSize);
    const depth = Math.ceil(counts / (width * height));
    return { w: width, h: height, d: depth };
}

let context: OffscreenCanvasRenderingContext2D | null = null;
export async function decodeImage(fileBytes: Uint8Array<ArrayBuffer>) {
    context ??= new OffscreenCanvas(1, 1).getContext('2d', { willReadFrequently: true });
    if (!context) {
        throw new Error('Failed to create context');
    }

    const bitmap = await createImageBitmap(new Blob([fileBytes]), {
        premultiplyAlpha: 'none',
    });
    const { width, height } = bitmap;
    const { canvas } = context;
    canvas.width = width;
    canvas.height = height;

    context.drawImage(bitmap, 0, 0, width, height);

    const data = context.getImageData(0, 0, width, height);
    return {
        data: new Uint8Array(data.data.buffer, data.data.byteOffset, data.data.length),
        width,
        height,
    };
}
