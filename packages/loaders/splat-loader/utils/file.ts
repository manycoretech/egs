import { unzipSync } from 'fflate';
import { SplatFileType } from '../types.js';

export function isUrl(str: string): boolean {
    try {
        const { protocol } = new URL(str);
        return protocol === 'http:' || protocol === 'https:';
    } catch {
        return false;
    }
}

export function detectSplatFileType(filename: string, buffer: Uint8Array): SplatFileType | undefined {
    let ext = filename.split('.').pop();
    if (ext === 'zip') {
        let type: SplatFileType | undefined;
        unzipSync(buffer, {
            filter: file => {
                if (
                    !file.name.endsWith('/') &&
                    !file.name.endsWith('.zip') &&
                    type !== SplatFileType.LCC &&
                    type !== SplatFileType.LCC2
                ) {
                    type = detectSplatFileType(file.name, new Uint8Array());
                }
                return false;
            },
        });
        return type;
    } else if (ext === 'json' && !!buffer.byteLength) {
        // fast check sog json
        const json = JSON.parse(new TextDecoder().decode(buffer));
        const isSogMetadata = ['means', 'scales', 'quats', 'sh0'].every(k => !!json[k]);
        if (isSogMetadata) {
            ext = 'sog';
        }
    }

    switch (ext) {
        case 'ply': {
            return SplatFileType.PLY;
        }
        case 'spz': {
            return SplatFileType.SPZ;
        }
        case 'splat': {
            return SplatFileType.SPLAT;
        }
        case 'ksplat': {
            return SplatFileType.KSPLAT;
        }
        case 'sog': {
            return SplatFileType.SOG;
        }
        case 'lcc': {
            return SplatFileType.LCC;
        }
        case 'lcc2': {
            return SplatFileType.LCC2;
        }
        case 'esz': {
            return SplatFileType.ESZ;
        }
    }
    return undefined;
}
