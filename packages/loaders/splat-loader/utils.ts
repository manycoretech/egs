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
    let activeSplats = 0;
    for (let i = DEPTH_INFINITY - 1; i >= 0; i--) {
        const v = buckets[i];
        buckets[i] = activeSplats;
        activeSplats += v;
    }
    for (let i = 0; i < counts; i++) {
        const v = sorting[i];
        if (v < DEPTH_INFINITY) {
            order[buckets[v]++] = i;
        }
    }

    return activeSplats;
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
        case 'ply': { type = SplatFileType.PLY; break; }
        case 'spz': { type = SplatFileType.SPZ; break; }
        case 'splat': { type = SplatFileType.SPLAT; break; }
        case 'ksplat': { type = SplatFileType.KSPLAT; break; }
        case 'sog': { type = SplatFileType.SOG; break; }
        case 'lcc': { type = SplatFileType.LCC; break; }
        case 'esz': { type = SplatFileType.ESZ; break; }
    }
    return type;
}
