import { TextureFormat, type LayerSource } from '@qunhe/egs';
import { TextureContainerType, type LoadResult } from './type';

const { toU64, toI64 } = (function () {
    const buffer = new ArrayBuffer(8);
    const U64View = new BigUint64Array(buffer);
    const I64View = new BigInt64Array(buffer);
    const U32View = new Uint32Array(buffer, 0, 2);
    return {
        toU64(low: number, high: number) {
            U32View[0] = low;
            U32View[1] = high;
            return U64View[0];
        },
        toI64(low: number, high: number) {
            U32View[0] = low;
            U32View[1] = high;
            return I64View[0];
        },
    };
})();

export function detectContainerType(url: URL) {
    // data url & blob url default to image
    if (url.protocol === 'data:' || url.protocol === 'blob:') {
        return TextureContainerType.Image;
    }
    // check ext..
    const ext = url.pathname.split('.').pop();
    switch (ext) {
        case 'dds':
            return TextureContainerType.DDS;
        case 'ktx2':
            return TextureContainerType.KTX2;
        default:
            return TextureContainerType.Image;
    }
}

export function isCubeLike(width: number, height: number, depthOrArrayLayers: number) {
    return width === height && depthOrArrayLayers === 6;
}

export const INVALID_LOAD_RESULT: LoadResult = {
    format: TextureFormat.Rgba8Unorm,
    data: [new Uint8Array(4)],
    width: 1,
    height: 1,
    depthOrArrayLayers: 1,
    mipmaps: false,
    autoGenerateMipmap: false,
};

export function mergeLoadResults(results: LoadResult[]): LoadResult {
    if (results.length === 0) {
        return INVALID_LOAD_RESULT;
    }
    if (results.length === 1) {
        return results[0];
    }
    const pivot = results[0];
    if (pivot.depthOrArrayLayers !== 1) {
        return INVALID_LOAD_RESULT;
    }
    for (const result of results) {
        if (
            pivot.format !== result.format ||
            pivot.width !== result.width ||
            pivot.height !== result.height ||
            pivot.depthOrArrayLayers !== result.depthOrArrayLayers ||
            pivot.data.length !== result.data.length ||
            pivot.mipmaps !== result.mipmaps ||
            pivot.autoGenerateMipmap !== result.autoGenerateMipmap
        ) {
            return INVALID_LOAD_RESULT;
        }
    }
    const result: LoadResult = {
        format: pivot.format,
        width: pivot.width,
        height: pivot.height,
        depthOrArrayLayers: results.length,
        mipmaps: pivot.mipmaps,
        autoGenerateMipmap: pivot.autoGenerateMipmap,
        data: [],
    };
    const levels = pivot.data.length;

    for (let i = 0; i < levels; i++) {
        const levelSource: LayerSource[] = [];
        for (const r of results) {
            const level = r.data[i];
            if (Array.isArray(level)) {
                // only layer 0 is valid to use.
                levelSource.push(level[0]);
            } else {
                levelSource.push(level);
            }
        }
        result.data.push(levelSource);
    }
    return result;
}

export { toI64, toU64 };
