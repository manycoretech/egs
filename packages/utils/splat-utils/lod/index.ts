import { type Deferred, deferred } from '@qunhe/egs-lib';
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
    type __INTERNAL__,
    SplatModifier,
} from '@qunhe/egs';
import { parseSplatData, detectSplatFileType } from '@qunhe/egs-splat-loader';
import { ResourceManager } from './ResourceManager.js';

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

interface DistanceStep {
    distance: number; // <=
    step: number;
}

export interface LodConfig {
    minLevel: number;
    maxBudget: number;
    backgroundPenalty: number;
    distanceStep: DistanceStep[];
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

const DEFAULT_NODE_WEIGHT = 2;
const DEFAULT_DISTANCE_STEP: DistanceStep[] = [{ distance: 10, step: 2 }];

function DefaultLoadResource(url: string) {
    const type = detectSplatFileType(url, new Uint8Array());
    return parseSplatData(type!, url);
}

interface LodNode {
    box: Box3;
    lods: Array<{
        resourceIdx: number;
        offset: number;
        counts: number;
    }>;
    weight: number;

    currentLevel: number;
    targetWeight: number;
    targetLevel: number;
    unstableTicks: number;
}

interface LodProxy {
    resourceIdx: number;
    offset: number;
    counts: number;
    nodeStart: number;
    nodeEnd: number;
    splat: Splat;
}

const tempVec3 = new Vector3();
export class LodSplat {
    private minLevel: number;
    private maxLevel: number;
    private maxBudget: number;
    private backgroundPenalty: number;
    private distanceStep: DistanceStep[];
    private hysteresisTicks: number;
    private schedulerParallelCounts: number;
    private schedulerExistingTaskLimit: number;
    private schedulerMinDuration: number;
    private mergeNodeEnabled: boolean;
    private frustumCullingEnabled: boolean;
    private debuggerEnabled: boolean;

    private viewerCtx?: IViewerContext;
    private resourceManager: ResourceManager;
    private forwardBox: Box3;
    private nodes: LodNode[];
    private proxies: LodProxy[] = [];
    private realUsedBudget: number = 0;

    readonly container = new Object3D();

    constructor(
        meta: LodMeta,
        config: Partial<LodConfig> = {},
        viewerCtx?: IViewerContext,
        loadResource: typeof DefaultLoadResource = DefaultLoadResource,
    ) {
        this.minLevel = config?.minLevel ?? 0;
        this.maxLevel = meta.levels - 1;
        this.maxBudget = config?.maxBudget ?? 3_000_000;
        this.backgroundPenalty = config?.backgroundPenalty ?? 0.5;
        this.distanceStep = config?.distanceStep ?? DEFAULT_DISTANCE_STEP;
        this.hysteresisTicks = config?.hysteresisTicks ?? 4;
        this.schedulerParallelCounts = config?.schedulerParallelCounts ?? 4;
        this.schedulerExistingTaskLimit = config?.schedulerExistingTaskLimit ?? 64;
        this.schedulerMinDuration = config?.schedulerMinDuration ?? 160;
        this.mergeNodeEnabled = config?.mergeNodeEnabled ?? true;
        this.frustumCullingEnabled = config?.frustumCullingEnabled ?? true;
        this.debuggerEnabled = config?.debuggerEnabled ?? false;

        this.viewerCtx = viewerCtx;
        this.resourceManager = new ResourceManager(meta.files, meta.permanentFiles, loadResource);
        this.forwardBox = new Box3(
            new Vector3(meta.forwardBox.min[0], meta.forwardBox.min[1], meta.forwardBox.min[2]),
            new Vector3(meta.forwardBox.max[0], meta.forwardBox.max[1], meta.forwardBox.max[2]),
        );
        this.nodes = meta.tree.map(({ bound, lods }) => ({
            box: new Box3(
                new Vector3(bound.min[0], bound.min[1], bound.min[2]),
                new Vector3(bound.max[0], bound.max[1], bound.max[2]),
            ),
            lods: lods.map(v => ({ resourceIdx: v.file, offset: v.offset, counts: v.count })),
            weight: DEFAULT_NODE_WEIGHT,
            currentLevel: -1,
            targetWeight: 0,
            targetLevel: -1,
            unstableTicks: 0,
        }));

        {
            const { backgroundPenalty, forwardBox, nodes } = this;
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                if (!forwardBox.intersectsBox(node.box)) {
                    node.weight *= backgroundPenalty;
                }
            }
        }
    }

