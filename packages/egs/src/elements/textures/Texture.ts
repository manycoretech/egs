import { ElementEventDispatcher, EventType } from '../../utils/EventDispatcher';
import { WebGLPixelFormat, getWebGLPixelFormatChannelSize } from '../../renderer/webgl/WGLConstants';
import { Deserializer, Serializer } from '../../utils/Serialization';
import { TextureDataType, getTextureDataTypeSize, SamplerFilter, SamplerWrap } from '../../utils/Constants';
import { logger } from '../../utils/Logger';
import { ElementsWithGPUResource } from '../../utils/ElementBase';
import { ContentBridge } from '../../ContentAPI';
import { WGLCapabilities } from '../../renderer/webgl/WGLCapabilities';
import { TextureDimension, TextureViewDimension, getBindableTarget } from './types';
import { RendererBackend } from '../../renderer/IRenderer';

export const TextureDisposeEvent = new EventType<Texture>();

// single pixel white image.
export const WHITE_IMAGE_DATA = new ImageData(Uint8ClampedArray.from([255, 255, 255, 255]), 1, 1);

/**
 * Base class for texture like data. Each texture match one WebGLTexture
 */
export abstract class Texture extends ElementEventDispatcher implements ElementsWithGPUResource {
    /**
     * @internal
     */
    readonly isInternal: boolean;
    /**
     * @internal
     */
    readonly dimension: TextureDimension;
    /**
     * @internal
     */
    readonly viewDimension: TextureViewDimension;
    /**
     * @internal
     */
    readonly bindableTarget: number;
    name = '';
    readonly samplerDescriptor = new SamplerDescriptor();
    readonly storageDescriptor = new TextureStorageDescriptor();
    isMipmapDisabled = false;

    constructor();
    /**
     * @internal
     */
    constructor(dimension: TextureDimension, viewDimension: TextureViewDimension, isInternal: boolean);
    constructor(dimension: TextureDimension = TextureDimension.D2, viewDimension: TextureViewDimension = TextureViewDimension.D2, isInternal: boolean = false) {
        super();
        this.dimension = dimension;
        this.viewDimension = viewDimension;
        this.isInternal = isInternal;
        this.bindableTarget = getBindableTarget(this.viewDimension);
        // ContentBridge create is impl by inherited class
    }

    destroy() {
        super.destroy();
        ContentBridge.textureDestroy(this);
    }

    syncBase() {
        ContentBridge.textureSyncSamplerAndMetaInfo(this);
    }

    getUUID() {
        return this.uuid;
    }

    disableAutoMipmap() {
        this.isMipmapDisabled = true;
        this.syncBase();
        return this;
    }

    copyBaseInfo(other: Texture) {
        this.isMipmapDisabled = other.isMipmapDisabled;
        this.configSampler(s => s.copy(other.samplerDescriptor));
        this.configStorage(s => s.copy(other.storageDescriptor));
        this.syncBase();
        return this;
    }

    configAsDataTexture() {
        this.configSampler(s => {
            s.magFilter = SamplerFilter.Nearest;
            s.minFilter = SamplerFilter.Nearest;
        });
        this.configStorage(s => {
            s.flipY = false;
            s.unpackAlignment = 1;
        });
        this.disableAutoMipmap();
        return this;
    }

    configSampler(visitor: (s: SamplerDescriptor) => any) {
        visitor(this.samplerDescriptor);
        this.syncBase();
        return this;
    }

    configSamplerRepeat() {
        this.configSampler(s => {
            s.wrapS = SamplerWrap.Repeat;
            s.wrapT = SamplerWrap.Repeat;
        });
        return this;
    }

    configTrilinear() {
        this.configSampler(s => {
            s.minFilter = SamplerFilter.LinearMipmapLinear;
            s.magFilter = SamplerFilter.Linear;
        });
        return this;
    }

    configDoubleLinear() {
        this.configSampler(s => {
            s.minFilter = SamplerFilter.Linear;
            s.magFilter = SamplerFilter.Linear;
        });
        return this;
    }

    configStorage(visitor: (t: TextureStorageDescriptor) => any) {
        visitor(this.storageDescriptor);
        this.syncBase();
        return this;
    }

