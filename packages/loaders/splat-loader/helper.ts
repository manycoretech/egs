import { type SplatData, RawSplatData, CompressedSplatData, SuperCompressedSplatData, SogSplatData } from './splat';
import { EszFile, KsplatFile, LccFile, PlyFile, SogFile, SplatFile, SpzFile } from './file';
import { type IFile, SplatFileType, SplatPackType } from './utils';

export function createSplatFile(type: SplatFileType): IFile {
    switch (type) {
        case SplatFileType.PLY: {
            return new PlyFile();
        }
        case SplatFileType.SPZ: {
            return new SpzFile();
        }
        case SplatFileType.KSPLAT: {
            return new KsplatFile();
        }
        case SplatFileType.SPLAT: {
            return new SplatFile();
        }
        case SplatFileType.SOG: {
            return new SogFile();
        }
        case SplatFileType.LCC: {
            return new LccFile();
        }
        case SplatFileType.ESZ: {
            return new EszFile();
        }
    }
}

export function createSplatData(type: SplatPackType, maxShDegree?: number, maxTextureSize?: number): SplatData {
    switch (type) {
        case SplatPackType.Raw: {
            return new RawSplatData(maxShDegree, maxTextureSize);
        }
        case SplatPackType.Compressed: {
            return new CompressedSplatData(maxShDegree, maxTextureSize);
        }
        case SplatPackType.SuperCompressed: {
            return new SuperCompressedSplatData(maxShDegree, maxTextureSize);
        }
        case SplatPackType.Sog: {
            return new SogSplatData(maxShDegree, maxTextureSize);
        }
    }
}
