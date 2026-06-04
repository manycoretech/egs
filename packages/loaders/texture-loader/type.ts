import type { CompressTextureType, LayerSource, MipLevelSource, TextureFormat, Viewer, IViewerContext } from '@qunhe/egs';

export interface LoadResult {
    format: TextureFormat;
    data: Array<MipLevelSource | LayerSource[]>,
    width: number,
    height: number,
    depthOrArrayLayers: number,
    mipmaps: boolean,
    autoGenerateMipmap: boolean
}

export enum TextureContainerType {
    // simple image, png, jpg, webp...
    Image,
    // dds
    DDS,
    // ktx2
    KTX2,
}

export interface LoaderOptions {
    containerType?: TextureContainerType
    /**
     * some compressed texture needs viewer. E.G. KTX2 Basis transcode
     */
    context?: Viewer | IViewerContext,
    /**
     * manual specify supported compressed texture types.
     */
    supportedTypes?: CompressTextureType[],
    /**
     * same as HTMLImageElement.crossOrigin
     */
    crossOrigin?: string,
    /**
     * set false to force disable mipmaps.
     * @default `true`
     */
    mipmaps?: boolean
}

