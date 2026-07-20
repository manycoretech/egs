import { unzipSync } from 'fflate';

export enum SplatFileType {
    PLY,
    SPZ,
    SPLAT,
    KSPLAT,
    SOG,
    LCC,
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

export function createSingleSplat(): ISingleSplat {
    return {
        x: 0,
        y: 0,
        z: 0,
        sx: 0,
        sy: 0,
        sz: 0,
        qx: 0,
        qy: 0,
        qz: 0,
        qw: 0,
        r: 0,
        g: 0,
        b: 0,
        a: 0,
    };
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

export interface IData {
    readonly counts: number;
    readonly shDegree: number;

    initBlock(counts: number, shDegree: number): Promise<number>;
    finishBlock(): void;

    set(i: number, single: ISingleSplat): void;
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

export interface ParseExtras {
    maxShDegree: number;
    maxTextureSize: number;
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

let MAX_TEXTURE_SIZE: number;
export function getMaxTextureSize(): number {
    if (MAX_TEXTURE_SIZE !== undefined) {
        return MAX_TEXTURE_SIZE;
    }
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { stencil: false, depth: false });
    if (!gl) {
        throw new Error('WebGL2 not supported!');
    }
    MAX_TEXTURE_SIZE = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return MAX_TEXTURE_SIZE;
}

export function computeTextureSize(counts: number, maxTextureSize: number): { w: number; h: number; d: number } {
    if (counts === 0) {
        return { w: 0, h: 0, d: 0 };
    }
    const width = Math.min(2 ** Math.ceil(Math.log2(Math.sqrt(counts))), maxTextureSize);
    const height = Math.min(Math.ceil(counts / width), maxTextureSize);
    const depth = Math.ceil(counts / (width * height));
    return { w: width, h: height, d: depth };
}

let canvas: OffscreenCanvas;
let context: OffscreenCanvasRenderingContext2D | undefined;
export async function decodeImage(fileBytes: Uint8Array<ArrayBuffer>) {
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

const f32buffer = new Float32Array(1);
const u32buffer = new Uint32Array(f32buffer.buffer);
export function toHalf(f: number): number {
    f32buffer[0] = f;
    const bits = u32buffer[0];

    const sign = (bits >> 31) & 0x1;
    const exp = (bits >> 23) & 0xff;
    const frac = bits & 0x7fffff;
    const halfSign = sign << 15;

    if (exp === 0xff) {
        if (frac !== 0) {
            return halfSign | 0x7fff;
        }
        return halfSign | 0x7c00;
    }

    const newExp = exp - 127 + 15;

    if (newExp >= 0x1f) {
        return halfSign | 0x7c00;
    }
    if (newExp <= 0) {
        if (newExp < -10) {
            return halfSign;
        }
        const subFrac = (frac | 0x800000) >> (1 - newExp + 13);
        return halfSign | subFrac;
    }

    const halfFrac = frac >> 13;
    return halfSign | (newExp << 10) | halfFrac;
}

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

export function encode111011s(a: number, b: number, c: number) {
    return (
        (clamp(((a * 0.5 + 0.5) * 2047) | 0, 0, 2047) << 21) |
        (clamp(((b * 0.5 + 0.5) * 1023) | 0, 0, 1023) << 11) |
        clamp(((c * 0.5 + 0.5) * 2047) | 0, 0, 2047)
    );
}

export function decode111011s(decode: number, out: number[], offset: number) {
    out[offset + 0] = (((decode >>> 21) & 2047) / 2047) * 2 - 1;
    out[offset + 1] = (((decode >>> 11) & 1023) / 1023) * 2 - 1;
    out[offset + 2] = ((decode & 2047) / 2047) * 2 - 1;
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

export function detectSplatFileType(filename: string, buffer: Uint8Array) {
    let ext = filename.split('.').pop();
    if (ext === 'zip') {
        unzipSync(buffer, {
            filter: file => {
                const name = file.name;
                if (name.endsWith('meta.json')) {
                    ext = 'sog';
                } else if (name.endsWith('meta.lcc')) {
                    ext = 'lcc';
                }
                return false;
            },
        });
    } else if (ext === 'json') {
        // fast check sog json
        const json = JSON.parse(new TextDecoder().decode(buffer));
        const isSogMetadata = ['means', 'scales', 'quats', 'sh0'].every(k => !!json[k]);
        if (isSogMetadata) {
            ext = 'sog';
        }
    }

    let type: SplatFileType | undefined;
    switch (ext) {
        case 'ply': {
            type = SplatFileType.PLY;
            break;
        }
        case 'spz': {
            type = SplatFileType.SPZ;
            break;
        }
        case 'splat': {
            type = SplatFileType.SPLAT;
            break;
        }
        case 'ksplat': {
            type = SplatFileType.KSPLAT;
            break;
        }
        case 'sog': {
            type = SplatFileType.SOG;
            break;
        }
        case 'lcc': {
            type = SplatFileType.LCC;
            break;
        }
        case 'esz': {
            type = SplatFileType.ESZ;
            break;
        }
    }
    return type;
}

class Vector3 {
    constructor(
        public x: number,
        public y: number,
        public z: number,
    ) {}

    set(x: number, y: number, z: number): this {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    }

    length(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    divideScalar(scalar: number): this {
        const invLength = 1 / scalar;
        this.x *= invLength;
        this.y *= invLength;
        this.z *= invLength;
        return this;
    }

    normalize(): this {
        return this.divideScalar(this.length() || 1);
    }
}

export class Quaternion {
    constructor(
        public x: number,
        public y: number,
        public z: number,
        public w: number,
    ) {}

    set(x: number, y: number, z: number, w: number): this {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
        return this;
    }

    normalize(): this {
        const length = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
        if (length === 0) {
            return this;
        }
        const invLength = 1 / length;
        this.x *= invLength;
        this.y *= invLength;
        this.z *= invLength;
        this.w *= invLength;
        return this;
    }
}

const tempArr = new Array(4);
const tempVec = new Vector3(0, 0, 0);
const tempQuat = new Quaternion(0, 0, 0, 1);
export function encodeQuatOct(x: number, y: number, z: number, w: number): number[] {
    const q = tempQuat.set(x, y, z, w).normalize();
    if (q.w < 0) {
        q.set(-q.x, -q.y, -q.z, -q.w);
    }
    const theta = 2 * Math.acos(q.w);
    const xyz_norm = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z);
    const axis = xyz_norm < 1e-6 ? tempVec.set(1, 0, 0) : tempVec.set(q.x, q.y, q.z).divideScalar(xyz_norm);

    const sum = Math.abs(axis.x) + Math.abs(axis.y) + Math.abs(axis.z);
    let p_x = axis.x / sum;
    let p_y = axis.y / sum;
    if (axis.z < 0) {
        const tmp = p_x;
        p_x = (1 - Math.abs(p_y)) * (p_x >= 0 ? 1 : -1);
        p_y = (1 - Math.abs(tmp)) * (p_y >= 0 ? 1 : -1);
    }
    tempArr[0] = p_x;
    tempArr[1] = p_y;
    tempArr[2] = theta / Math.PI;
    return tempArr;
}

export function decodeQuatOct(u: number, v: number, angle: number): number[] {
    let f_x = u;
    let f_y = v;
    const f_z = 1 - (Math.abs(f_x) + Math.abs(f_y));
    const t = Math.max(-f_z, 0);
    f_x += f_x >= 0 ? -t : t;
    f_y += f_y >= 0 ? -t : t;
    const axis = tempVec.set(f_x, f_y, f_z).normalize();
    const theta = angle * Math.PI;
    const halfTheta = theta * 0.5;
    const s = Math.sin(halfTheta);
    tempArr[0] = axis.x * s;
    tempArr[1] = axis.y * s;
    tempArr[2] = axis.z * s;
    tempArr[3] = Math.cos(halfTheta);
    return tempArr;
}

export class ByteStreamCursor {
    private reader: ReadableStreamDefaultReader<Uint8Array>;
    private chunk: Uint8Array | undefined;
    private chunkOffset = 0;

    constructor(stream: ReadableStream<Uint8Array>) {
        this.reader = stream.getReader();
    }

    cancel(reason?: unknown) {
        this.chunk = undefined;
        this.chunkOffset = 0;
        return this.reader.cancel(reason);
    }

    private async ensureChunk() {
        while (!this.chunk || this.chunkOffset >= this.chunk.byteLength) {
            const { done, value } = await this.reader.read();
            if (done || !value) {
                return false;
            }
            this.chunk = value;
            this.chunkOffset = 0;
        }
        return true;
    }

    private advance(byteLength: number) {
        this.chunkOffset += byteLength;
        if (this.chunkOffset === this.chunk!.byteLength) {
            this.chunk = undefined;
            this.chunkOffset = 0;
        }
    }

    async readInto(target: Uint8Array, offset = 0, byteLength = target.byteLength - offset) {
        if (
            !Number.isSafeInteger(offset) ||
            !Number.isSafeInteger(byteLength) ||
            offset < 0 ||
            byteLength < 0 ||
            offset + byteLength > target.byteLength
        ) {
            throw new RangeError('Invalid stream read range');
        }

        const end = offset + byteLength;
        while (offset < end) {
            if (!(await this.ensureChunk())) {
                throw new Error('Stream ended unexpectedly');
            }
            const copyLength = Math.min(end - offset, this.chunk!.byteLength - this.chunkOffset);
            target.set(this.chunk!.subarray(this.chunkOffset, this.chunkOffset + copyLength), offset);
            this.advance(copyLength);
            offset += copyLength;
        }
    }

    async readChunks(byteLength: number, onChunk: (chunk: Uint8Array) => void | Promise<void>) {
        if (!Number.isSafeInteger(byteLength) || byteLength < 0) {
            throw new RangeError(`Invalid stream read length: ${byteLength}`);
        }

        let remaining = byteLength;
        while (remaining > 0) {
            if (!(await this.ensureChunk())) {
                throw new Error('Stream ended unexpectedly');
            }
            const chunkLength = Math.min(remaining, this.chunk!.byteLength - this.chunkOffset);
            const chunk = this.chunk!.subarray(this.chunkOffset, this.chunkOffset + chunkLength);
            this.advance(chunkLength);
            remaining -= chunkLength;
            await onChunk(chunk);
        }
    }

    async skip(byteLength: number) {
        await this.readChunks(byteLength, () => {});
    }

    async readUntil(delimiter: Uint8Array) {
        if (delimiter.byteLength === 0) {
            throw new RangeError('Stream delimiter must not be empty');
        }

        const prefix = new Uint32Array(delimiter.byteLength);
        for (let i = 1, matched = 0; i < delimiter.byteLength; i++) {
            while (matched > 0 && delimiter[i] !== delimiter[matched]) {
                matched = prefix[matched - 1];
            }
            if (delimiter[i] === delimiter[matched]) {
                matched++;
            }
            prefix[i] = matched;
        }

        const chunks: Uint8Array[] = [];
        let byteLength = 0;
        let matched = 0;
        while (await this.ensureChunk()) {
            const source = this.chunk!;
            const start = this.chunkOffset;
            let end = start;
            for (; end < source.byteLength; end++) {
                const value = source[end];
                while (matched > 0 && value !== delimiter[matched]) {
                    matched = prefix[matched - 1];
                }
                if (value === delimiter[matched]) {
                    matched++;
                }
                if (matched === delimiter.byteLength) {
                    end++;
                    const chunk = source.subarray(start, end);
                    this.advance(chunk.byteLength);
                    if (chunks.length === 0) {
                        return chunk;
                    }
                    chunks.push(chunk);
                    byteLength += chunk.byteLength;
                    const result = new Uint8Array(byteLength);
                    let offset = 0;
                    for (const part of chunks) {
                        result.set(part, offset);
                        offset += part.byteLength;
                    }
                    return result;
                }
            }

            const chunk = source.subarray(start, end);
            chunks.push(chunk);
            byteLength += chunk.byteLength;
            this.advance(chunk.byteLength);
        }

        throw new Error('Stream ended unexpectedly');
    }

    async readExact(byteLength: number) {
        if (!Number.isSafeInteger(byteLength) || byteLength < 0) {
            throw new RangeError(`Invalid stream read length: ${byteLength}`);
        }
        if (byteLength === 0) {
            return new Uint8Array(0);
        }
        if (!(await this.ensureChunk())) {
            throw new Error('Stream ended unexpectedly');
        }

        const available = this.chunk!.byteLength - this.chunkOffset;
        if (byteLength <= available) {
            const result = this.chunk!.subarray(this.chunkOffset, this.chunkOffset + byteLength);
            this.advance(byteLength);
            return result;
        }

        const result = new Uint8Array(byteLength);
        await this.readInto(result);
        return result;
    }

    async readUint32(littleEndian: boolean = true) {
        const buffer = await this.readExact(4);
        return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength).getUint32(0, littleEndian);
    }
}

export interface ChunkDecoder {
    init(): Promise<[number, number]> | [number, number]; // [totals, itemSize]
    decode(offset: number, counts: number, buffer: Uint8Array): void;
}

export class StreamChunkDecoder {
    constructor(private cursor: ByteStreamCursor) {}

    async decode(decoders: ChunkDecoder[]) {
        for (const decoder of decoders) {
            const [totals, itemSize] = await decoder.init();
            if (totals === 0 || itemSize === 0) {
                continue;
            }

            const pending = new Uint8Array(itemSize);
            let pendingByteLength = 0;
            let decoded = 0;
            await this.cursor.readChunks(totals * itemSize, chunk => {
                let chunkOffset = 0;
                if (pendingByteLength > 0) {
                    const copyLength = Math.min(itemSize - pendingByteLength, chunk.byteLength);
                    pending.set(chunk.subarray(0, copyLength), pendingByteLength);
                    pendingByteLength += copyLength;
                    chunkOffset += copyLength;
                    if (pendingByteLength === itemSize) {
                        decoder.decode(decoded, 1, pending);
                        decoded++;
                        pendingByteLength = 0;
                    }
                }

                const counts = Math.floor((chunk.byteLength - chunkOffset) / itemSize);
                if (counts > 0) {
                    const batchByteLength = counts * itemSize;
                    decoder.decode(decoded, counts, chunk.subarray(chunkOffset, chunkOffset + batchByteLength));
                    decoded += counts;
                    chunkOffset += batchByteLength;
                }

                if (chunkOffset < chunk.byteLength) {
                    const remainder = chunk.subarray(chunkOffset);
                    pending.set(remainder);
                    pendingByteLength = remainder.byteLength;
                }
            });

            if (pendingByteLength !== 0 || decoded !== totals) {
                throw new Error(`Invalid stream data: expected ${totals} items, got ${decoded}`);
            }
        }
    }
}
