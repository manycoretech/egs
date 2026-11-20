import { type Splat, TextureFormat, type Viewer, __INTERNAL__ } from '@qunhe/egs';
import { logger } from '@qunhe/egs-lib';
import type { SplatData } from '@qunhe/egs-splat-loader';
import { createSplat } from '../SplatData.js';

export type LoadResourceFn = (url: string, signal?: AbortSignal) => Promise<SplatData>;

interface Resource {
    state: 'loading' | 'ready' | 'failed';
    refs: number;
    controller: AbortController;
    promise: Promise<void>;
    source?: Splat;
    error?: unknown;
}

export class ResourceManager {
    private loadResource: LoadResourceFn;
    private permanentFiles: Set<number>;
    private resources: string[];
    private resourceCache = new Map<number, Resource>();
    private isDestroyed = false;
    private onChange: () => void;
    private renderer?: __INTERNAL__.IRenderer;

    constructor(
        resources: string[],
        permanentFiles: number[],
        loadResource: LoadResourceFn,
        viewer?: Viewer,
        onChange = () => {},
    ) {
        this.resources = resources;
        this.permanentFiles = new Set(permanentFiles);
        this.loadResource = loadResource;
        this.onChange = onChange;
        this.renderer = viewer?._getEngine().renderer;
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
        const source = resource.source!;
        let splat: Splat;
        if (source instanceof __INTERNAL__.SogSplat) {
            splat = new __INTERNAL__.SogSplat(
                source.meta,
                source.meansL,
                source.meansU,
                source.quats,
                source.scales,
                source.colors,
            );
            splat.counts = counts;
        } else if (source instanceof __INTERNAL__.CompressedSplat) {
            const [splat1, splat2, sh1, sh2, sh3, sh4] = source.extrasTex;
            splat = new __INTERNAL__.CompressedSplat(counts, source.shDegree, splat1, splat2, sh1, sh2, sh3, sh4);
        } else {
            const [splat1, sh1, sh2] = source.extrasTex;
            splat = new __INTERNAL__.SuperCompressedSplat(counts, source.shDegree, splat1, sh1, sh2);
        }
        splat.sourceId = source.id;
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
            const source = resource.source!;
            idlePointBudget -= source.counts;
            if (idlePointBudget < 0) {
                source.destroy();
                this.resourceCache.delete(idx);
            }
        }
    }

    resetRenderer(renderer: __INTERNAL__.IRenderer) {
        if (this.renderer === renderer) {
            return;
        }
        this.renderer = renderer;
        for (const [idx, resource] of this.resourceCache) {
            if (resource.state === 'loading') {
                resource.controller.abort();
            } else if (
                resource.source?.extrasTex.some(
                    texture =>
                        !texture.getLevelLayerSource(0, texture.format === TextureFormat.Rgba8Unorm ? 0 : undefined),
                )
            ) {
                resource.source.destroy();
                this.resourceCache.delete(idx);
            }
        }
    }

    destroy() {
        this.isDestroyed = true;
        for (const resource of this.resourceCache.values()) {
            resource.controller.abort();
            resource.source?.destroy();
        }
        this.resourceCache.clear();
    }

    private async prepare(idx: number, resource: Resource) {
        const { signal } = resource.controller;
        try {
            const { renderer } = this;
            if (renderer) {
                await renderer.rendererStatus.initialized;
            }
            const data = await this.loadResource(this.resources[idx], signal);
            if (signal.aborted) {
                await data.stream?.chunks?.cancel(signal.reason);
                signal.throwIfAborted();
            }
            resource.source = await createSplat(data, renderer);
            signal.throwIfAborted();
            resource.state = 'ready';
        } catch (error) {
            resource.source?.destroy();
            resource.state = 'failed';
            resource.error = error;
            if (signal.aborted) {
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
