import { type Deferred, deferred, logger } from '@qunhe/egs-lib';
import {
    Box3,
    Vector3,
    type Camera,
    Object3D,
    Frustum,
    Matrix4,
    SplatSortedEvent,
    type Splat,
    Vector4,
    type IViewerContext,
    SplatModifier,
    RendererBackend,
    ContextLostEvent,
    ResetRendererEvent,
    __INTERNAL__,
} from '@qunhe/egs';
import { parseSplatData, detectSplatFileType } from '@qunhe/egs-splat-loader';
import { ResourceManager, type LoadResourceFn } from './ResourceManager.js';
import { computeVoxelOcclusion, validateVoxel, type LodVoxelData, type ParseLodVoxelFn } from './Voxel.js';

export type { LodVoxelData, ParseLodVoxelFn } from './Voxel.js';

interface IBox {
    min: [number, number, number];
    max: [number, number, number];
}

export interface LodMeta {
    magicCode: 2500660;
    type: 'lod-splat';
    version: string;
    counts: number;
    shDegree: number;
    levels: number;
    files: string[];
    /** Optional voxel file URLs, loaded by the external parser. */
    voxels?: string[];
    forwardBox: IBox;
    permanentFiles: number[];
    tree: Array<{
        bound: IBox;
        lods: Array<{
            file: number;
            offset: number;
            count: number;
        }>;
    }>;
}

export interface LodConfig {
    minLevel: number;
    /** Finest level admitted while the camera is moving. Zero is the finest level. */
    movingMinLevel: number;
    maxBudget: number;
    /** Stop refinement at one weighted render pixel per point. */
    pixelLimitEnabled: boolean;
    /** Stability duration in nominal 60 Hz ticks, independent of the caller's tick frequency. */
    hysteresisTicks: number;
    schedulerParallelCounts: number;
    schedulerExistingTaskLimit: number;
    schedulerMinDuration: number;
    mergeNodeEnabled: boolean;
    frustumCullingEnabled: boolean;
    debuggerEnabled: boolean;
}

const LOD_LEVEL_COLORS = [
    new Vector4(1.0, 0.2, 0.0, 1),
    new Vector4(1.0, 1.0, 0.0, 1),
    new Vector4(0.0, 1.0, 0.4, 1),
    new Vector4(0.0, 0.8, 1.0, 1),
    new Vector4(0.0, 0.4, 1.0, 1),
    new Vector4(0.0, 0.0, 1.0, 1),
];

const OverrideModifier = new SplatModifier(
    'Override',
    {
        color: new Vector4(0, 0, 0, 1),
    },
    (input, uniform) => ({
        content: `${input.splat}.color = ${uniform.color};`,
    }),
);

const BOX_EDGES = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7];

async function DefaultLoadResource(url: string, signal?: AbortSignal) {
    const type = detectSplatFileType(url, new Uint8Array());
    const response = await fetch(url, { signal });
    if (!response.ok) {
        throw new Error('Failed to load LOD resource: ' + response.status + ' ' + url);
    }
    return parseSplatData(type!, {
        stream: response.body!,
        contentLength: Number(response.headers.get('Content-Length')),
    });
}

interface LodNode {
    box: Box3;
    lods: Array<{
        resourceIdx: number;
        offset: number;
        counts: number;
    }>;
    currentLevel: number;
    targetWeight: number;
    targetLevel: number;
    targetSince: number;
    visible: boolean;
    occluded: boolean;
    proxy?: LodProxy;
}

interface LodProxy {
    resourceIdx: number;
    offset: number;
    counts: number;
    nodeStart: number;
    nodeEnd: number;
    splat: Splat;
}

interface Replacement {
    oldProxies: LodProxy[];
    newProxies: LodProxy[];
    levels: Map<number, number>;
    pending: Map<Splat, () => void>;
}

export class LodSplat {
    private minLevel = 0;
    private movingMinLevel = 2;
    private maxLevel: number;
    private maxBudget = 3_000_000;
    private pixelLimitEnabled = true;
    private hysteresisTicks = 4;
    private schedulerParallelCounts = 4;
    private schedulerExistingTaskLimit = 64;
    private schedulerMinDuration = 160;
    private mergeNodeEnabled = true;
    private frustumCullingEnabled = true;
    private debuggerEnabled = false;

    private viewerCtx?: IViewerContext;
    private gpuSorting: boolean;
    private resourceManager: ResourceManager;
    private voxels?: LodVoxelData[];
    private voxelLoading?: AbortController;
    private nodes: LodNode[];
    private proxies: LodProxy[] = [];
    private effectiveBudget: number = 0;
    private orderedNodes: number[];
    private viewMatrix = new Matrix4();
    private projectionMatrix = new Matrix4();
    private viewProjection = new Matrix4();
    private projectedCorners = Array.from({ length: 8 }, () => new Vector4());
    private viewportPixels = Infinity;
    private hasCamera = false;
    private viewDirty = false;
    private workDirty = true;
    private mergeDirty = true;
    private moving = false;
    private lastMotionTime = -Infinity;
    private lastScheduleTime = -Infinity;
    private nextCommitTime = 0;
    private nextWorkTime = Infinity;
    private pendingWork = true;
    private lastError?: unknown;
    private replacement?: Replacement;

