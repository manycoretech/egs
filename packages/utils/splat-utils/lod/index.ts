import { deferred, sleep, Deferred } from '@qunhe/egs-lib';
import { __INTERNAL__, Box3, Vector3, Camera, Object3D, Frustum, Matrix4, SplatSortedEvent, Splat, Vector4, IViewerContext } from '@qunhe/egs';
import { parseSplatData, detectSplatFileType } from '@qunhe/egs-splat-loader';
import { ResourceManager } from './ResourceManager';

interface IBox {
    min: [number, number, number];
    max: [number, number, number];
}

export interface LodMeta {
    magicCode: 2500660,
    type: 'lod-splat',
    version: number;
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
    // <=
    distance: number;
    step: number;
};

const DEFAULT_DISTANCE_STEP: DistanceStep[] = [{
    distance: 5,
    step: 3,
}, {
    distance: 10,
    step: 2
}];

export interface LodConfig {
    minLevel: number;
    maxBudget: number;
    backgroundPenalty: number;
    outsidePenalty: number;
    behindPenalty: number;
    behindTolerance: number;
    behindDistanceTolerance: number;
    distanceStep: DistanceStep[],
    hysteresisTicks: number;
    schedulerParallelCounts: number;
    schedulerExistingTaskLimit: number;
    schedulerMinDuration: number;

    debuggerEnabled: boolean;
    debuggerType: 0 | 1; // 0: level, 1: chunk idx
}

function DefaultLoadResource(url: string) {
    const type = detectSplatFileType(url, new Uint8Array());
    return parseSplatData(type!, url);
}

function getLodLevelDebuggerColor(level: number) {
    const COLORS = [
        new Vector4(1.0, 0.2, 0.0, 1),
        new Vector4(1.0, 1.0, 0.0, 1),
        new Vector4(0.0, 1.0, 0.4, 1),
        new Vector4(0.0, 0.8, 1.0, 1),
        new Vector4(0.0, 0.4, 1.0, 1),
    ];
    return COLORS[level];
}

