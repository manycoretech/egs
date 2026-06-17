import { type Deferred, deferred, sleep } from '@qunhe/egs-lib';
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
} from '@qunhe/egs';
import { parseSplatData, detectSplatFileType } from '@qunhe/egs-splat-loader';
import { ResourceManager } from './ResourceManager';

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
    outsidePenalty: number;
    behindPenalty: number;
    behindTolerance: number;
    behindDistanceTolerance: number;
    distanceStep: DistanceStep[];
    hysteresisTicks: number;
    schedulerParallelCounts: number;
    schedulerExistingTaskLimit: number;
    schedulerMinDuration: number;
    debuggerEnabled: boolean;
}

const LOD_LEVEL_COLORS = [
    new Vector4(1.0, 0.2, 0.0, 1),
    new Vector4(1.0, 1.0, 0.0, 1),
    new Vector4(0.0, 1.0, 0.4, 1),
    new Vector4(0.0, 0.8, 1.0, 1),
    new Vector4(0.0, 0.4, 1.0, 1),
];

const DEFAULT_NODE_WEIGHT = 2;
const DEFAULT_DISTANCE_STEP: DistanceStep[] = [
    { distance: 5, step: 3 },
    { distance: 10, step: 2 },
];

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
    private outsidePenalty: number;
    private behindPenalty: number;
    private behindTolerance: number;
    private behindDistanceTolerance: number;
    private distanceStep: DistanceStep[];
    private hysteresisTicks: number;
    private schedulerParallelCounts: number;
    private schedulerExistingTaskLimit: number;
    private schedulerMinDuration: number;
    private debuggerEnabled: boolean;

    private viewerCtx?: IViewerContext;
    private resourceManager: ResourceManager;
    private lessUsedBudget: number;
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
        this.outsidePenalty = config?.outsidePenalty ?? 0.4;
        this.behindPenalty = config?.behindPenalty ?? 0.1;
        this.behindTolerance = config?.behindTolerance ?? -0.2;
        this.behindDistanceTolerance = config?.behindDistanceTolerance ?? 2;
        this.distanceStep = config?.distanceStep ?? DEFAULT_DISTANCE_STEP;
        this.hysteresisTicks = config?.hysteresisTicks ?? 4;
        this.schedulerParallelCounts = config?.schedulerParallelCounts ?? 4;
        this.schedulerExistingTaskLimit = config?.schedulerExistingTaskLimit ?? 64;
        this.schedulerMinDuration = config?.schedulerMinDuration ?? 160;
        this.debuggerEnabled = config?.debuggerEnabled ?? false;

        this.viewerCtx = viewerCtx;
        this.resourceManager = new ResourceManager(meta.files, meta.permanentFiles, loadResource);

        const { maxLevel, backgroundPenalty } = this;
        const { forwardBox, tree } = meta;
        const nodes = (this.nodes = tree.map(({ bound, lods }) => ({
            box: new Box3(
                new Vector3(bound.min[0], bound.min[1], bound.min[2]),
                new Vector3(bound.max[0], bound.max[1], bound.max[2]),
            ),
            lods: lods.map(v => ({ resourceIdx: v.file, offset: v.offset, counts: v.count })),
            weight: DEFAULT_NODE_WEIGHT,
            currentLevel: -1,
            targetWeight: 0,
            targetLevel: maxLevel,
            unstableTicks: 0,
        })));

        const box = (this.forwardBox = new Box3(
            new Vector3(forwardBox.min[0], forwardBox.min[1], forwardBox.min[2]),
            new Vector3(forwardBox.max[0], forwardBox.max[1], forwardBox.max[2]),
        ));
        let lessBudget = 0;
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            if (!box.intersectsBox(node.box)) {
                node.weight *= backgroundPenalty;
            }
            lessBudget += node.lods[maxLevel].counts;
        }
        this.lessUsedBudget = lessBudget;
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
        this.outsidePenalty = config?.outsidePenalty ?? this.outsidePenalty;
        this.behindPenalty = config?.behindPenalty ?? this.behindPenalty;
        this.behindTolerance = config?.behindTolerance ?? this.behindTolerance;
        this.behindDistanceTolerance = config?.behindDistanceTolerance ?? this.behindDistanceTolerance;
        this.distanceStep = config?.distanceStep ?? this.distanceStep;
        this.hysteresisTicks = config?.hysteresisTicks ?? this.hysteresisTicks;
        this.schedulerParallelCounts = config?.schedulerParallelCounts ?? this.schedulerParallelCounts;
        this.schedulerExistingTaskLimit = config?.schedulerExistingTaskLimit ?? this.schedulerExistingTaskLimit;
        this.schedulerMinDuration = config?.schedulerMinDuration ?? this.schedulerMinDuration;
        this.debuggerEnabled = config?.debuggerEnabled ?? this.debuggerEnabled;
    }

    private flush = async () => {
        const {
            maxBudget,
            hysteresisTicks,
            schedulerParallelCounts,
            schedulerExistingTaskLimit,
            debuggerEnabled,
            container,
            resourceManager,
            viewerCtx,
            nodes,
            proxies,
            realUsedBudget,
        } = this;

        // create merged proxies
        const targetLevels = new Array<number>(nodes.length);
        const targetProxies: LodProxy[] = [];
        let prevProxy: LodProxy | undefined;
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const { currentLevel, targetLevel, lods } = node;
            targetLevels[i] = targetLevel;
            const lod = lods[targetLevel];
            const currentLod = currentLevel >= 0 ? lods[currentLevel] : undefined;
            if (
                currentLod &&
                currentLod.resourceIdx === lod.resourceIdx &&
                currentLod.offset === lod.offset &&
                currentLod.counts === lod.counts
            ) {
                node.currentLevel = targetLevel;
                node.unstableTicks = 0;
            }
            if (
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
            isCached: boolean;
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
                component.weight = Math.max(component.weight, node.targetWeight);
                component.isReady ||=
                    node.currentLevel < 0 ||
                    (node.currentLevel !== node.targetLevel && node.unstableTicks >= hysteresisTicks);
                if (node.currentLevel < 0 || node.currentLevel !== node.targetLevel) {
                    hasChange = true;
                }
            }
            if (
                !hasChange &&
                component.newList.length > 0 &&
                component.newList.length < component.oldList.length &&
                component.budgetDelta <= 0
            ) {
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
                    isCached: false,
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
                component.isCached = resourceManager.has(proxy.resourceIdx);
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
        // ready & cached & downsample component
        for (let i = 0; i < components.length; i++) {
            const component = components[i];
            if (!component.isReady || !component.isCached || component.budgetDelta > 0) {
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
                    component.budgetDelta > restBudget ||
                    (component.isCached && cachedNodes >= schedulerExistingTaskLimit) ||
                    (!component.isCached && loadingNodes >= schedulerParallelCounts)
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
            if (pick.isCached) {
                cachedNodes += pick.newList.length;
            } else {
                loadingNodes += pick.newList.length;
            }
        }
        // not ready component
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
                    (component.isCached && cachedNodes >= schedulerExistingTaskLimit) ||
                    (!component.isCached && loadingNodes >= schedulerParallelCounts)
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
            if (pick.isCached) {
                cachedNodes += pick.newList.length;
            } else {
                loadingNodes += pick.newList.length;
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
            if (debuggerEnabled) {
                splat.setEffectConfig({
                    enabled: true,
                    overrideEnabled: true,
                    overrideColor: LOD_LEVEL_COLORS[targetLevels[nodeStart]],
                });
            }
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
        const {
            nodes,
            minLevel,
            maxLevel,
            maxBudget,
            lessUsedBudget,
            outsidePenalty,
            behindPenalty,
            behindTolerance,
            behindDistanceTolerance,
            distanceStep,
        } = this;
        camera.updateMatrixWorld();

        const { position: cameraPos, quaternion: cameraQuat } = camera;
        const frustum = new Frustum().setFromMatrix(
            new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
        );
        const cameraDir = new Vector3(0, 0, -1).applyQuaternion(cameraQuat);
        const nodeWeights = nodes
            .map((node, idx) => {
                const closestPoint = node.box.clampPoint(cameraPos, tempVec3);
                const insideBox = node.box.containsPoint(cameraPos);
                const dist = insideBox ? 0 : cameraPos.distanceTo(closestPoint);
                const dirDot = cameraDir.dot(closestPoint.sub(cameraPos).normalize());
                const isInside = frustum.intersectsBox(node.box);
                const isBehind = !insideBox && dirDot < behindTolerance && dist > behindDistanceTolerance;
                const weight =
                    (node.weight / (1 + 0.1 * dist * dist)) *
                    (isInside ? 1 : outsidePenalty * (isBehind ? behindPenalty : 1));
                return { idx, node, weight, isInside, isBehind, dist };
            })
            .sort((a, b) => b.weight - a.weight);
        const steppedNodes: Array<
            DistanceStep & {
                nodes: typeof nodeWeights;
            }
        > = distanceStep.map(e => ({
            ...e,
            nodes: [],
        }));
        // step 1 fallback slice.
        steppedNodes.push({
            distance: Infinity,
            step: 1,
            nodes: [],
        });
        let stepIndex = 0;
        // split inside nodes by distance according to the weight order.
        for (const node of nodeWeights) {
            // not inside, always use step 1.
            if (!node.isInside) {
                steppedNodes[steppedNodes.length - 1].nodes.push(node);
                continue;
            }
            if (node.dist <= steppedNodes[stepIndex].distance) {
                steppedNodes[stepIndex].nodes.push(node);
            } else {
                stepIndex++;
                steppedNodes[stepIndex].nodes.push(node);
            }
        }
        const levels = new Uint8Array(nodes.length).fill(maxLevel);
        let insideOnly: boolean = true;
        let restBudget = maxBudget - lessUsedBudget;

        while (restBudget > 0) {
            const prev = restBudget;
            for (const stepped of steppedNodes) {
                for (let step = 0; step < stepped.step; step++) {
                    for (const node of stepped.nodes) {
                        const {
                            idx,
                            node: { lods },
                            isInside,
                        } = node;
                        if (insideOnly && !isInside) {
                            continue;
                        }
                        const level = levels[idx];
                        if (level > minLevel) {
                            restBudget -= lods[level - 1].counts - lods[level].counts;
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
            if (prev === restBudget) {
                if (!insideOnly) {
                    break;
                }
                insideOnly = false;
            }
        }

        for (let i = 0; i < nodeWeights.length; i++) {
            const { idx, node, weight } = nodeWeights[i];
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
            node.targetLevel = level;
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
        const loop = async () => {
            const counts = await this.flush();
            await sleep(this.schedulerMinDuration);
            if (!counts && this.running) {
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
