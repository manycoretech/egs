import { Texture, type WebGLTextureUploadCtx } from './Texture';
import {
    type TextureFormat,
    type WebGLTextureFormat,
    type TextureDimension,
    TextureViewDimension,
    maxMipLevels,
    formatMeta,
    textureByteSize,
    textureCopyInfo,
    mipLevelSize,
    CUBE_FACES,
} from './types';
import { _Math } from '../../math/Math';
import { logger } from '../../utils/Logger';

/**
 * A new texture base with immutable size after creation.
 * TextureV2 will represent any texture type(2D/2DArray/3D/Cube and etc..).
 */
export abstract class TextureV2 extends Texture {
    readonly format: TextureFormat;
    readonly width: number;
    readonly height: number;
    readonly depthOrArrayLayers: number;
    readonly sampleCount: number;
    readonly levels: number;
    readonly mipmaps: boolean;
    /**
     * @internal
     */
    readonly glFormat: WebGLTextureFormat;
    readonly byteSize: number;
    /**
     * @internal
     */
    readonly isPot: boolean;

    constructor(
        dimension: TextureDimension,
        viewDimension: TextureViewDimension,
        format: TextureFormat,
        width: number,
        height: number,
        depthOrArrayLayers: number,
        sampleCount: number,
        mipmaps: boolean,
        isInternal: boolean,
    ) {
        super(dimension, viewDimension, isInternal);
        this.format = format;
        this.width = width;
        this.height = height;
        this.depthOrArrayLayers = depthOrArrayLayers;
        this.sampleCount = sampleCount;
        this.levels = mipmaps ? maxMipLevels(width, height, depthOrArrayLayers, this.dimension) : 1;
        this.mipmaps = mipmaps;

        const meta = formatMeta(format);
        this.glFormat = meta.glFormat;
        this.byteSize = Math.round(
            textureByteSize(width, height, meta.copyInfo) * depthOrArrayLayers * sampleCount * (mipmaps ? 1.5 : 1),
        );
        this.isPot = _Math.isPowerOfTwo(width) && _Math.isPowerOfTwo(height);
    }

    /**
     * @internal
     */
    get isLayeredTexture() {
        return this.viewDimension === TextureViewDimension.D2Array || this.viewDimension === TextureViewDimension.D3;
    }

    /**
     * @internal
     */
    get isCube() {
        return this.viewDimension === TextureViewDimension.Cube;
    }

    /**
     * @internal
     */
    uploadWebGL(ctx: WebGLTextureUploadCtx) {
        if (!this.contextCheck(ctx)) {
            return 0;
        }

        if (ctx.newCreated && !this.allocate(ctx)) {
            return 0;
        }
        this.upload(ctx);
        return this.byteSize;
    }

    /**
     * @internal
     */
    protected contextCheck({ isWebGL1 }: WebGLTextureUploadCtx) {
        if (isWebGL1 && this.isLayeredTexture) {
            logger.unsupported('WebGL1 does not support layered texture(Texture3D/Texture2DArray)');
            return false;
        }

        if (isWebGL1 && this.mipmaps && !this.isPot) {
            logger.unsupported('WebGL1 does not support mipmaps with not pot sized texture');
            return false;
        }
        return true;
    }

    /**
     * allocate gpu memory for texture
     * @internal
     */
    protected allocate(ctx: WebGLTextureUploadCtx) {
        const { gl, backend, isWebGL1 } = ctx;
        if (!isWebGL1) {
            if (this.isLayeredTexture) {
                gl.texStorage3D(
                    this.bindableTarget,
                    this.levels,
                    this.glFormat.internal(backend),
                    this.width,
                    this.height,
                    this.depthOrArrayLayers,
                );
            } else {
                gl.texStorage2D(
                    this.bindableTarget,
                    this.levels,
                    this.glFormat.internal(backend),
                    this.width,
                    this.height,
                );
            }
        } else {
            // texture allocate for WebGL1
            // same function as texStorage2D
            if (this.isLayeredTexture) {
                logger.unsupported(
                    'WebGL1 does not support layered texture(Texture3D/Texture2DArray), allocation failed.',
                );
                return false;
            }

            let dummyBuffer: Uint8Array | undefined;
            const copyInfo = textureCopyInfo(this.format);
            if (this.glFormat.compressed) {
                // when use compressed texture in WebGL1, need a dummy buffer to allocate gpu memory.
                dummyBuffer = new Uint8Array(textureByteSize(this.width, this.height, copyInfo));
            }

            for (let i = 0; i < this.levels; i++) {
                const mipmapSize = mipLevelSize(i, this.width, this.height, 1, this.dimension);
                // always be 1 or 6.
                for (let j = 0; j < this.depthOrArrayLayers; j++) {
                    const target = this.isCube ? CUBE_FACES[j] : this.bindableTarget;
                    if (!this.glFormat.compressed) {
                        gl.texImage2D(
                            target,
                            i,
                            this.glFormat.internal(backend),
                            mipmapSize.width,
                            mipmapSize.height,
                            0,
                            this.glFormat.external(backend),
                            this.glFormat.dataType(backend),
                            null,
                        );
                    } else {
                        const bufferSize = textureByteSize(mipmapSize.width, mipmapSize.height, copyInfo);
                        gl.compressedTexImage2D(
                            target,
                            i,
                            this.glFormat.internal(backend),
                            mipmapSize.width,
                            mipmapSize.height,
                            0,
                            dummyBuffer!.subarray(0, bufferSize),
                        );
                    }
                }
            }
        }

        return true;
    }

    /**
     * do texture upload
     * @internal
     */
    protected abstract upload(ctx: WebGLTextureUploadCtx): void;
}

// override Texture.isMipmapDisabled & make immutable
Object.defineProperty(TextureV2.prototype, 'isMipmapDisabled', {
    get(this: TextureV2) {
        return !this.mipmaps;
    },
    set(this: TextureV2, _value: boolean) {},
    enumerable: true,
    configurable: true,
});
