import { KTX2_ID, VK_FORMATS, SuperCompression } from './constants.js';
import { TextureFormat } from '@qunhe/egs';
import { logger } from '@qunhe/egs-lib';
import { INVALID_LOAD_RESULT, toU64 } from '../utils.js';
import { transcode } from './basis/index.js';
import type { LoaderOptions, LoadResult } from '../type.js';
import { toGPUTextureFormat } from './basis/constants.js';

interface FormatMeta {
    format: TextureFormat;
    TypedArray:
        | Int8ArrayConstructor
        | Uint8ArrayConstructor
        | Int16ArrayConstructor
        | Uint16ArrayConstructor
        | Int32ArrayConstructor
        | Uint32ArrayConstructor;
}

const FORMAT_MAP: {
    [key in VK_FORMATS]?: FormatMeta | undefined;
} = {
    // normal
    [VK_FORMATS.VK_FORMAT_R8G8B8A8_UNORM]: { format: TextureFormat.Rgba8Unorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_R8G8B8A8_SRGB]: { format: TextureFormat.Rgba8Unorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_R16G16B16A16_UNORM]: { format: TextureFormat.Rgba16Unorm, TypedArray: Uint16Array },
    [VK_FORMATS.VK_FORMAT_R16G16B16A16_UINT]: { format: TextureFormat.Rgba16Uint, TypedArray: Uint16Array },
    [VK_FORMATS.VK_FORMAT_R16G16B16A16_SFLOAT]: { format: TextureFormat.Rgba16Float, TypedArray: Uint16Array },

    // ETC2
    [VK_FORMATS.VK_FORMAT_ETC2_R8G8B8A8_UNORM_BLOCK]: { format: TextureFormat.Etc2Rgba8Unorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_ETC2_R8G8B8_UNORM_BLOCK]: { format: TextureFormat.Etc2Rgb8Unorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_ETC2_R8G8B8A8_SRGB_BLOCK]: { format: TextureFormat.Etc2Rgba8Unorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_ETC2_R8G8B8_SRGB_BLOCK]: { format: TextureFormat.Etc2Rgb8Unorm, TypedArray: Uint8Array },

    // ASTC
    [VK_FORMATS.VK_FORMAT_ASTC_4x4_UNORM_BLOCK]: { format: TextureFormat.Astc4x4Unorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_ASTC_5x4_UNORM_BLOCK]: { format: TextureFormat.Astc5x4Unorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_ASTC_5x5_UNORM_BLOCK]: { format: TextureFormat.Astc5x5Unorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_ASTC_6x5_UNORM_BLOCK]: { format: TextureFormat.Astc6x5Unorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_ASTC_6x6_UNORM_BLOCK]: { format: TextureFormat.Astc6x6Unorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_ASTC_8x5_UNORM_BLOCK]: { format: TextureFormat.Astc8x5Unorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_ASTC_8x6_UNORM_BLOCK]: { format: TextureFormat.Astc8x6Unorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_ASTC_8x8_UNORM_BLOCK]: { format: TextureFormat.Astc8x8Unorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_ASTC_10x5_UNORM_BLOCK]: { format: TextureFormat.Astc10x5Unorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_ASTC_10x6_UNORM_BLOCK]: { format: TextureFormat.Astc10x6Unorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_ASTC_10x8_UNORM_BLOCK]: { format: TextureFormat.Astc10x8Unorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_ASTC_10x10_UNORM_BLOCK]: { format: TextureFormat.Astc10x10Unorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_ASTC_12x10_UNORM_BLOCK]: { format: TextureFormat.Astc12x10Unorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_ASTC_12x12_UNORM_BLOCK]: { format: TextureFormat.Astc12x12Unorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_ASTC_4x4_SRGB_BLOCK]: { format: TextureFormat.Astc4x4Unorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_ASTC_5x4_SRGB_BLOCK]: { format: TextureFormat.Astc5x4Unorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_ASTC_5x5_SRGB_BLOCK]: { format: TextureFormat.Astc5x5Unorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_ASTC_6x5_SRGB_BLOCK]: { format: TextureFormat.Astc6x5Unorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_ASTC_6x6_SRGB_BLOCK]: { format: TextureFormat.Astc6x6Unorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_ASTC_8x5_SRGB_BLOCK]: { format: TextureFormat.Astc8x5Unorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_ASTC_8x6_SRGB_BLOCK]: { format: TextureFormat.Astc8x6Unorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_ASTC_8x8_SRGB_BLOCK]: { format: TextureFormat.Astc8x8Unorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_ASTC_10x5_SRGB_BLOCK]: { format: TextureFormat.Astc10x5Unorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_ASTC_10x6_SRGB_BLOCK]: { format: TextureFormat.Astc10x6Unorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_ASTC_10x8_SRGB_BLOCK]: { format: TextureFormat.Astc10x8Unorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_ASTC_10x10_SRGB_BLOCK]: { format: TextureFormat.Astc10x10Unorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_ASTC_12x10_SRGB_BLOCK]: { format: TextureFormat.Astc12x10Unorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_ASTC_12x12_SRGB_BLOCK]: { format: TextureFormat.Astc12x12Unorm, TypedArray: Uint8Array },

    // BCN
    [VK_FORMATS.VK_FORMAT_BC1_RGB_UNORM_BLOCK]: { format: TextureFormat.Bc1RgbaUnorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_BC1_RGBA_UNORM_BLOCK]: { format: TextureFormat.Bc1RgbaUnorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_BC2_UNORM_BLOCK]: { format: TextureFormat.Bc2RgbaUnorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_BC3_UNORM_BLOCK]: { format: TextureFormat.Bc3RgbaUnorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_BC7_UNORM_BLOCK]: { format: TextureFormat.Bc7RgbaUnorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_BC1_RGB_SRGB_BLOCK]: { format: TextureFormat.Bc1RgbaUnorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_BC1_RGBA_SRGB_BLOCK]: { format: TextureFormat.Bc1RgbaUnorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_BC2_SRGB_BLOCK]: { format: TextureFormat.Bc2RgbaUnorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_BC3_SRGB_BLOCK]: { format: TextureFormat.Bc3RgbaUnorm, TypedArray: Uint8Array },
    [VK_FORMATS.VK_FORMAT_BC7_SRGB_BLOCK]: { format: TextureFormat.Bc7RgbaUnorm, TypedArray: Uint8Array },
};