    setConfig(config: Partial<LodConfig>) {
        this.minLevel = config?.minLevel ?? this.minLevel;
        this.maxBudget = config?.maxBudget ?? this.maxBudget;
        {
            const { nodes, forwardBox } = this;
            const backgroundPenalty = config?.backgroundPenalty ?? this.backgroundPenalty;
            if (backgroundPenalty !== this.backgroundPenalty) {
                for (let i = 0; i < nodes.length; i++) {
                    const node = nodes[i];
                    if (!forwardBox.intersectsBox(node.box)) {
                        node.weight = DEFAULT_NODE_WEIGHT * backgroundPenalty;
                    }
                }
                this.backgroundPenalty = backgroundPenalty;
            }
        }
        this.distanceStep = config?.distanceStep ?? this.distanceStep;
        this.hysteresisTicks = config?.hysteresisTicks ?? this.hysteresisTicks;
        this.schedulerParallelCounts = config?.schedulerParallelCounts ?? this.schedulerParallelCounts;
        this.schedulerExistingTaskLimit = config?.schedulerExistingTaskLimit ?? this.schedulerExistingTaskLimit;
        this.schedulerMinDuration = config?.schedulerMinDuration ?? this.schedulerMinDuration;
        this.mergeNodeEnabled = config?.mergeNodeEnabled ?? this.mergeNodeEnabled;
        this.frustumCullingEnabled = config?.frustumCullingEnabled ?? this.frustumCullingEnabled;
        const debuggerEnabled = config?.debuggerEnabled ?? this.debuggerEnabled;
        if (debuggerEnabled !== this.debuggerEnabled) {
            this.debuggerEnabled = debuggerEnabled;
            this.updateModifiers();
        }
    }

    private modifiers: SplatModifier[] = [];
    setModifiers(modifiers: SplatModifier[]) {
        this.modifiers = [...modifiers];
        this.updateModifiers();
    }

    private updateModifiers() {
        const { nodes, proxies, debuggerEnabled } = this;
        proxies.forEach(proxy => {
            proxy.splat.setModifiers([
                ...this.modifiers,
                ...(debuggerEnabled
                    ? [OverrideModifier.copy({ color: LOD_LEVEL_COLORS[nodes[proxy.nodeStart].currentLevel] })]
                    : []),
            ]);
        });
    }

    private flush = async (isScheduleFrame: boolean) => {
        const {
            maxLevel,
            maxBudget,
            hysteresisTicks,
            schedulerParallelCounts,
            schedulerExistingTaskLimit,
            mergeNodeEnabled,
            debuggerEnabled,
            container,
            resourceManager,
            viewerCtx,
            nodes,
            proxies,
            modifiers,
            realUsedBudget,
        } = this;

        // create target proxies
        const targetLevels = new Array<number>(nodes.length);
        const targetProxies: LodProxy[] = [];
        let prevProxy: LodProxy | undefined;
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const { currentLevel, lods } = node;
            let { targetLevel } = node;
            if (targetLevel < 0) {
                targetLevels[i] = targetLevel;
                continue;
            }

            const isCached = resourceManager.has(lods[targetLevel].resourceIdx);
            if (isScheduleFrame) {
                targetLevel = currentLevel >= 0 || isCached ? targetLevel : maxLevel;
            } else {
                targetLevel = currentLevel >= 0 ? currentLevel : isCached ? targetLevel : maxLevel;
            }
            targetLevels[i] = targetLevel;
            const lod = lods[targetLevel];
            const currentLod = currentLevel >= 0 ? lods[currentLevel] : undefined;
            if (
                currentLod &&
                currentLod.resourceIdx === lod.resourceIdx &&
                currentLod.offset === lod.offset &&
                currentLod.counts === lod.counts &&
                currentLevel !== targetLevel
            ) {
                node.currentLevel = targetLevel;
                node.unstableTicks = 0;
            }
            if (
                mergeNodeEnabled &&
                prevProxy &&
                prevProxy.resourceIdx === lod.resourceIdx &&
                prevProxy.offset + prevProxy.counts === lod.offset
            ) {
                prevProxy.counts += lod.counts;
                prevProxy.nodeEnd = i;
            } else {
                prevProxy = {
                    resourceIdx: lod.resourceIdx,
                    offset: lod.offset,
                    counts: lod.counts,
                    nodeStart: i,
                    nodeEnd: i,
                } as LodProxy;
                targetProxies.push(prevProxy);
            }
        }

