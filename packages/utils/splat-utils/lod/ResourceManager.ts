import { type SourceTexture, type Splat, __INTERNAL__ } from '@qunhe/egs';
import { logger } from '@qunhe/egs-lib';
import {
    type SplatData,
    RawSplatData,
    CompressedSplatData,
    SuperCompressedSplatData,
    SogSplatData,
} from '@qunhe/egs-splat-loader';
import { createSourceTextureFromSampler, createSourceTextureFromImageSource } from '../SplatData.js';

interface ResourceData {
    counts: number;
    textures: SourceTexture[];
    createSplat: (counts: number) => Splat;
}

export type LoadResourceFn = (url: string, signal?: AbortSignal) => Promise<SplatData>;

interface Resource {
    state: 'loading' | 'ready' | 'failed';
    refs: number;
    controller: AbortController;
    promise: Promise<void>;
    data?: ResourceData;
    error?: unknown;
}

export class ResourceManager {
    private loadResource: LoadResourceFn;
    private permanentFiles: Set<number>;
    private resources: string[];
    private resourceCache = new Map<number, Resource>();
    private isDestroyed = false;
    private onChange: () => void;

    constructor(resources: string[], permanentFiles: number[], loadResource: LoadResourceFn, onChange = () => {}) {
        this.resources = resources;
        this.permanentFiles = new Set(permanentFiles);
        this.loadResource = loadResource;
        this.onChange = onChange;
    }

    has(idx: number) {
        return this.resourceCache.get(idx)?.state === 'ready';
    }

    getState(idx: number) {
        return this.resourceCache.get(idx)?.state ?? 'unloaded';
    }

    get loadingCount() {
        let count = 0;
        for (const resource of this.resourceCache.values()) {
            if (resource.state === 'loading') {
                count++;
            }
        }
        return count;
    }

    request(indices: Iterable<number>, parallel: number) {
        let loading = this.loadingCount;
        let error: unknown;
        for (const idx of indices) {
            const resource = this.resourceCache.get(idx);
            if (resource) {
                error ??= resource.error;
                continue;
            }
            if (loading >= parallel) {
                continue;
            }
            void this.load(idx).catch(() => {});
            loading += this.getState(idx) === 'loading' ? 1 : 0;
        }
        return error;
    }

    load(idx: number): Promise<void> {
        const existing = this.resourceCache.get(idx);
        if (existing) {
            return existing.promise;
        }
        if (this.isDestroyed) {
            return Promise.reject(new Error('LOD resources have been destroyed.'));
        }
        const resource: Resource = {
            state: 'loading',
            refs: 0,
            controller: new AbortController(),
            promise: Promise.resolve(),
        };
        this.resourceCache.set(idx, resource);
        resource.promise = this.prepare(idx, resource);
        return resource.promise;
    }

    createSplat(idx: number, offset: number, counts: number) {
        const resource = this.resourceCache.get(idx);
        if (resource?.state !== 'ready') {
            throw new Error(`LOD resource ${idx} is not ready.`);
        }
        const splat = resource.data!.createSplat(counts);
        splat.counts = counts;
        splat.offset = offset;
        splat.autoFreeResourceOnGpuPacked = false;
        resource.refs++;
        return splat;
    }

    release(idx: number) {
        const resource = this.resourceCache.get(idx);
        if (!resource || resource.refs === 0) {
            return;
        }
        resource.refs--;
        this.resourceCache.delete(idx);
        this.resourceCache.set(idx, resource);
    }

    prune(required: Set<number>, idlePointBudget: number) {
        for (const [idx, resource] of Array.from(this.resourceCache).reverse()) {
            if (resource.refs || required.has(idx)) {
                continue;
            }
            if (resource.state === 'failed') {
                this.resourceCache.delete(idx);
                continue;
            }
            if (this.permanentFiles.has(idx)) {
                continue;
            }
            if (resource.state === 'loading') {
                resource.controller.abort();
                continue;
            }
            const data = resource.data!;
            idlePointBudget -= data.counts;
            if (idlePointBudget < 0) {
                data.textures.forEach(texture => texture.freeGPU());
                this.resourceCache.delete(idx);
            }
        }
    }

    destroy() {
        this.isDestroyed = true;
        for (const resource of this.resourceCache.values()) {
            resource.controller.abort();
            resource.data?.textures.forEach(texture => texture.freeGPU());
        }
        this.resourceCache.clear();
    }

    private async prepare(idx: number, resource: Resource) {
        const textures: SourceTexture[] = [];
        try {
            const splatData = await this.loadResource(this.resources[idx], resource.controller.signal);
            resource.controller.signal.throwIfAborted();
            if (splatData instanceof RawSplatData) {
                throw new Error('RawSplatData is not supported in LodSplat');
            }
            const { counts, shDegree, samplers, extras = [] } = splatData.serialize();
            if (splatData instanceof SogSplatData) {
                const images = await Promise.allSettled(
                    samplers.map(async (sampler, i) => {
                        textures[i] = await createSourceTextureFromImageSource(sampler.source);
                    }),
                );
                const failure = images.find(image => image.status === 'rejected');
                if (failure) {
                    throw failure.reason;
                }
            } else if (splatData instanceof CompressedSplatData || splatData instanceof SuperCompressedSplatData) {
                samplers.forEach(sampler => textures.push(createSourceTextureFromSampler(sampler)));
            } else {
                throw new Error('Unknown SplatData type');
            }
            resource.controller.signal.throwIfAborted();

            let createSplat: ResourceData['createSplat'];
            if (splatData instanceof CompressedSplatData) {
                createSplat = counts =>
                    new __INTERNAL__.CompressedSplat(
                        counts,
                        shDegree,
                        textures[0],
                        textures[1],
                        shDegree >= 1 ? textures[2] : undefined,
                        shDegree >= 2 ? textures[3] : undefined,
                        shDegree >= 3 ? textures[4] : undefined,
                        shDegree >= 3 ? textures[5] : undefined,
                    );
            } else if (splatData instanceof SuperCompressedSplatData) {
                createSplat = counts =>
                    new __INTERNAL__.SuperCompressedSplat(
                        counts,
                        shDegree,
                        textures[0],
                        shDegree >= 1 ? textures[1] : undefined,
                        shDegree >= 3 ? textures[2] : undefined,
                    );
            } else {
                createSplat = () => {
                    const [meansL, meansU, scales, quats, sh0, shNLabels, shNCentroids] = textures;
                    return new __INTERNAL__.SogSplat(
                        extras[0],
                        meansL,
                        meansU,
                        quats,
                        scales,
                        sh0,
                        shNLabels,
                        shNCentroids,
                    );
                };
            }
            resource.data = { counts, textures, createSplat };
            resource.state = 'ready';
        } catch (error) {
            textures.forEach(texture => texture.freeGPU());
            resource.state = 'failed';
            resource.error = error;
            if (resource.controller.signal.aborted) {
                this.resourceCache.delete(idx);
            } else {
                logger.warn('Failed to load LOD resource', error);
            }
            throw error;
        } finally {
            this.onChange();
        }
    }
}
