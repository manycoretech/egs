import { WebGLTextureUploadCtx, SamplerDescriptor } from './Texture';
import { TextureV2 } from './TextureV2';
import { ContentBridge } from '../../ContentAPI';
import { TextureDimension, TextureViewDimension, TextureFormat, mipLevelSize, CUBE_FACES } from './types';
import type { TypedArray } from '../../utils/Utils';
import { _Math } from '../../math/Math';
import { logger } from '../../utils/Logger';

export type MipLevelSource = TypedArray;
export type LayerSource = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | OffscreenCanvas | ImageData | ImageBitmap | TypedArray;

function levelLayerIdentity(level: number, layer: number) {
    return (level << 16) | layer;
}

/**
 * SourceTexture is texture which contains cpu data.
 */
export class SourceTexture extends TextureV2 {
    /**
     * @internal
     */
    readonly isSourceTexture = true;
    readonly autoGenerateMipmap: boolean;

    private samplerNeedSync: boolean;
    private modifiedLevels: number;
    private modifiedLayers: Set<number>;
    private source: Array<MipLevelSource | Array<LayerSource | undefined> | undefined>;

    constructor(
        dimension: TextureDimension, viewDimension: TextureViewDimension,
        format: TextureFormat,
        width: number, height: number, depthOrArrayLayers: number,
        mipmaps: boolean, autoGenerateMipmap: boolean,
    ) {
        super(
            dimension, viewDimension,
            format, width, height, depthOrArrayLayers, 1,
            mipmaps, false
        );
        this.autoGenerateMipmap = autoGenerateMipmap;
        this.samplerNeedSync = true;
        this.modifiedLevels = 0;
        this.modifiedLayers = new Set();
        this.source = [];
        ContentBridge.textureCreate(this);
    }

    getLevelLayerSource(level: number, layer?: number) {
        const levelData = this.source[level];
        if (Array.isArray(levelData)) {
            if (layer == null) {
                logger.warn(`SourceTexture level[${level}] is layered, but layer not specified, use layer 0 instead.`);
            }
            return levelData[layer || 0];
        } else {
            if (layer != null) {
                logger.warn(`SourceTexture level[${level}] is not layered, but layer specified, use full level data instead, layer ignored.`);
            }
            return levelData;
        }
    }

    configSampler(visitor: (s: SamplerDescriptor) => any) {
        super.configSampler(visitor);
        this.samplerNeedSync = true;
        return this;
    }

