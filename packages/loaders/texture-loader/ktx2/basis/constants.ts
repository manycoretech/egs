import type { CompressTextureType, LayerSource, MipLevelSource } from '@qunhe/egs';

// Values match basis_tex_format in upstream transcoder/basisu_file_headers.h.
export enum BasisFormat {
    ETC1S = 0,
    UASTC = 1,
    UASTC_HDR = 2,
    XUASTC_4x4 = 5,
    XUASTC_5x4 = 6,
    XUASTC_5x5 = 7,
    XUASTC_6x5 = 8,
    XUASTC_6x6 = 9,
    XUASTC_8x5 = 10,
    XUASTC_8x6 = 11,
    XUASTC_10x5 = 12,
    XUASTC_10x6 = 13,
    XUASTC_8x8 = 14,
    XUASTC_10x8 = 15,
    XUASTC_10x10 = 16,
    XUASTC_12x10 = 17,
    XUASTC_12x12 = 18,
    XUBC7 = 33,
}

// Values match transcoder_texture_format in upstream transcoder/basisu_transcoder.h.
export enum TranscoderFormat {
    ETC1_RGB = 0,
    ETC2_RGBA = 1,
    BC1_RGB = 2,
    BC3_RGBA = 3,
    BC4_R = 4,
    BC5_RG = 5,
    BC7_RGBA = 6,
    PVRTC1_4_RGB = 8,
    PVRTC1_4_RGBA = 9,
    ASTC_4x4_RGBA = 10,
    ATC_RGB = 11,
    ATC_RGBA = 12,
    RGBA32 = 13,
    RGB565 = 14,
    BGR565 = 15,
    RGBA4444 = 16,
    BC6H = 22,
    ASTC_HDR_4x4_RGBA = 23,
    RGB_HALF = 24,
    RGBA_HALF = 25,
    ASTC_5x4_RGBA = 28,
    ASTC_5x5_RGBA = 29,
    ASTC_6x5_RGBA = 30,
    ASTC_6x6_RGBA = 31,
    ASTC_8x5_RGBA = 32,
    ASTC_8x6_RGBA = 33,
    ASTC_10x5_RGBA = 34,
    ASTC_10x6_RGBA = 35,
    ASTC_8x8_RGBA = 36,
    ASTC_10x8_RGBA = 37,
    ASTC_10x10_RGBA = 38,
    ASTC_12x10_RGBA = 39,
    ASTC_12x12_RGBA = 40,
}

// Loader-local IDs used by the Worker protocol. Keep the existing IDs stable.
export enum TranscoderOutputFormat {
    'bc1-rgba-unorm',
    'bc3-rgba-unorm',
    'bc7-rgba-unorm',
    'etc2-rgb8unorm',
    'etc2-rgba8unorm',
    'astc-4x4-unorm',
    'astc-5x4-unorm',
    'astc-5x5-unorm',
    'astc-6x5-unorm',
    'astc-6x6-unorm',
    'astc-8x5-unorm',
    'astc-8x6-unorm',
    'astc-10x5-unorm',
    'astc-10x6-unorm',
    'astc-8x8-unorm',
    'astc-10x8-unorm',
    'astc-10x10-unorm',
    'astc-12x10-unorm',
    'astc-12x12-unorm',
}

const GPU_TEXTURE_FORMAT_MAP: {
    [key in TranscoderOutputFormat]: GPUTextureFormat;
} = {
    [TranscoderOutputFormat['bc1-rgba-unorm']]: 'bc1-rgba-unorm',
    [TranscoderOutputFormat['bc3-rgba-unorm']]: 'bc3-rgba-unorm',
    [TranscoderOutputFormat['bc7-rgba-unorm']]: 'bc7-rgba-unorm',
    [TranscoderOutputFormat['etc2-rgb8unorm']]: 'etc2-rgb8unorm',
    [TranscoderOutputFormat['etc2-rgba8unorm']]: 'etc2-rgba8unorm',
    [TranscoderOutputFormat['astc-4x4-unorm']]: 'astc-4x4-unorm',
    [TranscoderOutputFormat['astc-5x4-unorm']]: 'astc-5x4-unorm',
    [TranscoderOutputFormat['astc-5x5-unorm']]: 'astc-5x5-unorm',
    [TranscoderOutputFormat['astc-6x5-unorm']]: 'astc-6x5-unorm',
    [TranscoderOutputFormat['astc-6x6-unorm']]: 'astc-6x6-unorm',
    [TranscoderOutputFormat['astc-8x5-unorm']]: 'astc-8x5-unorm',
    [TranscoderOutputFormat['astc-8x6-unorm']]: 'astc-8x6-unorm',
    [TranscoderOutputFormat['astc-10x5-unorm']]: 'astc-10x5-unorm',
    [TranscoderOutputFormat['astc-10x6-unorm']]: 'astc-10x6-unorm',
    [TranscoderOutputFormat['astc-8x8-unorm']]: 'astc-8x8-unorm',
    [TranscoderOutputFormat['astc-10x8-unorm']]: 'astc-10x8-unorm',
    [TranscoderOutputFormat['astc-10x10-unorm']]: 'astc-10x10-unorm',
    [TranscoderOutputFormat['astc-12x10-unorm']]: 'astc-12x10-unorm',
    [TranscoderOutputFormat['astc-12x12-unorm']]: 'astc-12x12-unorm',
} as const;

export function toGPUTextureFormat(format: TranscoderOutputFormat): GPUTextureFormat {
    return GPU_TEXTURE_FORMAT_MAP[format];
}

