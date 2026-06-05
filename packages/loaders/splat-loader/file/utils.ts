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
    shN: number[];
}

export interface IData {
    readonly counts: number;
    readonly shDegree: number;

    initBlock(counts: number, shDegree: number): Promise<number>;
    finishBlock(): void;

    set(i: number, single: Omit<ISingleSplat, 'shN'>): void;
    setCenter(i: number, x: number, y: number, z: number): void;
    setScale(i: number, sx: number, sy: number, sz: number): void;
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
    read(stream: ReadableStream<Uint8Array>, contentLength: number, data: IData): Promise<void>;
    write(stream: WritableStream<Uint8Array>, data: IData): Promise<void>;
}

export const SH_C0 = 0.28209479177387814;
export const SH_MAPS: Record<number, number> = {
    0: 0,
    1: 9,
    2: 24,
    3: 45,
};
export const NUM_F_REST_TO_SH_DEGREE: Record<number, number> = {
    0: 0,
    9: 1,
    24: 2,
    45: 3,
};

export class BufferReader {
    head = 0;
    tail = 0;
    buffer: Uint8Array;
    view: DataView;

    get remaining(): number {
        return this.tail - this.head;
    }

    constructor(buffer: Uint8Array = new Uint8Array()) {
        this.buffer = buffer;
        this.view = new DataView(this.buffer.buffer);
    }

    private grow(required: number) {
        const newCap = Math.max(required, this.buffer.length * 2);
        const next = new Uint8Array(newCap);
        next.set(this.buffer.subarray(this.head, this.tail), 0);

        this.tail -= this.head;
        this.head = 0;
        this.buffer = next;
        this.view = new DataView(next.buffer);
    }

    private compact() {
        if (this.head === 0) {
            return;
        }
        this.buffer.copyWithin(0, this.head, this.tail);
        this.tail -= this.head;
        this.head = 0;
    }

    write(chunk: Uint8Array) {
        const remaining = this.tail - this.head;
        const required = remaining + chunk.length;
        if (this.buffer.length < required) {
            this.grow(required);
        } else if (this.head > 0 && this.buffer.length - this.tail < chunk.length) {
            this.compact();
        }

        this.buffer.set(chunk, this.tail);
        this.tail += chunk.length;
    }

    read(counts: number): Uint8Array {
        const head = this.head;
        const tail = (this.head = head + counts);
        return this.buffer.subarray(head, tail);
    }
}

export interface ChunkDecoder {
    init(): [number, number]; // [totals, itemSize]
    decode(offset: number, counts: number, buffer: Uint8Array): void;
}

export class StreamChunkDecoder {
    private reader: BufferReader;
    private decoders: ChunkDecoder[];
    private decodedTotals: Uint32Array;
    private currentIndex: number = 0;
    private currentTotals: number;
    private currentItemSize: number;

    constructor(reader: BufferReader) {
        this.reader = reader;
    }

    setDecoders(decoders: ChunkDecoder[]) {
        this.decoders = decoders;
        this.decodedTotals = new Uint32Array(decoders.length);
        const [totals, itemSize] = decoders[this.currentIndex].init();
        this.currentTotals = totals;
        this.currentItemSize = itemSize;
    }

    flush() {
        const { reader, decoders, decodedTotals, currentIndex, currentTotals, currentItemSize } = this;
        const stage = decoders[currentIndex];
        const decoded = decodedTotals[currentIndex];
        const counts = Math.min(currentTotals - decoded, (reader.remaining / currentItemSize) | 0);
        const buf = reader.read(counts * currentItemSize);
        stage.decode(decoded, counts, buf);
        decodedTotals[currentIndex] += counts;
        if (decodedTotals[currentIndex] === currentTotals) {
            this.currentIndex++;
            if (this.currentIndex < decoders.length) {
                const [totals, itemSize] = decoders[this.currentIndex]!.init();
                this.currentTotals = totals;
                this.currentItemSize = itemSize;
                this.flush();
            }
        }
    }
}

const f32buffer = new Float32Array(1);
const u32buffer = new Uint32Array(f32buffer.buffer);
export function fromHalf(h: number): number {
    const sign = (h >> 15) & 0x1;
    const exp = (h >> 10) & 0x1f;
    const frac = h & 0x3ff;

    let f32bits: number;
    if (exp === 0) {
        if (frac === 0) {
            f32bits = sign << 31;
        } else {
            let mant = frac;
            let e = -14;
            while ((mant & 0x400) === 0) {
                mant <<= 1;
                e--;
            }
            mant &= 0x3ff;
            const newExp = e + 127;
            const newFrac = mant << 13;
            f32bits = (sign << 31) | (newExp << 23) | newFrac;
        }
    } else if (exp === 0x1f) {
        if (frac === 0) {
            f32bits = (sign << 31) | 0x7f800000;
        } else {
            f32bits = (sign << 31) | 0x7fc00000;
        }
    } else {
        const newExp = exp - 15 + 127;
        const newFrac = frac << 13;
        f32bits = (sign << 31) | (newExp << 23) | newFrac;
    }

    u32buffer[0] = f32bits;
    return f32buffer[0];
}

export function clamp(v: number, min: number, max: number): number {
    return Math.min(Math.max(v, min), max);
}

export function isUrl(str: string): boolean {
    let url: URL;
    try {
        url = new URL(str);
    } catch {
        return false;
    }

    return url.protocol === 'http:' || url.protocol === 'https:';
}

let canvas: OffscreenCanvas;
let context: OffscreenCanvasRenderingContext2D | undefined;
export async function decodeImage(fileBytes: ArrayBuffer) {
    if (!context) {
        canvas = new OffscreenCanvas(1, 1);
        context =
            canvas.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings) ?? undefined;
    }
    if (!context) {
        throw new Error('Failed to create context');
    }

    const imageBlob = new Blob([fileBytes]);
    const bitmap: ImageBitmap = await (createImageBitmap as any)(imageBlob, {
        premultiplyAlpha: 'none',
    });
    const { width, height } = bitmap;
    canvas.width = width;
    canvas.height = height;

    context.drawImage(bitmap, 0, 0, width, height);

    const data = context.getImageData(0, 0, width, height);
    return {
        data: new Uint8Array(data.data.buffer, data.data.byteOffset, data.data.length),
        width,
        height,
    };
}

export function extractFromRootDir(entries: Record<string, Uint8Array>): Record<string, Uint8Array> {
    let dir: string = '';
    for (const path in entries) {
        if (path.endsWith('/')) {
            dir = path;
            break;
        }
    }
    const result: Record<string, Uint8Array> = {};
    for (const path in entries) {
        result[path.replace(dir, '')] = entries[path];
    }
    return result;
}