    readonly container = new Object3D();

    constructor(
        meta: LodMeta,
        config: Partial<LodConfig> = {},
        viewerCtx?: IViewerContext,
        loadResource: LoadResourceFn = DefaultLoadResource,
        parseVoxel?: ParseLodVoxelFn,
    ) {
        this.maxLevel = meta.levels - 1;
        this.viewerCtx = viewerCtx;
        const engine = viewerCtx?.viewer._getEngine();
        this.gpuSorting = engine
            ? engine.renderer.backend === RendererBackend.WEBGPU_WASM
            : __INTERNAL__.Capabilities.IS_WEBGPU;
        engine?.on(ContextLostEvent, this.onContextLost);
        engine?.on(ResetRendererEvent, this.onRendererReset);
        this.resourceManager = new ResourceManager(meta.files, meta.permanentFiles, loadResource, () => {
            this.workDirty = true;
        });
        this.nodes = meta.tree.map(({ bound, lods }) => ({
            box: new Box3(
                new Vector3(bound.min[0], bound.min[1], bound.min[2]),
                new Vector3(bound.max[0], bound.max[1], bound.max[2]),
            ),
            lods: lods.map(v => ({ resourceIdx: v.file, offset: v.offset, counts: v.count })),
            currentLevel: -1,
            targetWeight: 0,
            targetLevel: -1,
            targetSince: 0,
            visible: false,
            occluded: false,
        }));
        this.orderedNodes = this.nodes.map((_, idx) => idx);
        this.setConfig(config);
        if (meta.voxels?.length && parseVoxel) {
            void this.loadVoxels(meta.voxels, parseVoxel);
        }
    }

    private async loadVoxels(urls: string[], parseVoxel: ParseLodVoxelFn) {
        const controller = (this.voxelLoading = new AbortController());
        try {
            const voxels = await Promise.all(
                urls.map(async url => {
                    const voxel = await parseVoxel(url, controller.signal);
                    validateVoxel(voxel);
                    return voxel;
                }),
            );
            if (!controller.signal.aborted) {
                this.voxels = voxels;
                this.viewDirty = true;
            }
        } catch (error) {
            if (!controller.signal.aborted) {
                logger.warn('Failed to load LOD voxel', error);
                controller.abort();
            }
        } finally {
            this.voxelLoading = undefined;
            this.workDirty = true;
        }
    }

    setConfig(config: Partial<LodConfig>) {
        this.minLevel = Math.min(this.maxLevel, Math.max(0, Math.floor(config.minLevel ?? this.minLevel)));
        this.movingMinLevel = Math.min(
            this.maxLevel,
            Math.max(0, Math.floor(config.movingMinLevel ?? this.movingMinLevel)),
        );
        this.maxBudget = config.maxBudget ?? this.maxBudget;
        this.pixelLimitEnabled = config.pixelLimitEnabled ?? this.pixelLimitEnabled;
        this.hysteresisTicks = Math.max(0, config.hysteresisTicks ?? this.hysteresisTicks);
        this.schedulerParallelCounts = Math.max(
            1,
            Math.floor(config.schedulerParallelCounts ?? this.schedulerParallelCounts),
        );
        this.schedulerExistingTaskLimit = Math.max(
            1,
            Math.floor(config.schedulerExistingTaskLimit ?? this.schedulerExistingTaskLimit),
        );
        this.schedulerMinDuration = Math.max(0, config.schedulerMinDuration ?? this.schedulerMinDuration);
        this.mergeNodeEnabled = config.mergeNodeEnabled ?? this.mergeNodeEnabled;
        this.frustumCullingEnabled = config.frustumCullingEnabled ?? this.frustumCullingEnabled;
        const debuggerEnabled = config.debuggerEnabled ?? this.debuggerEnabled;
        if (debuggerEnabled !== this.debuggerEnabled) {
            this.debuggerEnabled = debuggerEnabled;
            this.updateModifiers();
        }
        this.viewDirty = this.workDirty = true;
        this.mergeDirty = true;
    }

    private modifiers: SplatModifier[] = [];
    setModifiers(modifiers: SplatModifier[]) {
        this.modifiers = [...modifiers];
        this.updateModifiers();
    }

    private updateModifiers() {
        for (const proxy of this.proxies) {
            this.applyModifiers(proxy, this.nodes[proxy.nodeStart].currentLevel);
        }
        if (this.replacement) {
            for (const proxy of this.replacement.newProxies) {
                this.applyModifiers(proxy, this.replacement.levels.get(proxy.nodeStart)!);
            }
        }
    }