function getChunkIdxDebuggerColor(idx: number) {
    const r = (idx >> 16 & 255) / 255;
    const g = (idx >> 8 & 255) / 255;
    const b = (idx & 255) / 255;
    return new Vector4(r, g, b, 1);
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
    currentSplat: Splat | undefined;

    targetWeight: number;
    targetLevel: number;
    unstableTicks: number;
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
    private debuggerType: 0 | 1;

    private viewerCtx?: IViewerContext;
    private resourceManager: ResourceManager;
    private nodes: LodNode[];
    private lessUsedBudget: number;

    readonly container = new Object3D();

    constructor(
        meta: LodMeta, config: Partial<LodConfig> = {},
        viewerCtx?: IViewerContext, loadResource: typeof DefaultLoadResource = DefaultLoadResource,
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
        this.debuggerType = config?.debuggerType ?? 0;

        this.viewerCtx = viewerCtx;
        this.resourceManager = new ResourceManager(meta.files, meta.permanentFiles, loadResource);
        this.nodes = meta.tree.map(({ bound, lods }) => ({
            box: new Box3(
                new Vector3(bound.min[0], bound.min[1], bound.min[2]),
                new Vector3(bound.max[0], bound.max[1], bound.max[2]),
            ),
            lods: lods.map(v => ({ resourceIdx: v.file, offset: v.offset, counts: v.count })),
            weight: 2,
            currentLevel: -1,
            currentSplat: undefined,
            targetWeight: 0,
            targetLevel: -1,
            unstableTicks: 0,
        }));

        const { nodes, maxLevel, backgroundPenalty } = this;
        const { forwardBox } = meta;
        const box = new Box3(
            new Vector3(forwardBox.min[0], forwardBox.min[1], forwardBox.min[2]),
            new Vector3(forwardBox.max[0], forwardBox.max[1], forwardBox.max[2]),
        );
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
        this.backgroundPenalty = config?.backgroundPenalty ?? this.backgroundPenalty;
        this.outsidePenalty = config?.outsidePenalty ?? this.outsidePenalty;
        this.behindPenalty = config?.behindPenalty ?? this.behindPenalty;
        this.behindTolerance = config?.behindTolerance ?? this.behindTolerance;
        this.behindDistanceTolerance = config?.behindDistanceTolerance ?? this.behindDistanceTolerance;
        this.hysteresisTicks = config?.hysteresisTicks ?? this.hysteresisTicks;
        this.schedulerParallelCounts = config?.schedulerParallelCounts ?? this.schedulerParallelCounts;
        this.schedulerExistingTaskLimit = config?.schedulerExistingTaskLimit ?? this.schedulerExistingTaskLimit;
        this.schedulerMinDuration = config?.schedulerMinDuration ?? this.schedulerMinDuration;
        this.debuggerEnabled = config?.debuggerEnabled ?? this.debuggerEnabled;
        this.debuggerType = config?.debuggerType ?? this.debuggerType;
    }

    private flush = async () => {
        const {
            container, resourceManager, nodes, viewerCtx,
            hysteresisTicks, schedulerParallelCounts, schedulerExistingTaskLimit, debuggerEnabled, debuggerType,
        } = this;

        const existResourceTasks: Array<{ idx: number, node: LodNode }> = [];
        const loadResourceTasks: Array<{ idx: number, node: LodNode }> = [];
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const { lods, currentLevel, targetLevel, unstableTicks } = node;
            if (
                (node.currentLevel >= 0) &&
                (currentLevel === targetLevel || unstableTicks < hysteresisTicks)
            ) {
                continue;
            }
            const currentLod = lods[currentLevel];
            const targetLod = lods[targetLevel];
            if (
                currentLod &&
                currentLod.resourceIdx === targetLod.resourceIdx &&
                currentLod.offset === targetLod.offset &&
                currentLod.counts === targetLod.counts
            ) {
                node.currentLevel = node.targetLevel;
                node.unstableTicks = 0;
                continue;
            }
            (resourceManager.has(targetLod.resourceIdx) ? existResourceTasks : loadResourceTasks).push({ idx: i, node });
        }
        existResourceTasks.sort((a, b) => b.node.targetWeight - a.node.targetWeight);
        loadResourceTasks.sort((a, b) => b.node.targetWeight - a.node.targetWeight);

        const tasks: Array<{ idx: number, node: LodNode }> = [];
        for (let i = 0; i < existResourceTasks.length; i++) {
            if (tasks.length >= schedulerExistingTaskLimit) {
                break;
            }
            tasks.push(existResourceTasks[i]);
        }
        for (let i = 0; i < loadResourceTasks.length; i++) {
            if (tasks.length >= schedulerParallelCounts) {
                break;
            }
            tasks.push(loadResourceTasks[i]);
        }
        for (let i = 0; i < nodes.length; i++) {
            if (tasks.length >= schedulerParallelCounts) {
                break;
            }
            const node = nodes[i];
            if (node.currentLevel === node.targetLevel) {
                continue;
            }
            tasks.push({ idx: i, node });
        }

        const renderer = viewerCtx?.viewer._getEngine().renderer;
        const resources = await Promise.all(tasks.map(async ({ node }) => {
            const { targetLevel, lods } = node;
            const { resourceIdx, offset, counts } = lods[targetLevel];
            const splat = await resourceManager.loadSplat(resourceIdx, offset, counts);
            if (renderer) {
                for (let i = 0; i < splat.extrasTex.length; i++) {
                    renderer.queueFlushTexture(splat.extrasTex[i]);
                }
            }
            return { level: targetLevel, splat };
        }));

        const promises: Array<Promise<void>> = [];
        for (let i = 0; i < tasks.length; i++) {
            const { idx, node } = tasks[i];
            const { level, splat } = resources[i];
            const { promise, resolve } = deferred();
            if (debuggerEnabled) {
                splat.setEffectConfig({
                    enabled: true,
                    overrideEnabled: true,
                    overrideColor: debuggerType === 0 ? getLodLevelDebuggerColor(level) : getChunkIdxDebuggerColor(idx * 16),
                });
            }
            splat.once(SplatSortedEvent, () => {
                if (node.currentSplat) {
                    container.remove(node.currentSplat);
                    resourceManager.release(node.lods[node.currentLevel].resourceIdx);
                }
                node.unstableTicks = 0;
                node.currentLevel = level;
                node.currentSplat = splat;
                resolve();
            });
            container.add(splat);
            promises.push(promise);
        }
        await Promise.all(promises);

        return tasks.length;
    };

    tick(camera: Camera) {
        const {
            nodes, minLevel, maxLevel, maxBudget, lessUsedBudget,
            outsidePenalty, behindPenalty, behindTolerance, behindDistanceTolerance, distanceStep
        } = this;
        camera.updateMatrixWorld();

        const { position: cameraPos, quaternion: cameraQuat } = camera;
        const frustum = new Frustum().setFromMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
        const cameraDir = new Vector3(0, 0, -1).applyQuaternion(cameraQuat);
        const nodeWeights = nodes.map((node, idx) => {
            const closestPoint = node.box.clampPoint(cameraPos, tempVec3);
            const insideBox = node.box.containsPoint(cameraPos);
            const dist = insideBox ? 0 : cameraPos.distanceTo(closestPoint);
            const dirDot = cameraDir.dot(closestPoint.sub(cameraPos).normalize());
            const isInside = frustum.intersectsBox(node.box);
            const isBehind = !insideBox && dirDot < behindTolerance && dist > behindDistanceTolerance;
            const weight = (node.weight / (1 + 0.1 * dist * dist)) *
                (isInside ? 1 : outsidePenalty * (isBehind ? behindPenalty : 1));
            return { idx, node, weight, isInside, isBehind, dist };
        }).sort((a, b) => b.weight - a.weight);
        const steppedNodes: Array<DistanceStep & {
            nodes: typeof nodeWeights
        }> = distanceStep.map(e => ({
            ...e,
            nodes: []
        }));
        // step 1 fallback slice.
        steppedNodes.push({
            distance: Infinity,
            step: 1,
            nodes: []
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
                        const { idx, node: { lods }, isInside } = node;
                        if (insideOnly && !isInside) {
                            continue;
                        }
                        const level = levels[idx];
                        if (level > minLevel) {
                            restBudget -= (lods[level - 1].counts - lods[level].counts);
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
                ((node.targetLevel >= node.currentLevel) && (level > node.currentLevel)) ||
                ((node.targetLevel <= node.currentLevel) && (level < node.currentLevel))
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

        const { container, nodes } = this;
        container.removeFromParent();
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            if (node.currentSplat) {
                container.remove(node.currentSplat);
                node.currentSplat.destroy();
            }
        }

        this.running?.resolve();
        this.running = undefined;
        this.viewerCtx = undefined;
    }
}