    /**
     * @internal
     */
    abstract uploadWebGL(ctx: WebGLTextureUploadCtx): number;
    /**
     * @internal
     * @deprecated use `bindableTarget`
     */
    getTargetBindType(_gl: WebGL2RenderingContext): number {
        return this.bindableTarget;
    }

    freeGPU() {
        ContentBridge.textureFreeGPU(this);
        this.emit(TextureDisposeEvent, this);
    }

    serialize(ctx: Serializer<Texture>) {
        ctx.puts<Texture>(['samplerDescriptor', 'storageDescriptor', 'isMipmapDisabled', 'name']);
    }
    deserialize(ctx: Deserializer) {
        // old format
        if (ctx.readRaw('center') !== undefined) {
            this.configStorage(s => {
                s.flipY = ctx.readRaw('flipY');
                s.premultipliedAlpha = ctx.readRaw('premultipliedAlpha');
                s.unpackAlignment = ctx.readRaw('unpackAlignment');
            });
            this.configSampler(s => {
                s.magFilter = ctx.readRaw('magFilter');
                s.minFilter = ctx.readRaw('minFilter');
                s.wrapS = ctx.readRaw('wrapS');
                s.wrapT = ctx.readRaw('wrapT');
            });
        } else {
            ctx.reads<Texture>(['samplerDescriptor', 'storageDescriptor', 'isMipmapDisabled', 'name']);
            this.syncBase();
        }
    }
}

export class WebGLTextureUploadCtx {
    constructor(
        public gl: WebGL2RenderingContext,
        public backend: RendererBackend,
        public isWebGL1: boolean,
        public maxTextureSize: number,
        public newCreated: boolean,
    ) { }

}

export enum TextureTarget {
    Texture2D = 0x0DE1,
    Texture3D = 0x806F,
    TextureCubeMap = 0x8513,
}

export interface SourceTextureWebGLUploadResult {
    is_pot: boolean,
    has_uploaded_custom_mipmap: boolean,
    byteSize: number,
}

export interface SourceTextureLayerWebGLUploadResult {
    is_pot: boolean,
    byteSize: number,
}

export function getInternalFormat(gl: WebGLRenderingContext | WebGL2RenderingContext, glFormat: number, glType: number): number {
    if (!WGLCapabilities.IS_WEBGL2) {
        return glFormat;
    }
    const _gl = (gl as WebGL2RenderingContext);
    if (glFormat === _gl.RED) {
        if (glType === _gl.FLOAT) {
            return _gl.R32F;
        }
        if (glType === _gl.HALF_FLOAT) {
            return _gl.R16F;
        }
        if (glType === _gl.UNSIGNED_BYTE) {
            return _gl.R8;
        }
    }
    if (glFormat === _gl.RED_INTEGER) {
        if (glType === _gl.UNSIGNED_INT) {
            return _gl.R32UI;
        }
        if (glType === _gl.UNSIGNED_BYTE) {
            return _gl.R8UI;
        }
        if (glType === _gl.UNSIGNED_SHORT) {
            return _gl.R16UI;
        }
    }
    if (glFormat === _gl.RG_INTEGER) {
        if (glType === _gl.UNSIGNED_INT) {
            return _gl.RG32UI;
        }
    }

    if (glFormat === _gl.RGB) {
        if (glType === _gl.FLOAT) {
            return _gl.RGB32F;
        }
        if (glType === _gl.HALF_FLOAT) {
            return _gl.RGB16F;
        }
        if (glType === _gl.UNSIGNED_BYTE) {
            return _gl.RGB8;
        }
    }
    if (glFormat === _gl.RGB_INTEGER) {
        if (glType === _gl.UNSIGNED_INT) {
            return _gl.RGB32UI;
        }
    }

    if (glFormat === _gl.RGBA) {
        if (glType === _gl.FLOAT) {
            return _gl.RGBA32F;
        }
        if (glType === _gl.HALF_FLOAT) {
            return _gl.RGBA16F;
        }
        if (glType === _gl.UNSIGNED_BYTE) {
            return _gl.RGBA8;
        }
        if (glType === _gl.UNSIGNED_INT_2_10_10_10_REV) {
            return _gl.RGB10_A2;
        }
    }
    if (glFormat === _gl.RGBA_INTEGER) {
        if (glType === _gl.UNSIGNED_INT) {
            return _gl.RGBA32UI;
        }
    }

    if (glFormat === _gl.DEPTH_COMPONENT) {
        if (glType === _gl.UNSIGNED_INT) {
            return _gl.DEPTH_COMPONENT16;
        }
        if (glType === _gl.FLOAT) {
            return _gl.DEPTH_COMPONENT32F;
        }
    }

    if (glFormat === _gl.DEPTH_STENCIL) {
        if (glType === _gl.UNSIGNED_INT_24_8) {
            return _gl.DEPTH24_STENCIL8;
        }
        if (glType === _gl.FLOAT_32_UNSIGNED_INT_24_8_REV) {
            return _gl.DEPTH32F_STENCIL8;
        }
    }

    logger.unsupported('internal format match failed.');
    return glFormat;
}

