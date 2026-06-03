import type { DrawableList, ProjectedDrawcallList, Drawcall, RenderObjectsType, DrawcallListClassifyType } from '../scene/tools/DrawcallList';
import type { IRenderer } from '../renderer/IRenderer';
import type { MaterialDispatcher } from '../renderer/MaterialDispatcher';
import type { Camera3D } from '../scene/cameras/Camera3D';
import { type Drawable, OutlineRenderMode, type DrawableRenderMode } from '../scene/drawables/Drawable';
import { TypeAssert } from '../scene/tools/TypeAssert';
import type { Object3D } from '../scene/Object3D';
import type { Scene3D } from '../scene/Scene3D';
import type { Light } from '../scene/lights/Light';
import type { Cone } from '../math/Cone';
import { Vector3 } from '../math/Vector3';

export enum ShadowMode {
    EnableAll = 10,
    DisableCsm = 20,
    DisableAll = 30,
}

type Filter<T> = (drawcall: T) => boolean;

function not<T>(f: Filter<T>): Filter<T> {
    return (drawcall) => !f(drawcall);
}

// function and<T>(f: Filter<T>, f2: Filter<T>): Filter<T> {
//     return (drawcall) => {
//         return f(drawcall) && f2(drawcall);
//     };
// }

// function or<T>(f: Filter<T>, f2: Filter<T>): Filter<T> {
//     return (drawcall) => f(drawcall) || f2(drawcall);
// }

function isOutlineDefaultMode(drawcall: Drawcall): boolean {
    return drawcall.object.outlineRenderMode === OutlineRenderMode.Default;
}

function isOutlineDisableMode(drawcall: Drawcall): boolean {
    return drawcall.object.outlineRenderMode === OutlineRenderMode.DisableOutline;
}

const isTransparentLineNormal = (object: Drawable) => !TypeAssert.isMesh(object) || object.useOriginMaterialInTransparentMode;
const isTransparentLineNormalDrawcall = (d: Drawcall) => isTransparentLineNormal(d.object);

const tmpVec3 = new Vector3();
function isPlanarShadowReceiver(maxGroundHeight: number, maxGroundThickness: number) {
    return function (drawcall: Drawcall) {
        const drawable = drawcall.object;
        if (drawable.castPlanarShadow || !TypeAssert.isMesh(drawable)) {
            return false;
        }
        const box = drawable.worldBoundingBox;
        if (box.max.z > maxGroundHeight) {
            return false;
        }
        return box.getSize(tmpVec3).z <= maxGroundThickness;
    };
}

export interface IPipelineFilter<T extends Drawcall | Drawable = any> {
    $PARAM: any;
    $TYPE_NAME: string;
    (o: T): boolean;
}

