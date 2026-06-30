import { logger } from '@qunhe/egs-lib';
import type { LoaderOptions, LoadResult } from './type.js';
import { TextureFormat } from '@qunhe/egs';
import { INVALID_LOAD_RESULT } from './utils.js';

enum DXGI_FORMAT {
    DXGI_FORMAT_BC1_UNORM = 71,
    DXGI_FORMAT_BC2_UNORM = 74,
    DXGI_FORMAT_BC3_UNORM = 77,
    DXGI_FORMAT_BC7_UNORM = 98,
}

export default async function (url: URL, _options?: LoaderOptions): Promise<LoadResult> {
    const buffer = await (await fetch(url)).arrayBuffer();

    const dds: LoadResult = {
        data: [],
        format: TextureFormat.Rgba8Unorm,
        width: 0,
        height: 0,
        depthOrArrayLayers: 1,
        mipmaps: false,
        autoGenerateMipmap: false,
    };
    // Adapted from @toji's DDS utils
    // https://github.com/toji/webgl-texture-utils/blob/master/texture-util/dds.js
    // All values and structures referenced from:
    // http://msdn.microsoft.com/en-us/library/bb943991.aspx/
    const DDS_MAGIC = 0x20534444;
    // const DDSD_CAPS = 0x1;
    // const DDSD_HEIGHT = 0x2;
    // const DDSD_WIDTH = 0x4;
    // const DDSD_PITCH = 0x8;
    // const DDSD_PIXELFORMAT = 0x1000;
    const DDSD_MIPMAPCOUNT = 0x20000;
    // const DDSD_LINEARSIZE = 0x80000;
    // const DDSD_DEPTH = 0x800000;

    // const DDSCAPS_COMPLEX = 0x8;
    // const DDSCAPS_MIPMAP = 0x400000;
    // const DDSCAPS_TEXTURE = 0x1000;

    const DDSCAPS2_CUBEMAP = 0x200;
    const DDSCAPS2_CUBEMAP_POSITIVEX = 0x400;
    const DDSCAPS2_CUBEMAP_NEGATIVEX = 0x800;
    const DDSCAPS2_CUBEMAP_POSITIVEY = 0x1000;
    const DDSCAPS2_CUBEMAP_NEGATIVEY = 0x2000;
    const DDSCAPS2_CUBEMAP_POSITIVEZ = 0x4000;
    const DDSCAPS2_CUBEMAP_NEGATIVEZ = 0x8000;
    // const DDSCAPS2_VOLUME = 0x200000;

    // const DDPF_ALPHAPIXELS = 0x1;
    // const DDPF_ALPHA = 0x2;
    const DDPF_FOURCC = 0x4;
    // const DDPF_RGB = 0x40;
    // const DDPF_YUV = 0x200;
    // const DDPF_LUMINANCE = 0x20000;

    function fourCCToInt32(value: any) {
        return (
            value.charCodeAt(0) + (value.charCodeAt(1) << 8) + (value.charCodeAt(2) << 16) + (value.charCodeAt(3) << 24)
        );
    }

    function int32ToFourCC(value: any) {
        return String.fromCharCode(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
    }

    function loadARGBMip(_buffer: ArrayBuffer, _dataOffset: number, width: number, height: number) {
        const dataLength = width * height * 4;
        const srcBuffer = new Uint8Array(_buffer, _dataOffset, dataLength);
        const byteArray = new Uint8Array(dataLength);
        let dst = 0;
        let src = 0;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const b = srcBuffer[src];
                src++;
                const g = srcBuffer[src];
                src++;
                const r = srcBuffer[src];
                src++;
                const a = srcBuffer[src];
                src++;
                byteArray[dst] = r;
                dst++; // r
                byteArray[dst] = g;
                dst++; // g
                byteArray[dst] = b;
                dst++; // b
                byteArray[dst] = a;
                dst++; // a
            }
        }
        return byteArray;
    }

    const FOURCC_DXT1 = fourCCToInt32('DXT1');
    const FOURCC_DXT3 = fourCCToInt32('DXT3');
    const FOURCC_DXT5 = fourCCToInt32('DXT5');
    const FOURCC_DXT10 = fourCCToInt32('DX10');
    const FOURCC_ETC1 = fourCCToInt32('ETC1');

    const headerLengthInt = 31; // The header length in 32 bit ints
    const headerDXT10LengthInt = 5;

    // Offsets into the header array
    const off_magic = 0;
    const off_size = 1;
    const off_flags = 2;
    const off_height = 3;
    const off_width = 4;
    const off_mipmapCount = 7;
    const off_pfFlags = 20;
    const off_pfFourCC = 21;
    const off_RGBBitCount = 22;
    const off_RBitMask = 23;
    const off_GBitMask = 24;
    const off_BBitMask = 25;
    const off_ABitMask = 26;
    // const off_caps = 27;
    const off_caps2 = 28;
    // const off_caps3 = 29;
    // const off_caps4 = 30;

    // total offset = 4 + 31 * 4 + off_xxx
    // DXT10 (in DXT10 HEADER)
    const off_dxgiFormat = 0;
    // const off_resourceDimension = 1;
    // const off_miscFlag = 2;
    // const off_arraySize = 3;
    // const off_miscFlags2 = 4;

    // Parse header
    const header = new Int32Array(buffer, 0, headerLengthInt);

    if (header[off_magic] !== DDS_MAGIC) {
        logger.invalidInput('EGS.DDSLoader.parse: Invalid magic number in DDS header.');
        return dds;
    }

    if ((!header[off_pfFlags] as any) & DDPF_FOURCC) {
        logger.invalidInput('EGS.DDSLoader.parse: Unsupported format, must contain a FourCC code.');
        return dds;
    }

    let blockBytes;
    const fourCC = header[off_pfFourCC];
    let isRGBAUncompressed = false;
    let dataOffset = header[off_size] + 4;

    switch (fourCC) {
        case FOURCC_DXT1:
            blockBytes = 8;
            dds.format = TextureFormat.Bc1RgbaUnorm;
            break;
        case FOURCC_DXT3:
            blockBytes = 16;
            dds.format = TextureFormat.Bc2RgbaUnorm;
            break;
        case FOURCC_DXT5:
            blockBytes = 16;
            dds.format = TextureFormat.Bc3RgbaUnorm;
            break;
        case FOURCC_DXT10: {
            const dxt10Header = new Uint32Array(header.buffer, header.byteOffset + dataOffset, headerDXT10LengthInt);
            const dxgiFormat = dxt10Header[off_dxgiFormat];
            dataOffset += headerDXT10LengthInt * 4;
            switch (dxgiFormat) {
                case DXGI_FORMAT.DXGI_FORMAT_BC1_UNORM:
                    blockBytes = 8;
                    dds.format = TextureFormat.Bc1RgbaUnorm;
                    break;
                case DXGI_FORMAT.DXGI_FORMAT_BC2_UNORM:
                    blockBytes = 16;
                    dds.format = TextureFormat.Bc2RgbaUnorm;
                    break;
                case DXGI_FORMAT.DXGI_FORMAT_BC3_UNORM:
                    blockBytes = 16;
                    dds.format = TextureFormat.Bc3RgbaUnorm;
                    break;
                case DXGI_FORMAT.DXGI_FORMAT_BC7_UNORM:
                    blockBytes = 16;
                    dds.format = TextureFormat.Bc7RgbaUnorm;
                    break;
                default:
                    logger.unsupported('EGS.DDSLoader.parse: Unsupported DXGI_FORMAT: ' + dxgiFormat);
                    return dds;
            }
            break;
        }
        case FOURCC_ETC1:
            // ETC1 unsupported.
            return INVALID_LOAD_RESULT;
        default:
            if (
                header[off_RGBBitCount] === 32 &&
                header[off_RBitMask] & 0xff0000 &&
                header[off_GBitMask] & 0xff00 &&
                header[off_BBitMask] & 0xff &&
                header[off_ABitMask] & 0xff000000
            ) {
                isRGBAUncompressed = true;
                blockBytes = 4;
                dds.format = TextureFormat.Rgba8Unorm;
            } else {
                logger.unsupported('EGS.DDSLoader.parse: Unsupported FourCC code ' + int32ToFourCC(fourCC));
                return dds;
            }
    }

    let mipmapCount = 1;
    if (header[off_flags] & DDSD_MIPMAPCOUNT) {
        mipmapCount = Math.max(1, header[off_mipmapCount]);
    }
    dds.mipmaps = mipmapCount > 1;

    const caps2 = header[off_caps2];
    (dds as any).isCubemap = caps2 & DDSCAPS2_CUBEMAP ? true : false;
    if (
        (dds as any).isCubemap &&
        (!(caps2 & DDSCAPS2_CUBEMAP_POSITIVEX) ||
            !(caps2 & DDSCAPS2_CUBEMAP_NEGATIVEX) ||
            !(caps2 & DDSCAPS2_CUBEMAP_POSITIVEY) ||
            !(caps2 & DDSCAPS2_CUBEMAP_NEGATIVEY) ||
            !(caps2 & DDSCAPS2_CUBEMAP_POSITIVEZ) ||
            !(caps2 & DDSCAPS2_CUBEMAP_NEGATIVEZ))
    ) {
        logger.invalidInput('EGS.DDSLoader.parse: Incomplete cubemap faces');
        return dds;
    }
    dds.width = header[off_width];
    dds.height = header[off_height];

    // Extract mipmaps buffers
    const faces = (dds as any).isCubemap ? 6 : 1;

    for (let face = 0; face < faces; face++) {
        let width = dds.width;
        let height = dds.height;
        let byteArray: Uint8Array;
        let dataLength: number;
        for (let i = 0; i < mipmapCount; i++) {
            if (isRGBAUncompressed) {
                byteArray = loadARGBMip(buffer, dataOffset, width, height);
                dataLength = byteArray.length;
            } else {
                dataLength = (((Math.max(4, width) / 4) * Math.max(4, height)) / 4) * blockBytes;
                byteArray = new Uint8Array(buffer, dataOffset, dataLength);
            }
            dds.data.push([byteArray]);
            dataOffset += dataLength;
            width = Math.max(width >> 1, 1);
            height = Math.max(height >> 1, 1);
        }
    }
    return dds;
}