    private applyModifiers(proxy: LodProxy, level: number) {
        proxy.splat.setModifiers([
            ...this.modifiers,
            ...(this.debuggerEnabled
                ? [OverrideModifier.copy({ color: LOD_LEVEL_COLORS[level % LOD_LEVEL_COLORS.length] })]
                : []),
        ]);
    }

    private get stabilityDuration() {
        return this.hysteresisTicks * (1000 / 60);
    }

    private get realUsedBudget() {
        return this.proxies.reduce((sum, proxy) => sum + proxy.counts, 0);
    }

    private get movingFinestLevel() {
        return Math.max(this.minLevel, this.movingMinLevel);
    }

    private coverageLevel(node: LodNode) {
        return node.occluded ? Math.min(4, this.maxLevel) : this.maxLevel;
    }

    private desiredLevel(node: LodNode) {
        if (!node.visible) {
            return -1;
        }
        if (node.occluded) {
            return this.coverageLevel(node);
        }
        if (this.moving && node.targetLevel < this.movingFinestLevel) {
            // Motion limits new refinement; it does not evict already displayed fine detail.
            return node.currentLevel >= 0 && node.currentLevel < this.movingFinestLevel
                ? node.currentLevel
                : this.movingFinestLevel;
        }
        return node.targetLevel;
    }

    /** Publish the view; viewport uses nonnegative render pixels and defaults to the viewer's drawing buffer. */
    tick(camera: Camera, viewport?: { width: number; height: number }) {
        if (this.isDestroy) {
            return;
        }
        const size = viewport ?? this.viewerCtx?.viewer._getEngine().renderer.getDrawingBufferSize();
        const pixels = size ? size.width * size.height : Infinity;
        if (pixels !== this.viewportPixels) {
            this.viewportPixels = pixels;
            this.viewDirty = this.workDirty = true;
        }
        camera.updateMatrixWorld();
        this.container.updateMatrixWorld();
        const view = new Matrix4().multiplyMatrices(camera.matrixWorldInverse, this.container.matrixWorld);
        const projection = camera.projectionMatrix;
        const changed = !this.hasCamera || !this.viewMatrix.equals(view) || !this.projectionMatrix.equals(projection);
        if (!changed) {
            return;
        }
        if (this.hasCamera) {
            this.lastMotionTime = performance.now();
            this.workDirty ||= !this.moving;
            this.moving = true;
        }
        this.hasCamera = true;
        this.viewMatrix.copy(view);
        this.projectionMatrix.copy(projection);
        this.viewProjection.multiplyMatrices(projection, view);
        this.viewDirty = true;
    }

    private updateVisibility(now: number) {
        const frustum = new Frustum().setFromMatrix(this.viewProjection);
        for (const node of this.nodes) {
            const visible = !this.frustumCullingEnabled || frustum.intersectsBox(node.box);
            if (visible !== node.visible) {
                node.visible = visible;
                node.occluded = false;
                node.targetLevel = visible ? this.maxLevel : -1;
                node.targetSince = now;
            }
        }
        // Coverage is the unavoidable budget floor, including newly exposed nodes.
        const coverage = this.nodes.reduce(
            (sum, node) => sum + (node.visible ? node.lods[this.coverageLevel(node)].counts : 0),
            0,
        );
        this.effectiveBudget = Math.max(this.maxBudget, coverage);
    }

    private updateOcclusion() {
        try {
            const mask =
                this.voxels &&
                computeVoxelOcclusion(
                    this.voxels,
                    this.nodes.map(node => (node.visible ? node.box : undefined)),
                    this.viewProjection,
                );
            this.nodes.forEach((node, idx) => {
                node.occluded = mask?.[idx] === 1;
            });
        } catch (error) {
            // Voxel data is optional. A failed query must not suppress otherwise visible detail.
            this.voxels = undefined;
            this.nodes.forEach(node => {
                node.occluded = false;
            });
            logger.warn('Failed to query LOD voxel', error);
        }
    }