export function getFormatByteSize(glFormat: WebGLPixelFormat, dataType: TextureDataType) {
    return getWebGLPixelFormatChannelSize(glFormat) * getTextureDataTypeSize(dataType);
}

/**
 * LegacySourceTexture is the base texture class for texture with cpu data(eg. Texture2D, Texture2DCompressed...)
 */
export abstract class LegacySourceTexture extends Texture {
    /**
     * @internal
     */
    readonly isLegacySourceTexture = true;

    /**
     * @internal
     */
    abstract uploadWebGLImpl(ctx: WebGLTextureUploadCtx, disableCustomMipmap: boolean, needPot: boolean): SourceTextureWebGLUploadResult;
    /**
     * @internal
     */
    abstract canAutoGenerateMipmap(): boolean;

    protected abstract getAutoGeneratedMipmapByteSize(): number;

    /**
     * @internal
     */
    uploadWebGL(ctx: WebGLTextureUploadCtx) {
        const gl = ctx.gl;
        this.storageDescriptor.sync_webgl(gl, (this as any).is3d === true);

        // user disable mipmap or sampler doesn't need mipmap => disable mipmap, else encourage mipmap
        const isMipmapDisabled = this.isMipmapDisabled || !this.samplerDescriptor.needMipmap();
        // encourage mipmap and webgl1 => need power of two
        const needPot = !isMipmapDisabled && ctx.backend === RendererBackend.WEBGL_JS;

        const result = this.uploadWebGLImpl(ctx, isMipmapDisabled, needPot);

        const webgl1_npot = ctx.backend === RendererBackend.WEBGL_JS && !result.is_pot;
        // webgl1 && npot => cannot generate mipmap
        const can_auto_generate_mipmap = !webgl1_npot && this.canAutoGenerateMipmap();
        // not uploaded yet && encourage mipmap && can auto generate => auto_generate
        const shouldAutoGenerateMipmap =
            !isMipmapDisabled && !result.has_uploaded_custom_mipmap && can_auto_generate_mipmap;
        if (shouldAutoGenerateMipmap) {
            gl.generateMipmap(this.bindableTarget);
            result.byteSize = this.getAutoGeneratedMipmapByteSize();
        }

        // custom uploaded or auto generated => mipmap enabled
        const mipmap_enabled = result.has_uploaded_custom_mipmap || shouldAutoGenerateMipmap;
        // webgl1 && npot => force clamp_to_edge
        const force_clamp_to_edge = webgl1_npot;
        this.samplerDescriptor.sync_webgl(
            gl,
            this.bindableTarget,
            mipmap_enabled,
            force_clamp_to_edge,
        );

        return result.byteSize;
    }

}

export interface WebGLUploadable {
    __brand: 'WebGLUploadable';
    /**
     * @internal
     */
    uploadWebGL(ctx: WebGLTextureUploadCtx, target: number, level: number, needPOT: boolean): SourceTextureLayerWebGLUploadResult;
}

/**
 * Container for texture data and their mipmap
 */
