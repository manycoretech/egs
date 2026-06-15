import { _Math } from '../../math/Math';
import { logger } from '../../utils/Logger';
import { WebGLPixelFormat } from '../../renderer/webgl/WGLConstants';
import { TextureDataType } from '../../utils/Constants';
import type { Deserializer, Serializer } from '../../utils/Serialization';
import { type TypedArray, singleton } from '../../utils/Utils';
import {
    getFormatByteSize,
    LegacySourceTexture,
    type SourceTextureLayerWebGLUploadResult,
    type SourceTextureWebGLUploadResult,
    TextureMipmapGroup,
    type WebGLTextureUploadCtx,
    createImgByUrl,
    getInternalFormat,
    type WebGLUploadable,
} from './Texture';
import { ContentBridge } from '../../ContentAPI';
import { TextureDimension, TextureViewDimension } from './types';

function getDataUrl(canvas: HTMLCanvasElement): string {
    if (canvas.width > 2048 || canvas.height > 2048) {
        return canvas.toDataURL('image/jpeg', 0.6);
    } else {
        return canvas.toDataURL('image/png');
    }
}

/**
 * Base upload layer for 2D textures.
 */
export abstract class Texture2DLayer implements WebGLUploadable {
    __brand: 'WebGLUploadable';

    width: number = 2;
    height: number = 2;

    setWidth(width: number) {
        this.width = width;
        return this;
    }
    setHeight(height: number) {
        this.height = height;
        return this;
    }
    setSize(width: number, height: number) {
        return this.setWidth(width).setHeight(height);
    }

    /**
     * @internal
     */
    abstract uploadWebGL(
        ctx: WebGLTextureUploadCtx,
        target: number,
        level: number,
        needPOT: boolean,
    ): SourceTextureLayerWebGLUploadResult;
}

const MAX_TEXTURE_SIZE = 8192;

function isVideoFrame(source: any): source is VideoFrame {
    return typeof globalThis.VideoFrame !== 'undefined' && source instanceof globalThis.VideoFrame;
}

function resizeTextureSource(source: Texture2DLayerSource, width: number, height: number) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = width;
    canvas.height = height;
    if (
        source instanceof HTMLImageElement ||
        source instanceof HTMLCanvasElement ||
        source instanceof HTMLVideoElement ||
        source instanceof OffscreenCanvas ||
        source instanceof ImageBitmap ||
        isVideoFrame(source)
    ) {
        ctx.drawImage(source, 0, 0, width, height);
    } else {
        const imageData =
            source instanceof ImageData ? source : new ImageData(Uint8ClampedArray.from(source), width, height);
        const sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = width;
        sourceCanvas.height = height;
        sourceCanvas.getContext('2d')!.putImageData(imageData, 0, 0);
        ctx.drawImage(sourceCanvas, 0, 0, width, height);
    }
    return canvas;
}

/**
 * Concrete 2D texture layer backed by an image-like source or typed array.
 */
export class Texture2DCommonLayer extends Texture2DLayer {
    source: Texture2DLayerSource;
    format = WebGLPixelFormat.RGBA;
    type = TextureDataType.UnsignedByteType;

    constructor(source: Texture2DLayerSource, width?: number, height?: number, isHTMLSource?: boolean) {
        super();
        this.setSource(source, width, height, isHTMLSource);
    }

    setSource(source: Texture2DLayerSource, width?: number, height?: number, isHTMLSource?: boolean) {
        let source_width = 2;
        let source_height = 2;
        let canResize = false;
        if (
            source instanceof HTMLImageElement ||
            source instanceof HTMLCanvasElement ||
            source instanceof OffscreenCanvas ||
            source instanceof ImageData ||
            source instanceof ImageBitmap
        ) {
            source_width = source.width;
            source_height = source.height;
            canResize = true;
        } else if (source instanceof HTMLVideoElement) {
            source_width = source.videoWidth;
            source_height = source.videoHeight;
            canResize = false;
        } else if (isVideoFrame(source)) {
            source_width = source.displayWidth;
            source_height = source.displayHeight;
            canResize = true;
        } else {
            if (width === undefined || height === undefined) {
                logger.invalidInput('missing width height');
            } else {
                source_width = width;
                source_height = height;
            }
        }
        let new_w = source_width;
        let new_h = source_height;
        const needResize = source_width > MAX_TEXTURE_SIZE || source_height > MAX_TEXTURE_SIZE;

        if (canResize && (needResize || isHTMLSource)) {
            if (needResize) {
                const scale = MAX_TEXTURE_SIZE / Math.max(source_width, source_height);
                new_w = Math.floor(scale * source_width);
                new_h = Math.floor(scale * source_height);
            }
            this.source = resizeTextureSource(source, new_w, new_h);
        } else {
            this.source = source;
        }

        this.setSize(new_w, new_h);
    }

