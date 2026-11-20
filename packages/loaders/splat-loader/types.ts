import type { FileContext } from './utils/zip.js';

export enum SplatFileType {
    PLY,
    SPZ,
    SPLAT,
    KSPLAT,
    SOG,
    LCC,
    LCC2,
    ESZ,
}

export enum SplatPackType {
    Raw,
    Compressed,
    SuperCompressed,
    Sog,
}

export interface ISingleSplat {
    x: number;
    y: number;
    z: number;
    sx: number;
    sy: number;
    sz: number;
    qx: number;
    qy: number;
    qz: number;
    qw: number;
    r: number;
    g: number;
    b: number;
    a: number;
}

export enum ISamplerFormat {
    RG_UINT,
    RGBA_UINT,
}

export interface ISampler {
    width: number;
    height: number;
    depth: number;
    format: ISamplerFormat;
    source: Uint8Array;
}

export interface ISplatData {
    counts: number;
    shDegree: number;
    samplers: ISampler[];
    extras?: any[];
}

export type SplatPart = 'all' | 'splat' | 'sh' | number;

export interface SplatStreamChunk {
    index: number;
    offset: number;
    source: Uint8Array;
    recycle?: boolean;
}

export interface SplatStreamHeader {
    data: ISplatData;
    byteLengths?: number[];
}

export type SplatStreamMessage = SplatStreamHeader | SplatStreamChunk;

export interface IData {
    readonly packType: SplatPackType;
    readonly counts: number;
    readonly shDegree: number;
    blockCounts: number;

    initBlock(counts: number, shDegree: number): Promise<number>;
    finishBlock(): void;

    initChunk(offset: number, counts: number, part: SplatPart, chunkBytes?: number): number;
    commitChunk(): Promise<void>;

    getSamplerSource(index: number, offset: number): Uint8Array;

    set(i: number, single: ISingleSplat): void;
    setCenter(i: number, x: number, y: number, z: number): void;
    setScale(i: number, sx: number, sy: number, sz: number): void;
    setLogScale(i: number, sx: number, sy: number, sz: number): void;
    setQuat(i: number, qx: number, qy: number, qz: number, qw: number): void;
    setColor(i: number, r: number, g: number, b: number): void;
    setAlpha(i: number, a: number): void;
    setShN(i: number, shN: number[]): void;

    get(i: number, single: ISingleSplat): void;
    getCenter(i: number, single: ISingleSplat): void;
    getScale(i: number, single: ISingleSplat): void;
    getQuat(i: number, single: ISingleSplat): void;
    getColor(i: number, single: ISingleSplat): void;
    getAlpha(i: number, single: ISingleSplat): void;
    getShN(i: number, out: number[]): void;
}

export interface IFile {
    read(stream: ReadableStream<Uint8Array>, contentLength: number, data: IData, context?: FileContext): Promise<void>;
    write(stream: WritableStream<Uint8Array>, data: IData): Promise<void>;
}

export interface ParseExtras {
    stream: boolean;
    streamChunkBytes: number;
    mortonSort: boolean;
    maxShDegree: number;
    maxTextureSize: number;
    lodLevel: number; // LCC2 LOD level
    includeOtherFormats: boolean; // Include other independent splat formats in ZIP archives
}