export class TextureMipmapGroup<T extends WebGLUploadable>{
    texture?: Texture;
    /**
     * Main layer
     */
    get main() {
        return this.mipmaps[0];
    }
    set main(v) {
        this.mipmaps[0] = v;
    }
    mipmaps: T[] = [];

    constructor(main: T[]) {
        this.mipmaps = main;
    }

    syncData(texture?: Texture, layer = 0) {
        this.texture = texture;
        if (this.texture) {
            this.mipmaps.forEach((mip, level) => {
                ContentBridge.textureSetLayerLevelSource(this.texture!, layer, level, mip);
            });
        }
    }

    static create<T extends WebGLUploadable>(main: T) {
        return new TextureMipmapGroup([main]);
    }
    static fromArray<T extends WebGLUploadable>(arr: T[]) {
        return new TextureMipmapGroup(arr);
    }

    modifyMain(visitor: (T: T) => any) {
        visitor(this.main);
        this.syncData(this.texture);
        return this;
    }

    modifyMipmap(layer: number, visitor: (T: T) => any) {
        if (this.mipmaps[layer] !== undefined) {
            visitor(this.mipmaps[layer]);
        }
        this.syncData(this.texture);
        return this;
    }

    setMipmap(mipmap: T, level: number) {
        this.mipmaps[level] = mipmap;
        this.syncData(this.texture);
        return this;
    }

    pushMipmap(mipmap: T) {
        this.mipmaps.push(mipmap);
        this.syncData(this.texture);
        return this;
    }

    /**
     * @internal
     */
    uploadWebGL(ctx: WebGLTextureUploadCtx, target: number, disableCustomMipmap: boolean, needPOT: boolean): SourceTextureWebGLUploadResult {
        const result = {
            is_pot: true,
            byteSize: 0,
        };

        const has_uploaded_custom_mipmap = !disableCustomMipmap && this.mipmaps.length > 1;
        if (this.mipmaps.length > 0) {
            this.mipmaps.forEach((map, index) => {
                if (disableCustomMipmap && index !== 0) {
                    return;
                }
                const mip = map.uploadWebGL(ctx, target, index, needPOT);
                result.byteSize += mip.byteSize;
                result.is_pot = result.is_pot && mip.is_pot;
            });
        } else {
            logger.invalidInput('missing texture data');
        }
        return { ...result, has_uploaded_custom_mipmap };
    }
}

export class TextureStorageDescriptor {
    /**
     * If set to true, the texture is flipped along the vertical axis when uploaded to the GPU.
     * @defaultValue `true`
     */
    flipY = true;

    /**
     * If set to true, the alpha channel, if present, is multiplied into the color channels when the texture is uploaded to the GPU.
     * @defaultValue `false`
     */
    premultipliedAlpha = false;

    /**
     * valid values: 1, 2, 4, 8 (see <a href="http://www.khronos.org/opengles/sdk/docs/man/xhtml/glPixelStorei.xml">glPixelStorei</a> for more details)
     */
    /**
     * @deprecated unsupported, always be 4
     */
    unpackAlignment: 1 | 2 | 4 | 8 = 4;

    copy(other: TextureStorageDescriptor) {
        this.flipY = other.flipY;
        this.premultipliedAlpha = other.premultipliedAlpha;
        this.unpackAlignment = other.unpackAlignment;
    }

    /**
     * @internal
     */
    sync_webgl(gl: WebGLRenderingContext, is3D?: boolean) {
        if (is3D !== true) {
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, this.flipY);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, this.premultipliedAlpha);
        } else {
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        }
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, this.unpackAlignment);
    }

    serialize(ctx: Serializer<any>) {
        ctx.puts<TextureStorageDescriptor>(['flipY', 'unpackAlignment', 'premultipliedAlpha']);
    }
    deserialize(ctx: Deserializer) {
        ctx.reads<TextureStorageDescriptor>(['flipY', 'unpackAlignment', 'premultipliedAlpha']);
    }
}

export enum SamplerBindingType {
    Filtering,
    NonFiltering,
    Comparison,
}

