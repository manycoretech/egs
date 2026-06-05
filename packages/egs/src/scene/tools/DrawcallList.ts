import type { Drawable } from '../drawables/Drawable';
import type { Nullable } from '../../utils/Utils';
import { TypeAssert } from './TypeAssert';
import type { Camera3D } from '../cameras/Camera3D';
import type { IRenderer } from '../../renderer/IRenderer';
import type { BufferGeometryBase, BufferRange } from '../../elements/geometries/containers/BufferGeometry';
import type { Material } from '../../elements/materials/Material';
import type { PopBufferGeometry } from '../../elements/geometries/containers/PopBufferGeometry';
import type { Renderable } from '../renderables/IRenderable';
import {
    PipelineContentBridge,
    PipelineContentAPIForRenderingAndFilteringEnabled,
    type IPipelineFilter,
} from '../../fx/PipelineAPI';
import type { PerspectiveCamera } from '../cameras/PerspectiveCamera';
import type { Box3 } from '../../math/Box3';
import { Frustum } from '../../math/Frustum';
import { ContentBridge } from '../../ContentAPI';
import type { PopMesh } from '../drawables/PopMesh';
import type { InstanceMesh } from '../drawables/InstanceMesh';

// This for indicate pop is set to max level by renderer auto level
const MAX_LEVEL_MAGIC_NUMBER = 17;

type Mapper<T> = (drawcall: T) => T | null;

export interface Drawcall {
    object: Drawable;
    range: Nullable<BufferRange>;
    material: Material;
    geometry: BufferGeometryBase;
}

export function filterBy(
    content: () => ProjectedDrawcallList,
    f: () => IPipelineFilter<Drawcall>,
): () => FilteredDrawcallList {
    return () => content().filterBy(f);
}

export class FilteredDrawcallList implements Renderable {
    filter: IPipelineFilter<Drawcall>;

    constructor(readonly list: ProjectedDrawcallList) {}

    config(_: IRenderer) {
        return true;
    }

    render(renderer: IRenderer, renderObjectsType: RenderObjectsType = RenderObjectsType.Default) {
        this.list.render(renderer, renderObjectsType, this.filter);
    }
}

interface DrawcallListClassifyResult {
    opaque: Drawcall[];
    transparent: Drawcall[];
    extraDrawcallList: Map<number, Drawcall[]>;
}

export interface DrawcallListClassifyType {
    $TYPE_NAME: string;
    (opaque: Drawcall[], transparent: Drawcall[]): DrawcallListClassifyResult;
}

export const DrawcallListClassifyList = (function <
    T extends Record<string, (opaque: Drawcall[], transparent: Drawcall[]) => DrawcallListClassifyResult>,
>(
    data: T,
): {
    [K in keyof T]: DrawcallListClassifyType;
} {
    return Object.keys(data).reduce((p, k, i, arr) => {
        const f = data[k] as DrawcallListClassifyType;
        f.$TYPE_NAME = k;
        p[arr[i]] = f;
        return p;
    }, {} as any);
})({
    default(o: Drawcall[], t: Drawcall[]) {
        return {
            opaque: o.sort(sortByRenderOrderAndProgram),
            transparent: t.sort(sortByRenderOrderAndZ),
            extraDrawcallList: new Map(),
        };
    },
    opaque(o: Drawcall[], _t: Drawcall[]) {
        return {
            opaque: o.sort(sortByRenderOrderAndProgram),
            transparent: [],
            extraDrawcallList: new Map(),
        };
    },
    transparent(_o: Drawcall[], t: Drawcall[]) {
        return {
            opaque: [],
            transparent: t.sort(sortByRenderOrderAndZ),
            extraDrawcallList: new Map(),
        };
    },
    oit(_o: Drawcall[], t: Drawcall[]) {
        const transparent: Drawcall[] = [];
        const oit: Drawcall[] = [];
        const oitAfter: Drawcall[] = [];
        for (let i = 0; i < t.length; i++) {
            const item = t[i];
            if (TypeAssert.isSprite(item.object)) {
                oitAfter.push(item);
                continue;
            }
            if (item.object.renderOrder === 0) {
                oit.push(item);
            } else if (item.object.renderOrder < 0) {
                transparent.push(item);
            } else {
                oitAfter.push(item);
            }
        }
        transparent.sort(sortByRenderOrderAndZ);
        oit.sort(sortByRenderOrderAndProgram);
        oitAfter.sort(sortByRenderOrderAndZ);

        const extraDrawcallList = new Map<number, Drawcall[]>([
            [RenderObjectsType.OIT, oit],
            [RenderObjectsType.AfterOIT, oitAfter],
        ]);

        return {
            opaque: [],
            transparent,
            extraDrawcallList,
        };
    },
    overlay(o: Drawcall[], t: Drawcall[]) {
        return {
            opaque: o.concat(t).sort(sortByOverlayLayersAndRenderOrder),
            transparent: [],
            extraDrawcallList: new Map(),
        };
    },
});