        // create diff component
        type DiffComponent = {
            nodeStart: number;
            nodeEnd: number;
            newList: LodProxy[];
            oldList: LodProxy[];
            weight: number;
            budgetDelta: number;
            cachedCount: number;
            loadingCount: number;
            isVisibilityChange: boolean;
            isReady: boolean;
            isUsed: boolean;
        };

        const components: DiffComponent[] = [];
        let component: DiffComponent | undefined;
        const commit = () => {
            if (!component) {
                return;
            }
            let hasChange = false;
            for (let i = component.nodeStart; i <= component.nodeEnd; i++) {
                const node = nodes[i];
                const targetLevel = targetLevels[i];
                component.weight = Math.max(component.weight, node.targetWeight);
                component.isReady ||=
                    node.currentLevel < 0 ||
                    (node.currentLevel !== targetLevel && node.unstableTicks >= hysteresisTicks);
                component.isVisibilityChange ||= node.currentLevel < 0 || targetLevel < 0;
                if (node.currentLevel !== targetLevel) {
                    hasChange = true;
                }
            }
            if (!hasChange && component.newList.length !== component.oldList.length && component.budgetDelta <= 0) {
                hasChange = true;
                component.isReady = true;
            }
            if (hasChange) {
                components.push(component);
            }
            component = undefined;
        };

        const add = (proxy: LodProxy, isOld: boolean = false) => {
            if (!component || proxy.nodeStart > component.nodeEnd) {
                commit();
                component = {
                    nodeStart: proxy.nodeStart,
                    nodeEnd: proxy.nodeEnd,
                    newList: [],
                    oldList: [],
                    weight: 0,
                    budgetDelta: 0,
                    cachedCount: 0,
                    loadingCount: 0,
                    isVisibilityChange: false,
                    isReady: false,
                    isUsed: false,
                };
            } else if (proxy.nodeEnd > component.nodeEnd) {
                component.nodeEnd = proxy.nodeEnd;
            }
            if (isOld) {
                component.oldList.push(proxy);
                component.budgetDelta -= proxy.counts;
            } else {
                component.newList.push(proxy);
                component.budgetDelta += proxy.counts;
                if (resourceManager.has(proxy.resourceIdx)) {
                    component.cachedCount++;
                } else {
                    component.loadingCount++;
                }
            }
        };

        let targetIdx = 0;
        let currentIdx = 0;
        while (targetIdx < targetProxies.length || currentIdx < proxies.length) {
            const targetProxy = targetProxies[targetIdx];
            const currentProxy = proxies[currentIdx];
            if (
                targetProxy &&
                currentProxy &&
                currentProxy.resourceIdx === targetProxy.resourceIdx &&
                currentProxy.offset === targetProxy.offset &&
                currentProxy.counts === targetProxy.counts
            ) {
                targetIdx++;
                currentIdx++;
                continue;
            }

            const targetStart = targetProxy?.nodeStart ?? Infinity;
            const currentStart = currentProxy?.nodeStart ?? Infinity;
            if (targetProxy && targetStart <= currentStart) {
                add(targetProxy);
                targetIdx++;
            }
            if (currentProxy && currentStart <= targetStart) {
                add(currentProxy, true);
                currentIdx++;
            }
        }
        commit();
        components.sort((a, b) => b.weight - a.weight);

