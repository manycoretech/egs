import { deferred } from '@qunhe/egs-lib';
import { type SourceTexture, type Splat, __INTERNAL__ } from '@qunhe/egs';
import { type SplatData, SplatPackType, RawSplatData, CompressedSplatData, SuperCompressedSplatData, SogSplatData } from '@qunhe/egs-splat-loader';
import { createSourceTextureFromSampler, createSourceTextureFromImageSource } from '../SplatData';

interface ResourceData {
    type: SplatPackType;
    counts: number;
    shDegree: number;
    textures: SourceTexture[];
    extras: any[];
}

type LoadResourceFn = (url: string) => Promise<SplatData>;

export class ResourceManager {
    private loadResource: LoadResourceFn;
    private permanentFiles: number[];
    private resources: string[];
    private resourceCache: Array<{ isProtected: boolean, refs: number, data: Promise<ResourceData> } | undefined> = [];

    constructor(
        resources: string[],
        permanentFiles: number[],
        loadResource: LoadResourceFn,
    ) {
        this.resources = resources;
        this.permanentFiles = permanentFiles;
        this.loadResource = loadResource;
    }

    has = (idx: number) => {
        return !!this.resourceCache[idx];
    };

    load = async (idx: number) => {
        const { permanentFiles, resources, resourceCache } = this;
        let cache = resourceCache[idx];
        if (cache) {
            cache.refs++;
            return cache.data;
        }

        const { promise, resolve, reject } = deferred<ResourceData>();
        cache = resourceCache[idx] = {
            isProtected: permanentFiles.includes(idx),
            refs: 1,
            data: promise,
        };

        try {
            const splatData = await this.loadResource(resources[idx]);
            const { counts, shDegree, samplers, extras = [] } = splatData.serialize();
            let textures: SourceTexture[] = [];
            let type: SplatPackType;
            if (splatData instanceof RawSplatData) {
                throw new Error('RawSplatData is not supported in LodSplat');
            } else if (splatData instanceof CompressedSplatData) {
                type = SplatPackType.Compressed;
                textures = samplers.map(v => createSourceTextureFromSampler(v));
            } else if (splatData instanceof SuperCompressedSplatData) {
                type = SplatPackType.SuperCompressed;
                textures = samplers.map(v => createSourceTextureFromSampler(v));
            } else if (splatData instanceof SogSplatData) {
                type = SplatPackType.Sog;
                textures = await Promise.all(samplers.map(v => createSourceTextureFromImageSource(v.source)));
            } else {
                throw new Error('Unknown SplatData type');
            }
            resolve({ type, counts, shDegree, textures, extras });
        } catch (error) {
            this.release(idx);
            reject(error);
        }

        return cache.data;
    };

    release = (idx: number) => {
        const { resourceCache } = this;
        const cache = resourceCache[idx];
        if (!cache) {
            return;
        }
        cache.refs--;
        if (cache.refs === 0 && !cache.isProtected) {
            resourceCache[idx] = undefined;
            cache.data.then(data => {
                data.textures.forEach(v => v.freeGPU());
            });
        }
    };

    loadSplat = async (idx: number, offset: number, counts: number) => {
        const { type, shDegree, textures, extras } = await this.load(idx);
        let splat: Splat;
        switch (type) {
            case SplatPackType.Raw: {
                throw new Error('RawSplatData is not supported create splat.');
            }
            case SplatPackType.Compressed:
                splat = new __INTERNAL__.CompressedSplat(
                    counts,
                    shDegree,
                    textures[0], textures[1],
                    shDegree >= 1 ? textures[2] : undefined,
                    shDegree >= 2 ? textures[3] : undefined,
                    shDegree >= 3 ? textures[4] : undefined,
                    shDegree >= 3 ? textures[5] : undefined,
                );
                break;
            case SplatPackType.SuperCompressed: {
                splat = new __INTERNAL__.SuperCompressedSplat(
                    counts,
                    shDegree,
                    textures[0],
                    shDegree >= 1 ? textures[1] : undefined,
                    shDegree >= 3 ? textures[2] : undefined,
                );
                break;
            }
            case SplatPackType.Sog: {
                const [meansL, meansU, scales, quats, sh0, shNLabels, shNCentroids] = textures;
                splat = new __INTERNAL__.SogSplat(
                    extras[0],
                    meansL, meansU, quats, scales,
                    sh0, shNLabels, shNCentroids,
                );
                break;
            }
        }
        splat.counts = counts;
        splat.offset = offset;
        splat.autoFreeResourceOnGpuPacked = false;
        return splat;
    };
}