export const PipelineFilters = (function <T extends Record<string, (...p: any[]) => (d: Drawcall | Drawable) => boolean>>(data: T): {
    [K in keyof T]: (...p: Parameters<T[K]>) => IPipelineFilter<Parameters<ReturnType<T[K]>>[0]>;
} {
    return Object.keys(data).reduce((prev, k, i, arr) => {
        const filter = function (...param: any) {
            const f = data[k](...param) as IPipelineFilter;
            f.$PARAM = param;
            f.$TYPE_NAME = k;
            return f;
        };
        prev[arr[i]] = filter;
        return prev;
    }, {} as any);
})({
    // drawcall filter
    isOutlineEncode: () => isOutlineDefaultMode,
    isOutlineDisable: () => isOutlineDisableMode,

    isDeferPhong: (overrideTransparent: boolean) => (d: Drawcall) => (overrideTransparent || !d.material.transparent) && TypeAssert.isDeferredMaterial(d.material),
    isNotDeferPhong: () => (d: Drawcall) => !TypeAssert.isDeferredMaterial(d.material),
    isDeferTransparent: (overrideTransparent: boolean) => (d: Drawcall) => (!overrideTransparent && d.material.transparent) && TypeAssert.isDeferredMaterial(d.material),

    planarShadowCaster: (maxGroundHeight: number) => (drawcall: Drawcall) => drawcall.object.castPlanarShadow &&
        TypeAssert.isMesh(drawcall.object) &&
        drawcall.object.worldBoundingBox.max.z > maxGroundHeight,
    planarShadowReceiver: isPlanarShadowReceiver,
    planarShadowExclude: (maxGroundHeight: number, maxGroundThickness: number) => not(isPlanarShadowReceiver(maxGroundHeight, maxGroundThickness)),

    transparentLineNormal: () => isTransparentLineNormalDrawcall,
    transparentLineNotNormal: () => not(isTransparentLineNormalDrawcall),
    transparentLineAdditional: () => (d: Drawcall) => TypeAssert.isLineSegments(d.object) || TypeAssert.isFatLineSegments(d.object),
    isDrawCallShadowMapCaster: () => (d: Drawcall) => d.object.castShadow && TypeAssert.isMesh(d.object),

    // drawable filter
    isInsideCone: (cone: Cone) => (o: Drawable) => !cone.isSphereOutsideCone(o.worldBoundingSphere),
    isDrawableShadowMapCaster: () => (o: Drawable) => o.castShadow && TypeAssert.isMesh(o),
    transparentLineNotNormalDrawable: () => not(isTransparentLineNormal),
});

export interface PipelineAPI {
    materialDispatcherCreate(m: MaterialDispatcher): void;
    materialDispatcherDestroy(m: MaterialDispatcher): void;
    materialDispatcherUpdate(m: MaterialDispatcher): void;

    drawableListCreate(list: DrawableList, capacity?: number): void;
    drawableListCreateFromScene(list: DrawableList, scene: Scene3D, isUseProxy: boolean, renderMode?: DrawableRenderMode): void;
    drawableListCreateFromFilter(list: DrawableList, filter: IPipelineFilter<Drawable>, target: DrawableList): void;
    drawableListAddDrawable(list: DrawableList, drawable: Drawable): void;
    drawableListUpdateSceneAndUse(list: DrawableList, scene: Scene3D): void;
    drawableListDestroy(list: DrawableList): void;

    drawcallListCreate(list: ProjectedDrawcallList, camera: Camera3D, cameraCulling: boolean, classifyType: DrawcallListClassifyType, enableLights: boolean): void;
    drawcallListCreateFromDynamic(list: ProjectedDrawcallList, scene: Scene3D, camera: Camera3D): void;
    drawcallListCreateFromStatic(list: ProjectedDrawcallList, scene: Scene3D, camera: Camera3D): void;
    drawcallListCreateFromDrawableList(list: ProjectedDrawcallList, drawableList: DrawableList, camera: Camera3D, cameraCulling: boolean, layerCulling: boolean, visibilityCulling: boolean, selections?: Array<{ groupIndex?: number[]; instanceIndex?: number; }>): void;
    drawcallListDestroy(list: ProjectedDrawcallList): void;

    renderDrawcallList(list: ProjectedDrawcallList, renderer: IRenderer, renderObjectsType: RenderObjectsType, filter?: IPipelineFilter<Drawcall>): void;
    renderDeferLight(renderer: IRenderer, scene: Scene3D, light: Light, shadowMode: ShadowMode, deferMesh: Drawable, deferCamera: Camera3D): void;
    renderDeferLights(renderer: IRenderer, scene: Scene3D, lights: Light[], shadowMode: ShadowMode, deferMesh: Drawable, deferCamera: Camera3D): void;

    getRenderListLength(list: ProjectedDrawcallList, renderObjectsType: RenderObjectsType): number | undefined;
    drawcallListGetCameraClosestDistance(list: DrawableList, camera: Camera3D): number | undefined;

    prepareTempRenderList(list: Object3D[]): void;
    cleanupTempRenderList(list: Object3D[]): void;
}

export * from './PipelineAPI.impl';