        const applyComponents: DiffComponent[] = [];
        let restBudget = maxBudget - realUsedBudget;
        let cachedNodes = 0;
        let loadingNodes = 0;
        // visibility change component
        for (let i = 0; i < components.length; i++) {
            const component = components[i];
            if (!component.isVisibilityChange) {
                continue;
            }
            component.isUsed = true;
            applyComponents.push(component);
            restBudget -= component.budgetDelta;
            cachedNodes += component.newList.length;
        }
        if (isScheduleFrame) {
            // ready & cached & downsample component. prerelease budget
            for (let i = 0; i < components.length; i++) {
                const component = components[i];
                if (component.isUsed || !component.isReady || !!component.loadingCount || component.budgetDelta > 0) {
                    continue;
                }
                component.isUsed = true;
                applyComponents.push(component);
                restBudget -= component.budgetDelta;
                cachedNodes += component.newList.length;
                if (cachedNodes > schedulerExistingTaskLimit) {
                    break;
                }
            }
            // ready component
            while (true) {
                if (cachedNodes >= schedulerExistingTaskLimit && loadingNodes >= schedulerParallelCounts) {
                    break;
                }
                let pick: DiffComponent | undefined;
                for (let i = 0; i < components.length; i++) {
                    const component = components[i];
                    if (
                        component.isUsed ||
                        !component.isReady ||
                        (component.budgetDelta > 0 && component.budgetDelta > restBudget) ||
                        (!!component.cachedCount && cachedNodes >= schedulerExistingTaskLimit) ||
                        (!!component.loadingCount && loadingNodes >= schedulerParallelCounts)
                    ) {
                        continue;
                    }
                    pick = component;
                    break;
                }
                if (!pick) {
                    break;
                }

                pick.isUsed = true;
                applyComponents.push(pick);
                restBudget -= pick.budgetDelta;
                cachedNodes += pick.cachedCount;
                loadingNodes += pick.loadingCount;
            }
            // not ready component
            const hasApplyComponents = !!applyComponents.length;
            while (true) {
                if (cachedNodes >= schedulerExistingTaskLimit && loadingNodes >= schedulerParallelCounts) {
                    break;
                }

                let pick: DiffComponent | undefined;
                for (let i = 0; i < components.length; i++) {
                    const component = components[i];
                    if (
                        component.isUsed ||
                        restBudget < 0 ||
                        (hasApplyComponents && !!component.loadingCount) ||
                        (!!component.cachedCount && cachedNodes >= schedulerExistingTaskLimit) ||
                        (!!component.loadingCount && loadingNodes >= schedulerParallelCounts)
                    ) {
                        continue;
                    }
                    pick = component;
                    break;
                }
                if (!pick) {
                    break;
                }

                pick.isUsed = true;
                applyComponents.push(pick);
                restBudget -= pick.budgetDelta;
                cachedNodes += pick.cachedCount;
                loadingNodes += pick.loadingCount;
            }
        }

        // modify container
        const newProxies: LodProxy[] = [];
        const oldProxies: LodProxy[] = [];
        for (let i = 0; i < applyComponents.length; i++) {
            const component = applyComponents[i];
            newProxies.push(...component.newList);
            oldProxies.push(...component.oldList);
        }
        const changes = newProxies.length + oldProxies.length;
        if (!changes) {
            return 0;
        }

        const renderer = viewerCtx?.viewer._getEngine().renderer;
        const loadedProxies = await Promise.all(
            newProxies.map(async proxy => {
                const splat = (proxy.splat = await resourceManager.loadSplat(
                    proxy.resourceIdx,
                    proxy.offset,
                    proxy.counts,
                ));
                if (renderer) {
                    for (let i = 0; i < splat.extrasTex.length; i++) {
                        renderer.queueFlushTexture(splat.extrasTex[i]);
                    }
                    renderer.flushCommands();
                }
                return proxy;
            }),
        );

        const sortPromises: Array<Promise<void>> = [];
        for (let i = 0; i < loadedProxies.length; i++) {
            const { splat, nodeStart } = loadedProxies[i];
            const { promise, resolve } = deferred();
            splat.setModifiers([
                ...modifiers,
                ...(debuggerEnabled
                    ? [OverrideModifier.copy({ color: LOD_LEVEL_COLORS[targetLevels[nodeStart]] })]
                    : []),
            ]);
            splat.once(SplatSortedEvent, resolve);
            container.add(splat);
            sortPromises.push(promise);
        }
        await Promise.all(sortPromises);

        for (let i = 0; i < oldProxies.length; i++) {
            const proxy = oldProxies[i];
            const idx = proxies.indexOf(proxy);
            if (idx >= 0) {
                proxies.splice(idx, 1);
            }
            container.remove(proxy.splat);
            resourceManager.release(proxy.resourceIdx);
            for (let i = proxy.nodeStart; i <= proxy.nodeEnd; i++) {
                if (targetLevels[i] < 0) {
                    nodes[i].currentLevel = targetLevels[i];
                }
            }
        }
        for (let i = 0; i < loadedProxies.length; i++) {
            const proxy = loadedProxies[i];
            for (let i = proxy.nodeStart; i <= proxy.nodeEnd; i++) {
                nodes[i].currentLevel = targetLevels[i];
                nodes[i].unstableTicks = 0;
            }
            proxies.push(proxy);
        }
        proxies.sort((a, b) => a.nodeStart - b.nodeStart || a.nodeEnd - b.nodeEnd);
        this.realUsedBudget = proxies.reduce((p, c) => p + c.counts, 0);

