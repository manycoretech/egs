import { deferred } from '@qunhe/egs-lib';
import {
    type SplatData,
    RawSplatData,
    CompressedSplatData,
    SuperCompressedSplatData,
    SogSplatData,
} from './splat/index.js';
import { EszFile, KsplatFile, LccFile, Lcc2File, PlyFile, SogFile, SplatFile, SpzFile } from './file/index.js';
import { getLcc2References } from './file/lcc2.js';
import type { SogMetadataV1, SogMetadataV2 } from './file/sog.js';
import type { SogMetadata as SogDataMetadata } from './splat/SogSplatData.js';
import { type IFile, type IData, SplatFileType, SplatPackType } from './types.js';
import { detectSplatFileType, isUrl } from './utils/file.js';
import { SH_MAPS } from './utils/splat.js';
import {
    type FileContext,
    probeZipStream,
    readZipIndex,
    openZipEntry,
    resolveFilePath,
    getFileEntry,
} from './utils/zip.js';

export interface SplatFileInput {
    type: SplatFileType;
    stream: ReadableStream<Uint8Array>;
    contentLength: number;
    context?: FileContext;
}

export function createSplatFile(type: SplatFileType, lodLevel: number = 0): IFile {
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
        case SplatFileType.LCC2: {
            return new Lcc2File(lodLevel);
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

export async function prepareSplatFiles(
    type: SplatFileType,
    stream: ReadableStream<Uint8Array>,
    contentLength: number,
    includeOtherFormats: boolean = false,
    context?: FileContext,
): Promise<SplatFileInput[]> {
    const { isZip, stream: source } = await probeZipStream(stream);
    if (!isZip) {
        return [{ type, stream: source, contentLength, context }];
    }

    const files = await readZipIndex(source);
    const selected: { path: string; type: SplatFileType }[] = [];
    const types = new Set<SplatFileType>();
    const dependencies = new Set<string>();
    for (const [path, entry] of Object.entries(files)) {
        if (path.endsWith('.zip')) {
            continue;
        }
        const fileType = detectSplatFileType(path, entry);
        if (fileType === undefined) {
            continue;
        }
        types.add(fileType);
        if (includeOtherFormats || fileType === type) {
            selected.push({ path, type: fileType });
        }
        // Scene payloads belong to their manifest, even when other formats are enabled.
        if (includeOtherFormats && fileType === SplatFileType.LCC2) {
            const meta = JSON.parse(new TextDecoder().decode(entry));
            for (const reference of getLcc2References(meta)) {
                dependencies.add(resolveFilePath(path, reference));
            }
        }
    }
    if (types.size > 1 && !types.has(SplatFileType.LCC2)) {
        console.warn(
            `ZIP contains multiple splat formats: ${[...types].map(type => SplatFileType[type]).join(', ')}. ` +
                `Loading ${includeOtherFormats ? 'all independent files' : SplatFileType[type]}.`,
        );
    }
    const result: SplatFileInput[] = [];
    for (const file of selected) {
        if (dependencies.has(file.path)) {
            continue;
        }
        const entry = files[file.path];
        // A nested SOG remains one asset: only its meta is passed to SogFile.
        result.push(
            ...(await prepareSplatFiles(file.type, openZipEntry(entry), entry.byteLength, false, {
                path: file.path,
                files,
            })),
        );
    }
    if (!result.length) {
        throw new Error(`No ${SplatFileType[type]} files found in the ZIP archive.`);
    }
    return result;
}

async function readSogData(stream: ReadableStream<Uint8Array>, data: SogSplatData, context?: FileContext) {
    const file = new SogFile();
    await file.load(stream);
    const { meta, counts, shDegree, version } = file;
    let splatMeta: SogDataMetadata;
    if (version === 1) {
        const { scales, sh0, shN } = meta as SogMetadataV1;
        splatMeta = {
            version: 1,
            counts,
            shDegree,
            means: {
                mins: [meta.means.mins[0], meta.means.mins[1], meta.means.mins[2]],
                maxs: [meta.means.maxs[0], meta.means.maxs[1], meta.means.maxs[2]],
            },
            scales: {
                mins: [scales.mins[0], scales.mins[1], scales.mins[2]],
                maxs: [scales.maxs[0], scales.maxs[1], scales.maxs[2]],
            },
            sh0: {
                mins: [sh0.mins[0], sh0.mins[1], sh0.mins[2], sh0.mins[3]],
                maxs: [sh0.maxs[0], sh0.maxs[1], sh0.maxs[2], sh0.maxs[3]],
            },
            shN: shN ? { mins: shN.mins, maxs: shN.maxs } : undefined,
        };
    } else {
        const { scales, sh0, shN } = meta as SogMetadataV2;
        splatMeta = {
            version: 2,
            counts,
            shDegree,
            means: {
                mins: [meta.means.mins[0], meta.means.mins[1], meta.means.mins[2]],
                maxs: [meta.means.maxs[0], meta.means.maxs[1], meta.means.maxs[2]],
            },
            scales: { codebook: scales.codebook },
            sh0: { codebook: sh0.codebook },
            shN: shN ? { codebook: shN.codebook } : undefined,
        };
    }
    const images = await Promise.all(
        file.texturePaths.map(async path => {
            if (isUrl(path)) {
                const response = await fetch(path);
                return new Uint8Array(await response.arrayBuffer());
            }
            if (!context) {
                throw new Error(`Cannot load texture: ${path}`);
            }
            return getFileEntry(context, path);
        }),
    );
    data.load(splatMeta, images[0], images[1], images[2], images[3], images[4], images[5], images[6]);
}

export async function readSplatFiles(files: SplatFileInput[], data: IData, lodLevel: number = 0): Promise<void> {
    if (data instanceof SogSplatData) {
        const file = files[0];
        if (file.type !== SplatFileType.SOG) {
            throw new Error('SOG pack type requires a single SOG asset. Use a decoded pack type to merge files.');
        }
        await readSogData(file.stream, data, file.context);
        return;
    }
    if (files.length === 1) {
        const { type, stream, contentLength, context } = files[0];
        await createSplatFile(type, lodLevel).read(stream, contentLength, data, context);
        return;
    }

    const initialized = deferred();
    initialized.promise.catch(() => {});
    let counts = 0;
    let pending = files.length;
    let shDegree = 0;
    let offset = 0;
    const reads: Promise<void>[] = files.map(async (file, index) => {
        let paddedSh: number[] = [];
        const target: IData = {
            get counts() {
                return data.counts;
            },
            get shDegree() {
                return data.shDegree;
            },
            async initBlock(count, degree) {
                counts += count;
                shDegree = Math.max(shDegree, degree);
                if (--pending === 0) {
                    offset = await data.initBlock(counts, shDegree);
                    initialized.resolve();
                }
                await initialized.promise;
                if (index > 0) {
                    await reads[index - 1];
                }
                const blockOffset = offset;
                offset += count;
                paddedSh = new Array(SH_MAPS[data.shDegree]).fill(0);
                if (degree === 0 && data.shDegree > 0) {
                    for (let i = 0; i < count; i++) {
                        data.setShN(blockOffset + i, paddedSh);
                    }
                }
                return blockOffset;
            },
            finishBlock() {},
            set: data.set.bind(data),
            setCenter: data.setCenter.bind(data),
            setScale: data.setScale.bind(data),
            setQuat: data.setQuat.bind(data),
            setColor: data.setColor.bind(data),
            setAlpha: data.setAlpha.bind(data),
            setShN(i, sh) {
                if (sh.length < paddedSh.length) {
                    paddedSh.fill(0, sh.length);
                    for (let j = 0; j < sh.length; j++) {
                        paddedSh[j] = sh[j];
                    }
                    data.setShN(i, paddedSh);
                } else {
                    data.setShN(i, sh);
                }
            },
            get: data.get.bind(data),
            getCenter: data.getCenter.bind(data),
            getScale: data.getScale.bind(data),
            getQuat: data.getQuat.bind(data),
            getColor: data.getColor.bind(data),
            getAlpha: data.getAlpha.bind(data),
            getShN: data.getShN.bind(data),
        };
        await createSplatFile(file.type, lodLevel).read(file.stream, file.contentLength, target, file.context);
    });
    try {
        await Promise.all(reads);
    } catch (error) {
        initialized.reject(error);
        await Promise.allSettled(reads);
        throw error;
    }
    data.finishBlock();
}