    private importance(node: LodNode) {
        const { projectedCorners, viewProjection } = this;
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        const include = (x: number, y: number, w: number) => {
            if (w <= 0) {
                return;
            }
            minX = Math.min(minX, x / w);
            minY = Math.min(minY, y / w);
            maxX = Math.max(maxX, x / w);
            maxY = Math.max(maxY, y / w);
        };
        for (let i = 0; i < 8; i++) {
            const point = node.box.corners[i];
            const projected = projectedCorners[i].set(point.x, point.y, point.z, 1).applyMatrix4(viewProjection);
            if (projected.z + projected.w >= 0) {
                include(projected.x, projected.y, projected.w);
            }
        }
        // Clip edges against the near plane before dividing by w, including boxes crossing the camera.
        for (let i = 0; i < BOX_EDGES.length; i += 2) {
            const a = projectedCorners[BOX_EDGES[i]];
            const b = projectedCorners[BOX_EDGES[i + 1]];
            const da = a.z + a.w;
            const db = b.z + b.w;
            if (da < 0 === db < 0) {
                continue;
            }
            const t = da / (da - db);
            include(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.w + (b.w - a.w) * t);
        }
        minX = Math.max(-1, minX);
        minY = Math.max(-1, minY);
        maxX = Math.min(1, maxX);
        maxY = Math.min(1, maxY);
        const area = (Math.max(0, maxX - minX) * Math.max(0, maxY - minY)) / 4;
        if (!area) {
            return 0;
        }
        const x = Math.max(minX, Math.min(0, maxX));
        const y = Math.max(minY, Math.min(0, maxY));
        return area / (1 + x * x + y * y) ** 2;
    }

    private schedule(now: number) {
        const { nodes, maxLevel } = this;
        this.updateOcclusion();
        const finest = this.moving ? this.movingFinestLevel : this.minLevel;
        const levels = nodes.map(node => (node.visible ? this.coverageLevel(node) : -1));
        let coverage = 0;
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            node.targetWeight = node.visible && !node.occluded ? this.importance(node) : 0;
            if (node.visible) {
                coverage += node.lods[levels[i]].counts;
            }
        }
        this.effectiveBudget = Math.max(this.maxBudget, coverage);
        let remaining = this.effectiveBudget - coverage;
        this.orderedNodes.sort((a, b) => nodes[b].targetWeight - nodes[a].targetWeight || a - b);
        if (this.moving) {
            for (const idx of this.orderedNodes) {
                const node = nodes[idx];
                if (!node.visible || node.occluded || node.currentLevel < 0 || node.currentLevel >= finest) {
                    continue;
                }
                const delta = node.lods[node.currentLevel].counts - node.lods[maxLevel].counts;
                if (delta <= remaining) {
                    levels[idx] = node.currentLevel;
                    remaining -= delta;
                }
            }
        }