export enum RenderObjectsType {
    Default,
    Opaque,
    Transparent,
    OIT,
    AfterOIT,
}

export class ProjectedDrawcallList implements Renderable {
    extraDrawcallList = new Map<number, Drawcall[]>();

    constructor(
        readonly list: DrawableList,
        public opaque: Drawcall[],
        public transparent: Drawcall[],
        private camera: Camera3D,
    ) {}

    useOnce = true;
    private destroyed = false;

    destroy() {
        if (!this.destroyed) {
            PipelineContentBridge.drawcallListDestroy(this);
            this.destroyed = true;
        }
    }

    private renderObjects(renderer: IRenderer, drawcallList: Drawcall[], filter?: IPipelineFilter<Drawcall>): void {
        for (let i = 0, l = drawcallList.length; i < l; i++) {
            const drawcall = drawcallList[i];
            if (filter === undefined || filter(drawcall)) {
                renderer.renderDrawcall(drawcall.geometry, drawcall.material, drawcall.object, drawcall.range);
            }
        }
    }

    config(_: IRenderer) {
        return true;
    }

    getRenderListLength(type: RenderObjectsType) {
        if (PipelineContentAPIForRenderingAndFilteringEnabled()) {
            return PipelineContentBridge.getRenderListLength(this, type) ?? 0;
        } else {
            return (this.extraDrawcallList.get(RenderObjectsType.OIT) ?? []).length;
        }
    }

    render(
        renderer: IRenderer,
        renderObjectsType: RenderObjectsType = RenderObjectsType.Default,
        filter?: IPipelineFilter<Drawcall>,
    ) {
        if (PipelineContentAPIForRenderingAndFilteringEnabled()) {
            PipelineContentBridge.renderDrawcallList(this, renderer, renderObjectsType, filter);
        } else {
            renderer.resetRenderState();
            renderer.useCamera(this.camera);
            if (renderObjectsType === RenderObjectsType.Default) {
                this.renderObjects(renderer, this.opaque, filter);
                this.renderObjects(renderer, this.transparent, filter);
            } else if (renderObjectsType === RenderObjectsType.Opaque) {
                this.renderObjects(renderer, this.opaque, filter);
            } else if (renderObjectsType === RenderObjectsType.Transparent) {
                this.renderObjects(renderer, this.transparent, filter);
            } else {
                const drawcallList = this.extraDrawcallList.get(renderObjectsType) ?? [];
                this.renderObjects(renderer, drawcallList, filter);
            }
        }
        if (this.useOnce) {
            this.destroy();
        }
    }

    filterBy(f: () => IPipelineFilter<Drawcall>): FilteredDrawcallList {
        const list = new FilteredDrawcallList(this);
        list.filter = f();
        return list;
    }
}

let popRefreshId = 0;

let windowHeight = window.innerHeight;
window.addEventListener('resize', function (_) {
    windowHeight = window.innerHeight;
});
export class DrawableList {
    private destroyed = false;
    private _lodEnabled = true;
    set lodEnabled(v: boolean) {
        this._lodEnabled = v;
    }
    get lodEnabled() {
        return this._lodEnabled;
    }

    destroy() {
        if (!this.destroyed) {
            PipelineContentBridge.drawableListDestroy(this);
            this.destroyed = true;
        }
    }

    list: Drawable[] = [];

    push(d: Drawable) {
        this.list.push(d);
    }