    /**
     * @internal
     */
    protected upload(ctx: WebGLTextureUploadCtx): number {
        const { gl, newCreated, backend, isWebGL1 } = ctx;

        if (newCreated || this.modifiedLevels !== 0) {
            this.storageDescriptor.sync_webgl(ctx.gl, this.dimension === TextureDimension.D3);
            for (let i = 0; i < this.levels; i++) {
                const levelData = this.source[i];
                const mipmapSize = mipLevelSize(i, this.width, this.height, this.depthOrArrayLayers, this.dimension);
                if (Array.isArray(levelData)) {
                    for (let j = 0; j < mipmapSize.depthOrArrayLayers; j++) {
                        const identity = levelLayerIdentity(i, j);
                        const layerData = levelData[j];
                        const layerNeedUpload = newCreated || this.modifiedLayers.has(identity);
                        if (layerData && layerNeedUpload) {
                            if (this.isLayeredTexture) {
                                if (!this.glFormat.compressed) {
                                    gl.texSubImage3D(this.bindableTarget, i,
                                        0, 0, 0,
                                        mipmapSize.width, mipmapSize.height, 1,
                                        this.glFormat.external(backend), this.glFormat.dataType(backend),
                                        layerData as any
                                    );
                                } else {
                                    gl.compressedTexSubImage3D(this.bindableTarget, i,
                                        0, 0, 0,
                                        mipmapSize.width, mipmapSize.height, 1,
                                        this.glFormat.internal(backend),
                                        layerData as any
                                    );
                                }
                            } else {
                                const target = this.isCube ? CUBE_FACES[j] : this.bindableTarget;
                                if (!this.glFormat.compressed) {
                                    if (isWebGL1 && !(layerData as any).buffer) {
                                        // texSubImage2D no override tasks width/height with external texture source
                                        gl.texSubImage2D(target, i,
                                            0, 0,
                                            this.glFormat.external(backend), this.glFormat.dataType(backend),
                                            layerData as any
                                        );
                                    } else {
                                        gl.texSubImage2D(target, i,
                                            0, 0,
                                            mipmapSize.width, mipmapSize.height,
                                            this.glFormat.external(backend), this.glFormat.dataType(backend),
                                            layerData as any
                                        );
                                    }
                                } else {
                                    gl.compressedTexSubImage2D(target, i,
                                        0, 0,
                                        mipmapSize.width, mipmapSize.height,
                                        this.glFormat.internal(backend),
                                        layerData as any
                                    );
                                }
                            }
                        }
                    }
                } else if (levelData) {
                    if (this.isLayeredTexture) {
                        if (!this.glFormat.compressed) {
                            gl.texSubImage3D(this.bindableTarget, i,
                                0, 0, 0,
                                mipmapSize.width, mipmapSize.height, mipmapSize.depthOrArrayLayers,
                                this.glFormat.external(backend), this.glFormat.dataType(backend), levelData
                            );
                        } else {
                            gl.compressedTexSubImage3D(this.bindableTarget, i,
                                0, 0, 0,
                                mipmapSize.width, mipmapSize.height, mipmapSize.depthOrArrayLayers,
                                this.glFormat.internal(backend), levelData
                            );
                        }
                    } else {
                        if (!this.glFormat.compressed) {
                            gl.texSubImage2D(this.bindableTarget, i,
                                0, 0,
                                mipmapSize.width, mipmapSize.height,
                                this.glFormat.external(backend), this.glFormat.dataType(backend), levelData
                            );
                        } else {
                            gl.compressedTexSubImage2D(this.bindableTarget, i,
                                0, 0,
                                mipmapSize.width, mipmapSize.height,
                                this.glFormat.internal(backend), levelData
                            );
                        }
                    }
                }
            }

            this.assumeUploaded();
            if (this.levels > 1 && this.autoGenerateMipmap) {
                gl.generateMipmap(this.bindableTarget);
            }
        }

        if (newCreated || this.samplerNeedSync) {
            this.samplerDescriptor.sync_webgl(ctx.gl, this.bindableTarget, this.mipmaps, isWebGL1 && !this.isPot);
            this.samplerNeedSync = false;
        }

        return this.byteSize;
    }

    setLevelData(data: MipLevelSource, level: number) {
        if (level >= this.levels) {
            return this;
        }

        if (this.source[level] !== data) {
            this.source[level] = data;
            this.modifiedLevels |= (1 << level);
            ContentBridge.sourceTextureSetLevelData(this, data, level);
        }
        return this;
    }

    setLevelLayerData(data: LayerSource, level: number, layer: number) {
        if (level >= this.levels) {
            return this;
        }
        const mipmapSize = mipLevelSize(level, this.width, this.height, this.depthOrArrayLayers, this.dimension);
        if (layer >= mipmapSize.depthOrArrayLayers) {
            return this;
        }
        if (!Array.isArray(this.source[level])) {
            this.source[level] = [];
        }
        const levelData = this.source[level]!;
        if (levelData[layer] !== data) {
            levelData[layer] = data;
            this.modifiedLevels |= (1 << level);
            this.modifiedLayers.add(levelLayerIdentity(level, layer));
            ContentBridge.sourceTextureSetLevelLayerData(this, data, level, layer);
        }
        return this;
    }

    /**
     * @internal
     */
    syncAllLevels() {
        for (let i = 0; i < this.levels; i++) {
            const levelData = this.source[i];
            if (Array.isArray(levelData)) {
                for (let j = 0; j < this.depthOrArrayLayers; j++) {
                    const layerData = levelData[j];
                    if (layerData) {
                        ContentBridge.sourceTextureSetLevelLayerData(this, layerData, i, j);
                    }
                }
            } else if (levelData) {
                ContentBridge.sourceTextureSetLevelData(this, levelData, i);
            }
        }
    }

    /**
     * @internal
     */
    assumeUploaded() {
        this.modifiedLevels = 0;
        this.modifiedLayers.clear();
    }
}
