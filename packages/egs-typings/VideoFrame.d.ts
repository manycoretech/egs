/* eslint-disable */

declare global {
    // current not using just a placeholder
    interface VideoFrame {
        displayWidth: number;
        displayHeight: number;
    }

    interface VideoFrameConstructor {
        readonly prototype: VideoFrame;
        new(): never;
    }

    var VideoFrame: VideoFrameConstructor;

    type CanvasImageSource2 = HTMLOrSVGImageElement | HTMLVideoElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas | VideoFrame;

    interface CanvasDrawImage {
        drawImage(image: CanvasImageSource2, dx: number, dy: number): void;
        drawImage(image: CanvasImageSource2, dx: number, dy: number, dw: number, dh: number): void;
        drawImage(image: CanvasImageSource2, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void;
    }

    type TexImageSource2 = ImageBitmap | ImageData | HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | OffscreenCanvas | VideoFrame;
    interface WebGL2RenderingContextOverloads {
        texImage2D(target: GLenum, level: GLint, internalformat: GLint, format: GLenum, type: GLenum, source: TexImageSource2): void;
    }
}

export { };