interface TranscoderInfo {
    to: TranscoderOutputFormat[];
    transcoder: TranscoderFormat[];
}
interface TranscoderOptions {
    ldr: TranscoderInfo;
    priority: [number, number, number]; // [ETC1S, UASTC/XUASTC LDR, XUBC7], lower is better.
}

// Ordered by the upstream XUASTC format IDs, which differ from the ASTC output IDs.
const XUASTC_ASTC_FORMATS: ReadonlyArray<readonly [TranscoderOutputFormat, TranscoderFormat]> = [
    [TranscoderOutputFormat['astc-4x4-unorm'], TranscoderFormat.ASTC_4x4_RGBA],
    [TranscoderOutputFormat['astc-5x4-unorm'], TranscoderFormat.ASTC_5x4_RGBA],
    [TranscoderOutputFormat['astc-5x5-unorm'], TranscoderFormat.ASTC_5x5_RGBA],
    [TranscoderOutputFormat['astc-6x5-unorm'], TranscoderFormat.ASTC_6x5_RGBA],
    [TranscoderOutputFormat['astc-6x6-unorm'], TranscoderFormat.ASTC_6x6_RGBA],
    [TranscoderOutputFormat['astc-8x5-unorm'], TranscoderFormat.ASTC_8x5_RGBA],
    [TranscoderOutputFormat['astc-8x6-unorm'], TranscoderFormat.ASTC_8x6_RGBA],
    [TranscoderOutputFormat['astc-10x5-unorm'], TranscoderFormat.ASTC_10x5_RGBA],
    [TranscoderOutputFormat['astc-10x6-unorm'], TranscoderFormat.ASTC_10x6_RGBA],
    [TranscoderOutputFormat['astc-8x8-unorm'], TranscoderFormat.ASTC_8x8_RGBA],
    [TranscoderOutputFormat['astc-10x8-unorm'], TranscoderFormat.ASTC_10x8_RGBA],
    [TranscoderOutputFormat['astc-10x10-unorm'], TranscoderFormat.ASTC_10x10_RGBA],
    [TranscoderOutputFormat['astc-12x10-unorm'], TranscoderFormat.ASTC_12x10_RGBA],
    [TranscoderOutputFormat['astc-12x12-unorm'], TranscoderFormat.ASTC_12x12_RGBA],
];

const TRANSCODER_OPTIONS: Array<TranscoderOptions | undefined> = [
    // dummy: 0
    undefined,
    // CompressTextureType.S3TC: 1
    {
        ldr: {
            to: [TranscoderOutputFormat['bc1-rgba-unorm'], TranscoderOutputFormat['bc3-rgba-unorm']],
            transcoder: [TranscoderFormat.BC1_RGB, TranscoderFormat.BC3_RGBA],
        },
        priority: [4, 4, 4],
    },
    // CompressTextureType.PVRTC: 2
    undefined,
    // CompressTextureType.BPTC: 3
    {
        ldr: {
            to: [TranscoderOutputFormat['bc7-rgba-unorm'], TranscoderOutputFormat['bc7-rgba-unorm']],
            transcoder: [TranscoderFormat.BC7_RGBA, TranscoderFormat.BC7_RGBA],
        },
        priority: [2, 2, 1],
    },
    // CompressTextureType.ETC2: 4
    {
        ldr: {
            to: [TranscoderOutputFormat['etc2-rgb8unorm'], TranscoderOutputFormat['etc2-rgba8unorm']],
            transcoder: [TranscoderFormat.ETC1_RGB, TranscoderFormat.ETC2_RGBA],
        },
        priority: [1, 3, 3],
    },
    // CompressTextureType.ASTC: 5
    {
        ldr: {
            to: [TranscoderOutputFormat['astc-4x4-unorm'], TranscoderOutputFormat['astc-4x4-unorm']],
            transcoder: [TranscoderFormat.ASTC_4x4_RGBA, TranscoderFormat.ASTC_4x4_RGBA],
        },
        priority: [Infinity, 1, 2],
    },
];

export function getTranscoderConfig(supported: CompressTextureType[], basisFormat: BasisFormat) {
    const isXUASTC = basisFormat >= BasisFormat.XUASTC_4x4 && basisFormat <= BasisFormat.XUASTC_12x12;
    let priorityIndex: 0 | 1 | 2;
    if (basisFormat === BasisFormat.ETC1S) {
        priorityIndex = 0;
    } else if (basisFormat === BasisFormat.UASTC || isXUASTC) {
        priorityIndex = 1;
    } else if (basisFormat === BasisFormat.XUBC7) {
        priorityIndex = 2;
    } else {
        return undefined;
    }

    const config = supported
        .map(f => TRANSCODER_OPTIONS[f])
        .filter((o): o is TranscoderOptions => !!o && Number.isFinite(o.priority[priorityIndex]))
        .sort((a, b) => a.priority[priorityIndex] - b.priority[priorityIndex])[0];

    if (isXUASTC && config?.ldr.transcoder[0] === TranscoderFormat.ASTC_4x4_RGBA) {
        const [output, transcoder] = XUASTC_ASTC_FORMATS[basisFormat - BasisFormat.XUASTC_4x4];
        return {
            ...config,
            ldr: {
                to: [output, output],
                transcoder: [transcoder, transcoder],
            },
        };
    }
    return config;
}

export enum TaskType {
    Transcode,
}

export enum TaskStatus {
    Success,
    Fail,
}

export interface TranscodeResult {
    format: TranscoderOutputFormat;
    data: Array<MipLevelSource | LayerSource[]>;
    width: number;
    height: number;
    buffer: ArrayBuffer;
}
