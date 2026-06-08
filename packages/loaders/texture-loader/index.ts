import { SourceTexture, TextureDimension, TextureFormat, TextureViewDimension } from '@qunhe/egs';
import { TextureContainerType, type LoaderOptions, type LoadResult } from './type';
import { detectContainerType, isCubeLike, mergeLoadResults } from './utils';
import loadKTX2 from './ktx2';
import loadDDS from './dds';

async function downloadImage(url: URL, crossOrigin = ''): Promise<HTMLImageElement> {
    const img = document.createElement('img');
    if (url.protocol !== 'data:' && url.protocol !== 'blob:') {
        if (crossOrigin != null) {
            img.crossOrigin = crossOrigin;
        }
    }
    img.src = url.href;
    await img.decode();
    return img;
}

async function downloadSingleTexture(url: string | URL, options?: LoaderOptions): Promise<LoadResult> {
    if (typeof url === 'string') {
        url = new URL(url, globalThis.location.href);
    }
    const containerTypeType = options?.containerType ?? detectContainerType(url);
    switch (containerTypeType) {
        case TextureContainerType.Image: {
            const image = await downloadImage(url, options?.crossOrigin);
            return {
                format: TextureFormat.Rgba8Unorm,
                width: image.width,
                height: image.height,
                depthOrArrayLayers: 1,
                data: [[image]],
                mipmaps: true,
                autoGenerateMipmap: true,
            };
        }
        case TextureContainerType.DDS:
            return loadDDS(url, options);
        case TextureContainerType.KTX2:
            return loadKTX2(url, options);
    }
}

async function downloadLayeredTexture(urls: string[] | URL[], options?: LoaderOptions): Promise<LoadResult> {
    const all = await Promise.all(urls.map(url => downloadSingleTexture(url, options)));
    return mergeLoadResults(all);
}

export interface TextureData extends LoadResult {
    dimension: TextureDimension;
    viewDimension: TextureViewDimension;
}

export async function downloadTextureData(
    url: string | string[] | URL | URL[],
    options?: LoaderOptions,
): Promise<TextureData> {
    let result: LoadResult;
    if (Array.isArray(url)) {
        result = await downloadLayeredTexture(url, options);
    } else {
        result = await downloadSingleTexture(url, options);
    }

    result.mipmaps = result.mipmaps && (options?.mipmaps ?? true);
    result.autoGenerateMipmap = result.autoGenerateMipmap && result.mipmaps;
    const levelSize = result.mipmaps ? result.data.length : 1;
    // use assign as texture data
    const textureData = Object.assign(result, {
        dimension: TextureDimension.D2,
        // cube like texture use cube view.
        viewDimension: isCubeLike(result.width, result.height, result.depthOrArrayLayers)
            ? TextureViewDimension.Cube
            : result.depthOrArrayLayers > 1
              ? TextureViewDimension.D2Array
              : TextureViewDimension.D2,
        data: levelSize !== result.data.length ? result.data.slice(0, levelSize) : result.data,
    });

    return textureData;
}

export async function downloadTexture(
    url: string | string[] | URL | URL[],
    options?: LoaderOptions,
): Promise<SourceTexture> {
    const result = await downloadTextureData(url, options);
    const texture = new SourceTexture(
        result.dimension,
        result.viewDimension,
        result.format,
        result.width,
        result.height,
        result.depthOrArrayLayers,
        result.mipmaps,
        result.autoGenerateMipmap,
    );
    for (let i = 0; i < result.data.length; i++) {
        const level = result.data[i];
        if (Array.isArray(level)) {
            for (let j = 0; j < level.length; j++) {
                texture.setLevelLayerData(level[j], i, j);
            }
        } else {
            texture.setLevelData(level, i);
        }
    }
    return texture;
}

export { TextureContainerType, type LoaderOptions } from './type';