        // Refine the largest weighted projected area per current point first.
        // Upgrade cost only decides whether the next level fits the remaining budget.
        const priority = (idx: number) => {
            const node = nodes[idx];
            return node.targetWeight / Math.max(1, node.lods[levels[idx]].counts);
        };
        // Without a pixel limit or viewport, only relative allocation and the point budget apply.
        const pixelLimit = this.pixelLimitEnabled ? 1 / this.viewportPixels : 0;
        const heap = this.orderedNodes.filter(idx => levels[idx] > finest && priority(idx) > pixelLimit);
        const siftDown = (start: number) => {
            let index = start;
            while (index * 2 + 1 < heap.length) {
                let child = index * 2 + 1;
                if (child + 1 < heap.length && priority(heap[child + 1]) > priority(heap[child])) {
                    child++;
                }
                if (priority(heap[index]) >= priority(heap[child])) {
                    break;
                }
                [heap[index], heap[child]] = [heap[child], heap[index]];
                index = child;
            }
        };
        for (let i = Math.floor(heap.length / 2) - 1; i >= 0; i--) {
            siftDown(i);
        }
        while (heap.length) {
            const idx = heap[0];
            const level = levels[idx];
            const delta = nodes[idx].lods[level - 1].counts - nodes[idx].lods[level].counts;
            const fits = delta <= remaining;
            if (fits) {
                levels[idx]--;
                remaining -= delta;
            }
            if (levels[idx] <= finest || !fits || priority(idx) <= pixelLimit) {
                heap[0] = heap[heap.length - 1];
                heap.pop();
            }
            if (heap.length) {
                siftDown(0);
            }
        }
        for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].targetLevel !== levels[i]) {
                nodes[i].targetLevel = levels[i];
                nodes[i].targetSince = now;
            }
        }
        this.viewDirty = false;
        this.workDirty = this.mergeDirty = true;
        this.lastScheduleTime = now;
    }

    private upgrade(now: number, interval: number) {
        const { nodes, resourceManager } = this;
        const coverage: Array<[number, number]> = [];
        const reductions: Array<[number, number]> = [];
        const refinements: Array<[number, number]> = [];
        const required = new Set<number>();
        this.pendingWork = false;
        this.workDirty = false;
        // Pending work always has a bounded retry time, including work paused by backpressure.
        this.nextWorkTime = now + interval;
        this.lastError = undefined;
        for (const idx of this.orderedNodes) {
            const node = nodes[idx];
            let level = this.desiredLevel(node);
            if (level === node.currentLevel) {
                continue;
            }
            this.pendingWork = true;
            if (node.currentLevel < 0 && level >= 0) {
                // Missing coverage has one path: prepare coarse data, then restore it directly in flush.
                level = this.coverageLevel(node);
                coverage.push([idx, level]);
            } else {
                const readyAt = node.targetSince + this.stabilityDuration;
                if (now < readyAt) {
                    this.nextWorkTime = Math.min(this.nextWorkTime, readyAt);
                    if (level >= 0) {
                        required.add(node.lods[level].resourceIdx);
                    }
                    continue;
                }
                const delta = (level >= 0 ? node.lods[level].counts : 0) - node.lods[node.currentLevel].counts;
                (delta <= 0 ? reductions : refinements).push([idx, level]);
            }
            if (level >= 0) {
                required.add(node.lods[level].resourceIdx);
            }
        }
        resourceManager.prune(required, this.maxBudget);

        const ready = [...reductions, ...refinements].filter(
            ([idx, level]) => level < 0 || resourceManager.has(nodes[idx].lods[level].resourceIdx),
        );
        const readyCount = ready.filter(([, level]) => level >= 0).length;
        const parallel = this.schedulerParallelCounts;
        const limit = this.schedulerExistingTaskLimit;
        const files = (tasks: Array<[number, number]>) =>
            tasks.filter(([, level]) => level >= 0).map(([idx, level]) => nodes[idx].lods[level].resourceIdx);
        const coverageError = resourceManager.request(files([...coverage, ...reductions]), parallel);
        const detailError = resourceManager.request(files(refinements), readyCount < limit ? parallel : 0);
        this.lastError = coverageError ?? detailError;
        if (this.lastError) {
            this.running?.reject(this.lastError);
            this.running = undefined;
        }
        if (this.replacement) {
            return;
        }
        if (!this.pendingWork && !this.viewDirty && !this.voxelLoading) {
            this.running?.resolve();
            this.running = undefined;
            return;
        }
        if (now < this.nextCommitTime) {
            if (this.pendingWork) {
                this.nextWorkTime = Math.min(this.nextWorkTime, this.nextCommitTime);
            }
            return;
        }

        const changes = new Map<number, number>();
        const touched = new Set<LodProxy>();
        const removals = new Map<LodProxy, number>();
        for (const [idx, level] of ready) {
            const proxy = nodes[idx].proxy;
            if (level < 0 && proxy) {
                removals.set(proxy, (removals.get(proxy) ?? 0) + 1);
            }
        }
        let slots = 0;
        let merged = false;
        let remaining = this.effectiveBudget - this.realUsedBudget;
        if (this.moving) {
            for (const [proxy, count] of removals) {
                if (count !== proxy.nodeEnd - proxy.nodeStart + 1 || slots >= limit) {
                    continue;
                }
                for (let idx = proxy.nodeStart; idx <= proxy.nodeEnd; idx++) {
                    changes.set(idx, -1);
                }
                touched.add(proxy);
                remaining += proxy.counts;
                slots++;
            }
            const removed = changes.size;
            slots = this.collectMerges(changes, slots);
            merged = true;
            if (changes.size > removed) {
                // Pure merges must not be rolled back with a view-dependent refinement or partial eviction.
                this.commit(changes, now, interval);
                return;
            }
        }
        for (const [idx, level] of ready) {
            const node = nodes[idx];
            const oldCount = node.currentLevel >= 0 ? node.lods[node.currentLevel].counts : 0;
            const delta = (level >= 0 ? node.lods[level].counts : 0) - oldCount;
            if (delta > 0 && delta > remaining) {
                continue;
            }
            if (delta > 0 && !merged) {
                // Compact coarse coverage before adding detail, so rotation cannot starve merging.
                slots = this.collectMerges(changes, slots);
                merged = true;
            }
            if (changes.has(idx)) {
                continue;
            }
            const proxy = node.proxy;
            let cost = proxy ? (touched.has(proxy) ? 2 : 4) : 1;
            if (proxy && removals.get(proxy) === proxy.nodeEnd - proxy.nodeStart + 1) {
                // Removing a whole proxy is one scene operation, regardless of its block count.
                cost = touched.has(proxy) ? 0 : 1;
            }
            if (slots > 0 && slots + cost > limit) {
                continue;
            }
            changes.set(idx, level);
            remaining -= delta;
            slots += cost;
            if (node.proxy) {
                touched.add(node.proxy);
            }
        }
        if (changes.size) {
            if (!merged) {
                this.collectMerges(changes, slots);
            }
            this.commit(changes, now, interval);
        }
    }

    private canMerge(node: LodNode) {
        return node.visible && (!this.moving || node.currentLevel === this.maxLevel);
    }

    private collectMerges(changes: Map<number, number>, slots: number) {
        if (!this.mergeNodeEnabled || !this.mergeDirty) {
            return slots;
        }
        const eligible = this.proxies.map(proxy => {
            for (let idx = proxy.nodeStart; idx <= proxy.nodeEnd; idx++) {
                if (changes.has(idx) || !this.canMerge(this.nodes[idx])) {
                    return false;
                }
            }
            return true;
        });
        const limit = Math.max(3, this.schedulerExistingTaskLimit);
        for (let start = 0; start < this.proxies.length;) {
            let end = start + 1;
            while (end < this.proxies.length && eligible[start] && eligible[end] && slots + end - start + 2 <= limit) {
                const previous = this.proxies[end - 1];
                const next = this.proxies[end];
                if (
                    // Bound future split/freeze work as well as the number of proxies in this merge.
                    next.nodeEnd - this.proxies[start].nodeStart + 1 > limit ||
                    previous.nodeEnd + 1 !== next.nodeStart ||
                    previous.resourceIdx !== next.resourceIdx ||
                    previous.offset + previous.counts !== next.offset ||
                    this.nodes[previous.nodeEnd].currentLevel !== this.nodes[next.nodeStart].currentLevel
                ) {
                    break;
                }
                end++;
            }
            if (end - start > 1) {
                for (let i = this.proxies[start].nodeStart; i <= this.proxies[end - 1].nodeEnd; i++) {
                    changes.set(i, this.nodes[i].currentLevel);
                }
                slots += end - start + 1;
            }
            start = end;
        }
        this.mergeDirty = false;
        return slots;
    }

    private merge(now: number, interval: number) {
        if (!this.mergeNodeEnabled || !this.mergeDirty || this.replacement || now < this.nextCommitTime) {
            return;
        }
        const changes = new Map<number, number>();
        this.collectMerges(changes, 0);
        if (changes.size) {
            this.commit(changes, now, interval);
        }
    }

    private onContextLost = () => {
        this.gpuSorting = false;
        this.cancelReplacement();
    };

    private onRendererReset = () => {
        this.gpuSorting = this.viewerCtx!.viewer._getEngine().renderer.backend === RendererBackend.WEBGPU_WASM;
        this.workDirty = true;
    };

    private commit(changes: Map<number, number>, now: number, interval: number) {
        const old = new Set<LodProxy>();
        const levels = new Map(changes);
        for (const idx of changes.keys()) {
            const proxy = this.nodes[idx].proxy;
            if (proxy && !old.has(proxy)) {
                old.add(proxy);
                for (let i = proxy.nodeStart; i <= proxy.nodeEnd; i++) {
                    if (!levels.has(i)) {
                        levels.set(i, this.nodes[i].currentLevel);
                    }
                }
            }
        }
        const gpuSorting = this.gpuSorting;
        // GPU ordering consumes the new scene in this frame; there is no CPU sort result to await.
        const immediate = gpuSorting || old.size === 0;
        if (this.replacement && !immediate) {
            return;
        }
        const transaction: Replacement = {
            oldProxies: Array.from(old).sort((a, b) => a.nodeStart - b.nodeStart),
            newProxies: [],
            levels,
            pending: new Map(),
        };
        if (!immediate) {
            this.replacement = transaction;
        }
        try {
            let previous: LodProxy | undefined;
            for (const idx of Array.from(levels.keys()).sort((a, b) => a - b)) {
                const level = levels.get(idx)!;
                if (level < 0 || !this.nodes[idx].lods[level].counts) {
                    continue;
                }
                const lod = this.nodes[idx].lods[level];
                if (
                    previous &&
                    previous.nodeEnd + 1 === idx &&
                    previous.resourceIdx === lod.resourceIdx &&
                    previous.offset + previous.counts === lod.offset &&
                    levels.get(previous.nodeEnd) === level
                ) {
                    previous.counts += lod.counts;
                    previous.nodeEnd = idx;
                } else {
                    previous = { ...lod, nodeStart: idx, nodeEnd: idx } as LodProxy;
                    transaction.newProxies.push(previous);
                }
            }
            // A level alias with identical contents needs no scene mutation or sorting.
            if (
                transaction.oldProxies.length === transaction.newProxies.length &&
                transaction.oldProxies.every((proxy, i) => {
                    const next = transaction.newProxies[i];
                    return (
                        proxy.nodeStart === next.nodeStart &&
                        proxy.nodeEnd === next.nodeEnd &&
                        proxy.resourceIdx === next.resourceIdx &&
                        proxy.offset === next.offset &&
                        proxy.counts === next.counts
                    );
                })
            ) {
                for (const [idx, level] of levels) {
                    this.nodes[idx].currentLevel = level;
                }
                if (this.replacement === transaction) {
                    this.replacement = undefined;
                }
                this.workDirty = this.mergeDirty = true;
                if (this.debuggerEnabled) {
                    for (const proxy of transaction.oldProxies) {
                        this.applyModifiers(proxy, this.nodes[proxy.nodeStart].currentLevel);
                    }
                }
                return;
            }
            // Repeated immediate coverage must not keep postponing the next ordinary batch.
            if (!immediate || this.nextCommitTime === 0) {
                this.nextCommitTime = now + interval;
            }
            for (const proxy of transaction.newProxies) {
                proxy.splat = this.resourceManager.createSplat(proxy.resourceIdx, proxy.offset, proxy.counts);
                this.applyModifiers(proxy, levels.get(proxy.nodeStart)!);
            }
            if (!this.validReplacement(transaction)) {
                this.cancelReplacement(undefined, transaction);
                return;
            }
            if (gpuSorting) {
                for (const proxy of transaction.newProxies) {
                    this.container.add(proxy.splat);
                }
                this.finishReplacement(transaction);
                return;
            }
            // Fully evicted proxies have no replacement to sort. Retire them in this batch now.
            const retired = new Set(
                transaction.oldProxies.filter(proxy => {
                    for (let idx = proxy.nodeStart; idx <= proxy.nodeEnd; idx++) {
                        if (levels.get(idx)! >= 0) {
                            return false;
                        }
                    }
                    return true;
                }),
            );
            for (const proxy of retired) {
                this.disposeProxy(proxy);
                for (let idx = proxy.nodeStart; idx <= proxy.nodeEnd; idx++) {
                    this.nodes[idx].currentLevel = -1;
                    this.nodes[idx].proxy = undefined;
                    levels.delete(idx);
                }
            }
            if (retired.size) {
                this.proxies = this.proxies.filter(proxy => !retired.has(proxy));
                transaction.oldProxies = transaction.oldProxies.filter(proxy => !retired.has(proxy));
            }
            const renderer = this.viewerCtx?.viewer._getEngine().renderer;
            const textures = new Set(transaction.newProxies.flatMap(proxy => proxy.splat.extrasTex));
            textures.forEach(texture => renderer?.queueFlushTexture(texture));
            renderer?.flushCommands();
            if (!immediate) {
                for (const proxy of transaction.newProxies) {
                    const onSorted = () => {
                        proxy.splat.off(SplatSortedEvent, onSorted);
                        transaction.pending.delete(proxy.splat);
                        if (!transaction.pending.size && this.replacement === transaction) {
                            this.finishReplacement();
                        }
                    };
                    transaction.pending.set(proxy.splat, onSorted);
                    proxy.splat.on(SplatSortedEvent, onSorted);
                }
            }
            for (const proxy of transaction.newProxies) {
                this.container.add(proxy.splat);
            }
            if (immediate || !transaction.newProxies.length) {
                this.finishReplacement(transaction);
            }
        } catch (error) {
            this.cancelReplacement(error, transaction);
        }
    }

    private validReplacement(transaction: Replacement) {
        if (this.isDestroy) {
            return false;
        }
        // Displayed levels stay frozen while sorting. Proxy identity is the ownership token.
        for (const proxy of transaction.oldProxies) {
            for (let idx = proxy.nodeStart; idx <= proxy.nodeEnd; idx++) {
                if (this.nodes[idx].proxy !== proxy) {
                    return false;
                }
            }
        }
        const frustum =
            this.viewDirty && this.frustumCullingEnabled ? new Frustum().setFromMatrix(this.viewProjection) : undefined;
        let budget = this.realUsedBudget;
        for (const [idx, level] of transaction.levels) {
            const node = this.nodes[idx];
            const previous = node.currentLevel;
            if (level === previous) {
                // Merging preserves the displayed contents, even if the view changes while sorting.
                continue;
            }
            if (frustum && frustum.intersectsBox(node.box) !== level >= 0) {
                return false;
            }
            const desired = this.desiredLevel(node);
            if (level < 0 ? desired >= 0 : desired < 0) {
                return false;
            }
            if (level >= 0) {
                if (this.moving && level < this.movingFinestLevel && (previous < 0 || level < previous)) {
                    return false;
                }
                // Coarse coverage and useful intermediate upgrades remain valid as the target gets finer.
                if (previous < 0 || level < previous ? desired > level : desired < level) {
                    return false;
                }
            }
            budget += (level >= 0 ? node.lods[level].counts : 0) - (previous >= 0 ? node.lods[previous].counts : 0);
        }
        // Coverage must not wait for asynchronous budget recovery; later batches restore the target budget.
        return !transaction.oldProxies.length || budget <= Math.max(this.effectiveBudget, this.realUsedBudget);
    }

    private disposeProxy(proxy: LodProxy) {
        if (!proxy.splat) {
            return;
        }
        this.container.remove(proxy.splat);
        proxy.splat.setModifiers([]);
        // Source textures belong to ResourceManager and may still be used by other proxies.
        proxy.splat.extrasTex = [];
        proxy.splat.destroy();
        this.resourceManager.release(proxy.resourceIdx);
    }

    private finishReplacement(transaction = this.replacement!) {
        if (!this.validReplacement(transaction)) {
            this.cancelReplacement(undefined, transaction);
            return;
        }
        transaction.pending.forEach((listener, splat) => splat.off(SplatSortedEvent, listener));
        const old = new Set(transaction.oldProxies);
        this.proxies = this.proxies.filter(proxy => !old.has(proxy));
        for (const proxy of transaction.oldProxies) {
            this.disposeProxy(proxy);
        }
        for (const [idx, level] of transaction.levels) {
            this.nodes[idx].currentLevel = level;
            this.nodes[idx].proxy = undefined;
        }
        for (const proxy of transaction.newProxies) {
            for (let idx = proxy.nodeStart; idx <= proxy.nodeEnd; idx++) {
                this.nodes[idx].proxy = proxy;
            }
            this.proxies.push(proxy);
        }
        this.proxies.sort((a, b) => a.nodeStart - b.nodeStart);
        if (this.replacement === transaction) {
            this.replacement = undefined;
        }
        this.workDirty = true;
        this.mergeDirty = true;
    }

    private cancelReplacement(error?: unknown, transaction = this.replacement) {
        if (transaction) {
            if (this.replacement === transaction) {
                this.replacement = undefined;
            }
            transaction.pending.forEach((listener, splat) => splat.off(SplatSortedEvent, listener));
            transaction.newProxies.forEach(proxy => this.disposeProxy(proxy));
            this.workDirty = this.mergeDirty = true;
        }
        if (error) {
            this.lastError = error;
            this.running?.reject(error);
            this.running = undefined;
            logger.warn('Failed to update LOD splats', error);
        }
    }

    private running?: Deferred;
    onFinishSchedule() {
        if (this.isDestroy || (!this.pendingWork && !this.replacement && !this.viewDirty && !this.voxelLoading)) {
            return Promise.resolve();
        }
        if (!this.viewDirty && this.lastError) {
            return Promise.reject(this.lastError);
        }
        this.running ??= deferred();
        return this.running.promise;
    }

    /** Advance pending work once. Use this directly when the application owns the frame loop. */
    flush() {
        if (this.gpuSorting && this.replacement) {
            this.finishReplacement();
        }
        if (this.isDestroy || !this.hasCamera) {
            return;
        }
        const now = performance.now();
        const interval = this.schedulerMinDuration;
        const moving = now - this.lastMotionTime <= Math.max(this.stabilityDuration, interval);
        if (moving !== this.moving) {
            this.moving = moving;
            this.viewDirty = this.workDirty = true;
        }
        if (this.viewDirty) {
            this.updateVisibility(now);
        }
        if (this.viewDirty || this.workDirty) {
            const coverage = new Map<number, number>();
            for (let idx = 0; idx < this.nodes.length; idx++) {
                const node = this.nodes[idx];
                const level = this.coverageLevel(node);
                if (node.visible && node.currentLevel < 0 && this.resourceManager.has(node.lods[level].resourceIdx)) {
                    coverage.set(idx, level);
                }
            }
            if (coverage.size) {
                // Insert all cached coarse coverage in this update, before pacing or sorting can block it.
                // Coverage has no old owners and can coexist with an unrelated replacement.
                this.commit(coverage, now, interval);
            }
        }
        if (this.viewDirty && now - this.lastScheduleTime >= interval) {
            this.schedule(now);
        }
        if (this.replacement && !this.validReplacement(this.replacement)) {
            this.cancelReplacement();
        }
        if (this.workDirty || (this.pendingWork && now >= this.nextWorkTime)) {
            this.upgrade(now, interval);
        }
        this.merge(now, interval);
    }

    private rafId?: number;
    /** Optional automatic pump; tick(camera) still supplies the view. */
    start() {
        if (this.rafId !== undefined || this.isDestroy) {
            return;
        }
        const loop = () => {
            if (this.isDestroy) {
                return;
            }
            try {
                this.flush();
            } catch (error) {
                this.cancelReplacement(error);
            }
            this.rafId = requestAnimationFrame(loop);
        };
        this.rafId = requestAnimationFrame(loop);
    }

    /** Stop the automatic pump without discarding displayed or already prepared resources. */
    stop() {
        if (this.rafId !== undefined) {
            cancelAnimationFrame(this.rafId);
            this.rafId = undefined;
        }
    }

    private isDestroy = false;
    destroy() {
        if (this.isDestroy) {
            return;
        }
        this.isDestroy = true;
        const engine = this.viewerCtx?.viewer._getEngine();
        engine?.off(ContextLostEvent, this.onContextLost);
        engine?.off(ResetRendererEvent, this.onRendererReset);
        this.voxelLoading?.abort();
        this.voxels = undefined;
        this.stop();
        this.cancelReplacement();
        this.container.removeFromParent();
        this.proxies.forEach(proxy => this.disposeProxy(proxy));
        this.proxies = [];
        this.resourceManager.destroy();
        this.running?.resolve();
        this.running = undefined;
        this.viewerCtx = undefined;
    }
}