export class SamplerDescriptor {
    static CreateAttachmentSampler() {
        const sampler = new SamplerDescriptor();
        sampler.wrapS = SamplerWrap.ClampToEdge;
        sampler.wrapT = SamplerWrap.ClampToEdge;
        sampler.magFilter = SamplerFilter.Linear;
        sampler.minFilter = SamplerFilter.Linear;
        return sampler;
    }

    static CreateDepthAttachmentSampler() {
        const sampler = new SamplerDescriptor();
        sampler.wrapS = SamplerWrap.ClampToEdge;
        sampler.wrapT = SamplerWrap.ClampToEdge;
        sampler.magFilter = SamplerFilter.Nearest;
        sampler.minFilter = SamplerFilter.Nearest;
        return sampler;
    }

    copy(other: SamplerDescriptor) {
        this.wrapS = other.wrapS;
        this.wrapT = other.wrapT;
        this.magFilter = other.magFilter;
        this.minFilter = other.minFilter;
    }

    /**
     * This defines how the texture is wrapped horizontally and corresponds to U in UV mapping.
     * The default is {@link SamplerWrap.ClampToEdgeWrapping | ClampToEdgeWrapping}, where the edge is clamped to the outer edge texel.
     */
    wrapS = SamplerWrap.ClampToEdge;

    /**
     * This defines how the texture is wrapped vertically and corresponds to V in UV mapping.
     * The same choices are available as for {@link wrapS | wrapT}.
     */
    wrapT = SamplerWrap.ClampToEdge;

    /**
     * For use with a texture's magFilter property,
     * these define the texture magnification function to be used when the pixel being textured maps to an area less than or equal to one texture element (texel).
     */
    magFilter = SamplerFilter.Linear;

    /**
     * For use with a texture's minFilter property,
     * these define the texture minifying function that is used whenever the pixel being textured maps to an area greater than one texture element (texel).
     */
    minFilter = SamplerFilter.LinearMipmapLinear;

    /**
     * @internal
     */
    samplerBindingType?: SamplerBindingType;

    serialize(ctx: Serializer<any>) {
        ctx.puts<SamplerDescriptor>(['wrapS', 'wrapT', 'magFilter', 'minFilter']);
    }
    deserialize(ctx: Deserializer) {
        ctx.reads<SamplerDescriptor>(['wrapS', 'wrapT', 'magFilter', 'minFilter']);
    }

    /**
     * @internal
     */
    sync_webgl(
        gl: WebGLRenderingContext,
        target: number,
        mipmapEnabled: boolean,
        forceClampToEdge: boolean
    ) {

        const wrapS = forceClampToEdge ? gl.CLAMP_TO_EDGE : this.wrapS;
        const wrapT = forceClampToEdge ? gl.CLAMP_TO_EDGE : this.wrapT;
        const magFilter = this.magFilter;
        const minFilter = mipmapEnabled ? this.minFilter : this.min_filter_fallback();
        gl.texParameteri(target, gl.TEXTURE_WRAP_S, wrapS);
        gl.texParameteri(target, gl.TEXTURE_WRAP_T, wrapT);
        gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, magFilter);
        gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, minFilter);
    }

    min_filter_fallback(): SamplerFilter {
        if (this.minFilter === SamplerFilter.NearestMipmapNearest || this.minFilter === SamplerFilter.NearestMipmapLinear) {
            return SamplerFilter.Nearest;
        }
        if (this.minFilter === SamplerFilter.LinearMipmapNearest || this.minFilter === SamplerFilter.LinearMipmapLinear) {
            return SamplerFilter.Linear;
        }
        return this.minFilter;
    }

    needMipmap(): boolean {
        function needMip(f: SamplerFilter) {
            return f === SamplerFilter.LinearMipmapLinear ||
                f === SamplerFilter.LinearMipmapNearest ||
                f === SamplerFilter.NearestMipmapLinear;
        }
        return needMip(this.minFilter);
    }
}

export function createImgByUrl(url: string, { crossOrigin = '' } = {}): HTMLImageElement {
    const image = document.createElementNS('http://www.w3.org/1999/xhtml', 'img') as HTMLImageElement;
    if (crossOrigin !== undefined) {
        image.crossOrigin = crossOrigin;
    }
    image.src = url;
    return image;
}