    filter(f: () => IPipelineFilter<Drawable>, forceExecJS: boolean = false): DrawableList {
        const list = new DrawableList();
        const filter = f();
        const enablePipelineProxy = PipelineContentAPIForRenderingAndFilteringEnabled();
        if (enablePipelineProxy) {
            PipelineContentBridge.drawableListCreateFromFilter(this, filter, list);
        }
        if (!enablePipelineProxy || forceExecJS) {
            const innerList = list.list;
            for (let i = 0, ds = this.list, l = ds.length; i < l; i++) {
                const d = ds[i];
                if (filter(d)) {
                    innerList.push(d);
                }
            }
        }
        return list;
    }

    filterMap(f: Mapper<Drawable>): DrawableList {
        const list = new DrawableList();
        this.list.forEach(item => {
            const r = f(item);
            if (r) {
                list.push(r);
            }
        });
        return list;
    }

    project(
        camera: Camera3D,
        isCulledByCamera = true,
        viewHeight = windowHeight,
        classifyType: DrawcallListClassifyType = DrawcallListClassifyList.default,
        enableLights = true,
    ): ProjectedDrawcallList {
        camera.culler.update(camera);
        if (PipelineContentAPIForRenderingAndFilteringEnabled()) {
            const list = new ProjectedDrawcallList(this, [], [], camera);
            PipelineContentBridge.drawcallListCreate(list, camera, isCulledByCamera, classifyType, enableLights);
            return list;
        } else {
            const list = isCulledByCamera
                ? this.filter((() => camera.queryCulling) as () => IPipelineFilter<Drawable>)
                : this.filter((() => camera.filterLayers) as () => IPipelineFilter<Drawable>); // safe in js
            list.lodEnabled = this._lodEnabled;
            list.updateRenderInfoInList(camera, viewHeight);
            list.updateLODs(camera, viewHeight);

            const transparent: Drawcall[] = [];
            const opaque: Drawcall[] = [];
            list.forEach(object => {
                object.appendDrawcall(transparent, opaque);
            });

            const { opaque: o, transparent: t, extraDrawcallList } = classifyType(opaque, transparent);
            const drawcallList = new ProjectedDrawcallList(this, o, t, camera);
            drawcallList.extraDrawcallList = extraDrawcallList;
            return drawcallList;
        }
    }

    updateRenderInfoInList(camera: Camera3D, viewHeight: number) {
        for (let i = 0, list = this.list, l = list.length; i < l; i++) {
            const object = list[i];
            object.updateRenderInfo(camera, viewHeight);
        }
    }

    updateLODs(camera: Camera3D, viewHeight: number) {
        popRefreshId++;
        if (TypeAssert.isPerspectiveCamera(camera)) {
            const pixelsOfDistOne = camera.getPixelsOfDistOne();
            this.forEach(item => {
                updateLOD(item, viewHeight, pixelsOfDistOne, popRefreshId, this.lodEnabled);
            });
        } else {
            this.forEach(item => {
                updateLOD(item, viewHeight, 0, popRefreshId, this.lodEnabled);
            });
        }
        return this;
    }

    forEach(f: (item: Drawable, index: number) => any): void {
        for (let i = 0, list = this.list, l = list.length; i < l; i++) {
            f(list[i], i);
        }
    }

    getCameraClosestDistance(camera: PerspectiveCamera) {
        if (PipelineContentAPIForRenderingAndFilteringEnabled()) {
            ContentBridge.sceneNodeSyncMatrix(camera);
            return PipelineContentBridge.drawcallListGetCameraClosestDistance(this, camera) ?? 1;
        } else {
            const boxes: Box3[] = [];
            this.forEach(object => {
                boxes.push(object.worldBoundingBox);
            });
            return new Frustum().getCameraClosestDistanceFromBoxes(camera, boxes);
        }
    }
}

function sortByRenderOrderAndProgram(a: Drawcall, b: Drawcall): number {
    return a.object.renderOrder - b.object.renderOrder || a.material.programId - b.material.programId;
}

function sortByRenderOrderAndZ(a: Drawcall, b: Drawcall): number {
    const renderOrderDiff = a.object.renderOrder - b.object.renderOrder;
    if (renderOrderDiff !== 0) {
        return renderOrderDiff;
    }
    return b.object.z - a.object.z;
}

