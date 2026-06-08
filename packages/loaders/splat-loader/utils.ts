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

const DEPTH_INFINITY = 0x7bff;
const buckets = new Uint32Array(0x10000);
export function sortSplats(counts: number, sorting: Uint16Array, order: Uint32Array): number {
    buckets.fill(0);

    for (let i = 0; i < counts; i++) {
        buckets[sorting[i]]++;
    }
    let activeCount = 0;
    for (let i = DEPTH_INFINITY - 1; i >= 0; i--) {
        const v = buckets[i];
        buckets[i] = activeCount;
        activeCount += v;
    }
    for (let i = 0; i < counts; i++) {
        const v = sorting[i];
        if (v < DEPTH_INFINITY) {
            order[buckets[v]++] = i;
        }
    }

    return activeCount;
}

const DEPTH_INFINITY_F32 = 0x7f800000 - 1;
const RADIX_BITS = 16;
const RADIX = 1 << RADIX_BITS;
const RADIX_MASK = RADIX - 1;
const HI_OFFSET = RADIX;
let bucket16: Uint32Array | undefined; // [lo buckets | hi buckets]
let scratch: Uint32Array | undefined;
export function sort32Splats(counts: number, sorting: Uint32Array, order: Uint32Array): number {
    if (!bucket16) {
        bucket16 = new Uint32Array(RADIX * 2);
    }
    if (!scratch || scratch.length < counts) {
        scratch = new Uint32Array(counts);
    }
    const buckets = bucket16;
    buckets.fill(0);

    let activeCount = 0;

    for (let i = 0; i < counts; ++i) {
        const key = sorting[i];
        if (key >= DEPTH_INFINITY_F32) {
            continue;
        }

        const inv = ~key >>> 0;
        buckets[inv & RADIX_MASK] += 1;
        buckets[HI_OFFSET + (inv >>> RADIX_BITS)] += 1;
        order[activeCount++] = i;
    }

    // Pass 1: lo 16 bits
    let offset = 0;
    for (let b = 0; b < RADIX; ++b) {
        const count = buckets[b];
        buckets[b] = offset;
        offset += count;
    }

    for (let i = 0; i < activeCount; ++i) {
        const idx = order[i];
        const inv = ~sorting[idx] >>> 0;
        scratch[buckets[inv & RADIX_MASK]++] = idx;
    }

    // Pass 2: hi 16 bits
    offset = 0;
    for (let b = 0; b < RADIX; ++b) {
        const p = HI_OFFSET + b;
        const count = buckets[p];
        buckets[p] = offset;
        offset += count;
    }

    for (let i = 0; i < activeCount; ++i) {
        const idx = scratch[i];
        const inv = ~sorting[idx] >>> 0;
        order[buckets[HI_OFFSET + (inv >>> RADIX_BITS)]++] = idx;
    }

    return activeCount;
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