        return changes;
    };

    tick(camera: Camera) {
        const { nodes, minLevel, maxLevel, maxBudget, distanceStep, frustumCullingEnabled } = this;
        camera.updateMatrixWorld();

        const { position: cameraPos } = camera;
        const frustum = new Frustum().setFromMatrix(
            new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
        );
        const weightNodes = nodes
            .map((node, idx) => {
                const closestPoint = node.box.clampPoint(cameraPos, tempVec3);
                const insideBox = node.box.containsPoint(cameraPos);
                const dist = insideBox ? 0 : cameraPos.distanceTo(closestPoint);
                const isInside = frustum.intersectsBox(node.box);
                const weight = node.weight / (1 + 0.1 * dist * dist);
                return { idx, node, weight, isInside, dist };
            })
            .sort((a, b) => b.weight - a.weight);

        const steppedNodes: Array<
            DistanceStep & {
                nodes: typeof weightNodes;
            }
        > = [...distanceStep, { distance: Infinity, step: 1 }].map(e => ({ ...e, nodes: [] }));
        let lessUsedBudget = 0;
        for (const node of weightNodes) {
            if (!node.isInside) {
                if (!frustumCullingEnabled) {
                    lessUsedBudget += node.node.lods[maxLevel].counts;
                }
                continue;
            }
            for (const stepped of steppedNodes) {
                if (node.dist <= stepped.distance) {
                    stepped.nodes.push(node);
                    break;
                }
            }
            lessUsedBudget += node.node.lods[maxLevel].counts;
        }

        const levels = new Uint8Array(nodes.length).fill(maxLevel);
        let restBudget = maxBudget - lessUsedBudget;
        while (restBudget > 0) {
            const prevBudget = restBudget;
            for (const { step, nodes } of steppedNodes) {
                for (let i = 0; i < step; i++) {
                    for (const { idx, node } of nodes) {
                        const level = levels[idx];
                        if (level > minLevel) {
                            restBudget -= node.lods[level - 1].counts - node.lods[level].counts;
                            levels[idx] = level - 1;
                        }
                        if (restBudget <= 0) {
                            break;
                        }
                    }
                    if (restBudget <= 0) {
                        break;
                    }
                }
                if (restBudget <= 0) {
                    break;
                }
            }
            if (prevBudget === restBudget) {
                break;
            }
        }

        for (let i = 0; i < weightNodes.length; i++) {
            const { idx, node, weight, isInside } = weightNodes[i];
            const level = levels[idx];
            if (
                (node.targetLevel >= node.currentLevel && level > node.currentLevel) ||
                (node.targetLevel <= node.currentLevel && level < node.currentLevel)
            ) {
                node.unstableTicks++;
            } else {
                node.unstableTicks = 0;
            }
            node.targetWeight = weight;
            node.targetLevel = isInside || !frustumCullingEnabled ? level : -1;
        }
    }

    private running?: Deferred;
    onFinishSchedule() {
        if (!this.running) {
            this.running = deferred();
        }
        return this.running.promise;
    }

    private rafId?: number;
    start() {
        let lastScheduleTime = performance.now();
        const loop = async () => {
            const isScheduleFrame = performance.now() - lastScheduleTime >= this.schedulerMinDuration;
            const counts = await this.flush(isScheduleFrame);
            if (isScheduleFrame) {
                lastScheduleTime = performance.now();
            }
            if (isScheduleFrame && !counts && this.running) {
                this.running.resolve();
                this.running = undefined;
            }
            if (this.isDestroy) {
                return;
            }
            this.rafId = requestAnimationFrame(loop);
        };

        this.rafId = requestAnimationFrame(loop);
    }

    private isDestroy = false;
    destroy() {
        if (this.isDestroy) {
            return;
        }

        this.isDestroy = true;
        if (this.rafId !== undefined) {
            cancelAnimationFrame(this.rafId);
            this.rafId = undefined;
        }

        const { resourceManager, container, proxies } = this;
        container.removeFromParent();
        for (let i = 0; i < proxies.length; i++) {
            const proxy = proxies[i];
            container.remove(proxy.splat);
            resourceManager.release(proxy.resourceIdx);
            proxy.splat.destroy();
        }
        this.proxies = [];

        this.running?.resolve();
        this.running = undefined;
        this.viewerCtx = undefined;
    }
}