export default async function (url: URL, options?: LoaderOptions): Promise<LoadResult> {
    const buffer = await (await fetch(url)).arrayBuffer();

    // https://registry.khronos.org/KTX/specs/2.0/ktxspec.v2.html
    const id = new Uint8Array(buffer, 0, KTX2_ID.length);
    if (
        id[0] !== KTX2_ID[0] || // '´'
        id[1] !== KTX2_ID[1] || // 'K'
        id[2] !== KTX2_ID[2] || // 'T'
        id[3] !== KTX2_ID[3] || // 'X'
        id[4] !== KTX2_ID[4] || // ' '
        id[5] !== KTX2_ID[5] || // '2'
        id[6] !== KTX2_ID[6] || // '0'
        id[7] !== KTX2_ID[7] || // 'ª'
        id[8] !== KTX2_ID[8] || // '\r'
        id[9] !== KTX2_ID[9] || // '\n'
        id[10] !== KTX2_ID[10] || // '\x1A'
        id[11] !== KTX2_ID[11] // '\n'
    ) {
        logger.invalidInput('EGS.KTX2Loader.parse: Invalid id in KTX2 header.');
        return INVALID_LOAD_RESULT;
    }

    const KTX2HeaderLengthU32 = 17;
    const KTX2Header = new Uint32Array(buffer, KTX2_ID.length, KTX2HeaderLengthU32);
    const vkFormat = KTX2Header[0];
    if (vkFormat === VK_FORMATS.VK_FORMAT_UNDEFINED) {
        if (!options?.context && !options?.supportedTypes) {
            logger.unsupported(
                'EGS.KTX2Loader.parse: KTX2 Universal format transcode needs viewer or specify support types.',
            );
            return INVALID_LOAD_RESULT;
        }
        return transcode(new Uint8Array(buffer), options?.supportedTypes)
            .then(result => ({
                ...result,
                format: toGPUTextureFormat(result.format) as TextureFormat,
                depthOrArrayLayers: 1,
                mipmaps: result.data.length > 1,
                autoGenerateMipmap: false,
            }))
            .catch(error => {
                logger.error(error);
                return INVALID_LOAD_RESULT;
            });
    }

    const infoMeta = FORMAT_MAP[vkFormat as VK_FORMATS];

    if (!infoMeta) {
        logger.unsupported(`EGS.KTX2Loader.parse: Unknown VK_FORMAT ${vkFormat}.`);
        return INVALID_LOAD_RESULT;
    }

    // const typeSize = KTX2Header[1];
    const pixelWidth = KTX2Header[2];
    const pixelHeight = KTX2Header[3];
    // const pixelDepth = KTX2Header[4];
    // const layerCount = KTX2Header[5];
    // const faceCount = KTX2Header[6];
    const levelCount = Math.max(KTX2Header[7], 1);
    const superCompressionScheme = KTX2Header[8] as SuperCompression;

    // const dfdByteOffset = KTX2Header[9];
    // const dfdByteLength = KTX2Header[10];
    // const kvdByteOffset = KTX2Header[11];
    // const kvdByteLength = KTX2Header[12];

    // const sgdByteOffset = toU64(KTX2Header[13], KTX2Header[14]);
    // const sgdByteLength = toU64(KTX2Header[15], KTX2Header[16]);

    const ktx2: LoadResult = {
        data: [],
        width: pixelWidth,
        height: pixelHeight,
        depthOrArrayLayers: 1,
        format: infoMeta.format,
        mipmaps: levelCount > 1,
        autoGenerateMipmap: false,
    };

    const levelByteLength = levelCount * 3 * 8;
    const levelData = new Uint32Array(buffer, KTX2_ID.length + KTX2HeaderLengthU32 * 4, levelByteLength / 4);

    for (let i = 0; i < levelCount; i++) {
        const start = toU64(levelData[6 * i], levelData[6 * i + 1]);
        const count = toU64(levelData[6 * i + 2], levelData[6 * i + 3]);
        ktx2.data.push([
            new infoMeta.TypedArray(buffer, Number(start), Number(count) / infoMeta.TypedArray.BYTES_PER_ELEMENT),
        ]);
    }

    if (superCompressionScheme !== SuperCompression.KHR_SUPERCOMPRESSION_NONE) {
        logger.unsupported(`EGS.KTX2Loader.parse: Super Compression ${superCompressionScheme} not supported.`);
    }
    return ktx2;
}