    ser() {
        const imgSrcLike = (this.source as any).getAttribute?.('src');
        if (!!imgSrcLike) {
            return imgSrcLike;
        }
        if (this.source instanceof HTMLCanvasElement) {
            return getDataUrl(this.source);
        } else if (this.source instanceof ImageData) {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d')!;
            ctx.putImageData(this.source, 0, 0);
            return getDataUrl(canvas);
        } else {
            // TODO: support TypeArray ImageData
            logger.unsupported('Unsupported texture type to serialize');
            return undefined;
        }
    }

    static create(source: Texture2DLayerSource, width?: number, height?: number, isHTMLSource?: boolean) {
        return new Texture2DCommonLayer(source, width, height, isHTMLSource);
    }

    static createAsync(source: HTMLImageElement): Promise<Texture2DCommonLayer> {
        return new Promise((resolve, reject) => {
            if (source.complete) {
                resolve(new Texture2DCommonLayer(source));
            }
            source.addEventListener('load', () => resolve(new Texture2DCommonLayer(source)), {
                capture: true,
                passive: true,
            });
            source.addEventListener('error', event => reject(event), { capture: true, passive: true });
        });
    }
    setFormat(format: WebGLPixelFormat) {
        this.format = format;
        return this;
    }

    setType(type: TextureDataType) {
        this.type = type;
        return this;
    }

    /**
     * @internal
     */
    uploadWebGL(
        ctx: WebGLTextureUploadCtx,
        target: number,
        level: number,
        needPOT: boolean,
    ): SourceTextureLayerWebGLUploadResult {
        const texelCount = this.width * this.height;
        const texelByte = getFormatByteSize(this.format, this.type);
        let need_resize = false;
        let new_w = 0;
        let new_h = 0;
        const internalFormat = getInternalFormat(ctx.gl, this.format, this.type);

        const max_texture_size = ctx.limits.maxTextureDimension2D;
        if (this.width > max_texture_size || this.height > max_texture_size) {
            need_resize = true;
            const scale = max_texture_size / Math.max(this.width, this.height);
            new_w = Math.floor(scale * this.width);
            new_h = Math.floor(scale * this.height);
        }

        const is_pot = _Math.isPowerOfTwo(this.width) && _Math.isPowerOfTwo(this.height);
        if (needPOT && !is_pot) {
            need_resize = true;
            new_w = _Math.floorPowerOfTwo(Math.min(this.width, max_texture_size));
            new_h = _Math.floorPowerOfTwo(Math.min(this.height, max_texture_size));
        }

        // resize =>
        //  Ok => return canvas.upload_content
        //  Err => fall-through
        if (need_resize) {
            ctx.gl.texImage2D(
                target,
                level,
                internalFormat,
                this.format,
                this.type,
                resizeTextureSource(this.source, new_w, new_h),
            );
            return {
                is_pot: _Math.isPowerOfTwo(new_w) && _Math.isPowerOfTwo(new_h),
                byteSize: new_w * new_h * texelByte,
            };
        }

        if (
            this.source instanceof HTMLImageElement ||
            this.source instanceof HTMLCanvasElement ||
            this.source instanceof HTMLVideoElement ||
            this.source instanceof OffscreenCanvas ||
            this.source instanceof ImageData ||
            this.source instanceof ImageBitmap ||
            isVideoFrame(this.source)
        ) {
            ctx.gl.texImage2D(target, level, internalFormat, this.format, this.type, this.source);
        } else {
            ctx.gl.texImage2D(
                target,
                level,
                internalFormat,
                this.width,
                this.height,
                0,
                this.format,
                this.type,
                this.source,
            );
        }
        return {
            is_pot,
            byteSize: texelCount * texelByte,
        };
    }