function sortByOverlayLayersAndRenderOrder(a: Drawcall, b: Drawcall): number {
    const overlayLayersDiff = a.object.overlayLayers - b.object.overlayLayers;
    if (overlayLayersDiff !== 0) {
        return overlayLayersDiff;
    }
    const renderOrderDiff = a.object.renderOrder - b.object.renderOrder;
    if (renderOrderDiff !== 0) {
        return renderOrderDiff;
    }
    return a.material.programId - b.material.programId;
}

// helper functions to update pop level
function updateLOD(
    object: Drawable,
    viewHeight: number,
    pixelsOfDistOne: number,
    updateId: number,
    lodEnabled: boolean,
) {
    if ((object as any).LODUpdateId === undefined) {
        return;
    }

    let targetObject: PopMesh;
    let geometry: PopBufferGeometry;
    let maxScaleOnAxis = 1;
    if (TypeAssert.isPopMesh(object)) {
        targetObject = object;
        geometry = targetObject.renderGeometry as PopBufferGeometry;
        maxScaleOnAxis = targetObject.matrixWorld.getMaxScaleOnAxis();
    } else if (
        TypeAssert.isInstanceMesh(object) &&
        object.firstProxyedMesh &&
        TypeAssert.isPopMesh(object.firstProxyedMesh) &&
        TypeAssert.isPopBufferGeometry(object.instancedGeometry)
    ) {
        targetObject = object.firstProxyedMesh;
        geometry = object.instancedGeometry;
        maxScaleOnAxis = object.maxScaleOnAxis; // which one should use? max value?
    } else {
        return;
    }

    if (object.LODUpdateId === updateId) {
        return;
    }
    object.LODUpdateId = updateId;

    lodEnabled = targetObject.isLODEnabled && lodEnabled;

    let newLevel = MAX_LEVEL_MAGIC_NUMBER;
    if (lodEnabled) {
        newLevel = calculateLevelFactor(viewHeight, pixelsOfDistOne, geometry, maxScaleOnAxis, object.z);
    }

    if (object.oldLevelFactor !== newLevel) {
        updateLODbyLevel(object, geometry, newLevel, lodEnabled);
        object.oldLevelFactor = newLevel;
    }
}

function getLevel(levelPrecisions: number[], precision: number): number {
    const size = levelPrecisions.length;
    let index = size - 1;
    for (let i = 0; i < size; i++) {
        if (levelPrecisions[i] <= precision) {
            index = i;
            break;
        }
    }
    return index;
}

function calculateLevelFactor(
    viewHeight: number,
    pixelsOfDistOne: number,
    geometry: PopBufferGeometry,
    maxScaleOnAxis: number,
    distance: number,
): number {
    const {
        metadata: { boxSizeMagnitude },
    } = geometry;
    const pixels = distance * (pixelsOfDistOne / viewHeight);
    const bixSizeMagnitudeWorld = boxSizeMagnitude * maxScaleOnAxis;
    const arg = bixSizeMagnitudeWorld / pixels;
    let levelFactor = Math.ceil(Math.log(arg) / Math.LN2);
    levelFactor = Math.max(levelFactor, 0);
    return levelFactor;
}

export function updateLODbyLevel(
    object: PopMesh | InstanceMesh,
    geometry: PopBufferGeometry,
    levelFactor: number,
    isLODEnabled = true,
): void {
    const {
        model: { levelPrecisions, maxPrecision, blocks },
        metadata: { vertexConstant, vertexGridSize },
    } = geometry;
    const precision = maxPrecision - levelFactor;
    const levelIndex = getLevel(levelPrecisions, precision);
    const powPrecision = Math.pow(2.0, levelPrecisions[levelIndex]);

    const lodInfo = object.lodInfo;
    if (isLODEnabled) {
        lodInfo.set([vertexGridSize, powPrecision, vertexConstant.x, vertexConstant.y, vertexConstant.z]);
    } else {
        lodInfo.set([1, 1, 0, 0, 0]);
    }

    const overrideGroups: BufferRange[] = [];
    geometry.getGroups().forEach((_, i) => {
        overrideGroups[i] = {
            start: blocks[i].start,
            count: blocks[i].levelFaceAccumulateCounts[levelIndex] * 3,
        };
    });
    object.overrideGroups = overrideGroups;
}
