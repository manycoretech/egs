import type { CompressTextureType, LayerSource, MipLevelSource } from '@qunhe/egs';

export enum BasisFormat {
    ETC1S = 0,
    UASTC = 1,
    UASTC_HDR = 2,
}

export enum TranscoderFormat {
    ETC1_RGB = 0,
    ETC2_RGBA = 1,
    BC1_RGB = 2,
    BC3_RGBA = 3,
    BC4_R = 4,
    BC5_RG = 5,
    BC7_RGBA = 7,
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
}

export enum TranscoderOutputFormat {
    'bc1-rgba-unorm',
    'bc3-rgba-unorm',
    'bc7-rgba-unorm',
    'etc2-rgb8unorm',
    'etc2-rgba8unorm',
    'astc-4x4-unorm',
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
} as const;

export function toGPUTextureFormat(format: TranscoderOutputFormat): GPUTextureFormat {
    return GPU_TEXTURE_FORMAT_MAP[format];
}

interface TranscoderInfo {
    from: BasisFormat[];
    to: TranscoderOutputFormat[];
    transcoder: TranscoderFormat[];
}
interface TranscoderOptions {
    ldr: TranscoderInfo;
    priority: [number, number, number]; // [ETC1S, ASTC, ASTC_HDR], lower is better.
}

const INVALID_TRANSCODER_OPTIONS: TranscoderOptions = {
    ldr: {
        from: [],
        to: [],
        transcoder: [],
    },
    priority: [Infinity, Infinity, Infinity],
};

const TRANSCODER_OPTIONS: TranscoderOptions[] = [
    // dummy: 0
    INVALID_TRANSCODER_OPTIONS,
    // CompressTextureType.S3TC: 1
    {
        ldr: {
            from: [BasisFormat.ETC1S, BasisFormat.UASTC],
            to: [TranscoderOutputFormat['bc1-rgba-unorm'], TranscoderOutputFormat['bc3-rgba-unorm']],
            transcoder: [TranscoderFormat.BC1_RGB, TranscoderFormat.BC3_RGBA],
        },
        priority: [4, 4, Infinity],
    },
    // CompressTextureType.PVRTC: 2
    INVALID_TRANSCODER_OPTIONS,
    // CompressTextureType.BPTC: 3
    {
        ldr: {
            from: [BasisFormat.ETC1S, BasisFormat.UASTC],
            to: [TranscoderOutputFormat['bc7-rgba-unorm'], TranscoderOutputFormat['bc7-rgba-unorm']],
            transcoder: [TranscoderFormat.BC7_RGBA, TranscoderFormat.BC7_RGBA],
        },
        priority: [2, 2, 2],
    },
    // CompressTextureType.ETC2: 4
    {
        ldr: {
            from: [BasisFormat.ETC1S, BasisFormat.UASTC],
            to: [TranscoderOutputFormat['etc2-rgb8unorm'], TranscoderOutputFormat['etc2-rgba8unorm']],
            transcoder: [TranscoderFormat.ETC1_RGB, TranscoderFormat.ETC2_RGBA],
        },
        priority: [1, 3, 3],
    },
    // CompressTextureType.ASTC: 5
    {
        ldr: {
            from: [BasisFormat.UASTC],
            to: [TranscoderOutputFormat['astc-4x4-unorm'], TranscoderOutputFormat['astc-4x4-unorm']],
            transcoder: [TranscoderFormat.ASTC_4x4_RGBA, TranscoderFormat.ASTC_4x4_RGBA],
        },
        priority: [Infinity, 1, 1],
    },
];

export function getTranscoderConfig(supported: CompressTextureType[], basisFormat: BasisFormat) {
    const r = supported
        .map(f => TRANSCODER_OPTIONS[f])
        .filter(o => o.ldr.from.includes(basisFormat))
        .sort((a, b) => a.priority[basisFormat] - b.priority[basisFormat]);
    return r[0];
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