    /**
     * @internal
     */
    getAutoGeneratedMipmapFromCurrentLevel() {
        const { width, height, format, type } = this;
        const texelByte = getFormatByteSize(format, type);
        const levels = 1 + Math.floor(Math.log2(Math.max(width, height)));
        let texelCount = 0;

        for (let i = 0, j = 1; i < levels; i++, j *= 2) {
            texelCount += Math.max(Math.floor(width / j), 1) * Math.max(Math.floor(height / j), 1);
        }

        return texelCount * texelByte;
    }
}

const defaultTexture2D = singleton(() =>
    Texture2D.createByMainLayerSource(
        new Uint8Array([233, 233, 233, 255]),
        WebGLPixelFormat.RGBA,
        TextureDataType.UnsignedByteType,
        1,
        1,
    ),
);

export class Texture2D extends LegacySourceTexture {
    static get default() {
        initDefaultTexture();
        return defaultTexture2D();
    }

    className() {
        return 'Texture2D';
    }

    source: TextureMipmapGroup<Texture2DCommonLayer>;

    get main() {
        return this.source.main;
    }

    get width() {
        return this.source.main.width;
    }

    get height() {
        return this.source.main.height;
    }

    constructor(source: TextureMipmapGroup<Texture2DCommonLayer>) {
        super(TextureDimension.D2, TextureViewDimension.D2, false);
        ContentBridge.textureCreate(this);
        this.source = source;
        this.source.syncData(this);
    }

    static createByMainLayer(layer: Texture2DCommonLayer) {
        return new Texture2D(TextureMipmapGroup.create(layer));
    }

    static createByMainLayerSource(
        source: Texture2DLayerSource,
        format: WebGLPixelFormat = WebGLPixelFormat.RGBA,
        type: TextureDataType = TextureDataType.UnsignedByteType,
        width?: number,
        height?: number,
        isHTMLSource?: boolean,
    ) {
        return new Texture2D(
            TextureMipmapGroup.create(
                Texture2DCommonLayer.create(source, width, height, isHTMLSource).setFormat(format).setType(type),
            ),
        );
    }

    /**
     * @internal
     */
    uploadWebGLImpl(
        ctx: WebGLTextureUploadCtx,
        disableCustomMipmap: boolean,
        needPOT: boolean,
    ): SourceTextureWebGLUploadResult {
        return this.source.uploadWebGL(ctx, ctx.gl.TEXTURE_2D, disableCustomMipmap, needPOT);
    }

    /**
     * @internal
     */
    canAutoGenerateMipmap(): boolean {
        return true;
    }

    protected getAutoGeneratedMipmapByteSize() {
        const main = this.source.main;
        if (main) {
            return main.getAutoGeneratedMipmapFromCurrentLevel();
        }
        return 0;
    }

    serialize(ctx: Serializer<any>) {
        super.serialize(ctx);
        ctx.putRaw(
            'source',
            this.source.mipmaps.map(m => m.ser()),
        );
    }

    async deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        // old format
        if (ctx.readRaw('center') !== undefined) {
            const url = ctx.readRaw('image');
            if (url) {
                const image = createImgByUrl(url);
                this.source.mipmaps[0] = await Texture2DCommonLayer.createAsync(image);
            }
        } else {
            const urls = ctx.readRaw('source') as string[];
            if (urls) {
                this.source.mipmaps = await Promise.all<Texture2DCommonLayer>(
                    urls.map(url => {
                        const image = createImgByUrl(url);
                        return Texture2DCommonLayer.createAsync(image);
                    }),
                );
            }
        }
        this.source.syncData(this);
    }
}

export type Texture2DLayerSource =
    | HTMLImageElement
    | HTMLCanvasElement
    | HTMLVideoElement
    | OffscreenCanvas
    | ImageData
    | ImageBitmap
    | TypedArray;

let defaultTextureInitialized = false;
export function initDefaultTexture() {
    if (!defaultTextureInitialized) {
        defaultTextureInitialized = true;
        ContentBridge.init_default_texture(Texture2D.default);
    }
}
