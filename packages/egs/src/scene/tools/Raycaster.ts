import { TypeAssert } from './TypeAssert.js';
import { Layers } from './Layers.js';
import type { Vector3 } from '../../math/Vector3.js';
import type { Vector2 } from '../../math/Vector2.js';
import type { Object3D } from '../Object3D.js';
import { Ray } from '../../math/Ray.js';
import type { Face3 } from '../../math/Face3.js';
import type { Camera3D } from '../cameras/Camera3D.js';
import type { Nullable } from '../../utils/Utils.js';
import { hasManagedContentAPI, ManagedContentBridge } from '../../ContentAPI.js';
import type { Scene3D } from '../Scene3D.js';

function ascSort(a: Intersection, b: Intersection) {
    return a.distance - b.distance;
}

function intersectObject(object: Object3D, raycaster: Raycaster, intersects: Intersection[], recursive: boolean) {
    if (!object.visible || !raycaster.layers.test(object.netInteractionLayer)) {
        return;
    }

    if (TypeAssert.isDrawable(object)) {
        if (raycaster._camera) {
            object._updateMatrixByViewIndependentScale(raycaster._camera, raycaster._viewHeight);
        }
        object.raycast(raycaster, intersects);
    }

    if (recursive) {
        const children = object.children;
        for (let i = 0, l = children.length; i < l; i++) {
            const o = children[i];
            intersectObject(o, raycaster, intersects, true);
        }
    }
}

/**
 * The attributes of this Intersection used to record the result of calculation.
 */
export interface Intersection {
    object: Object3D;
    point: Vector3;
    distance: number;
    /**
     * primitive of the intersection
     * for indexed geometry, it related to index buffer
     * for non-index geometry, it is related to position buffer
     */
    primitiveIndex: number;
    // only exist when hit points
    distanceToRay?: number;
    /**
     * @deprecated use `primitiveIndex` instead
     * only exist when hit points or lines
     * the value maybe confused, not recommended to use
     */
    index?: number;
    // only exist when hit mesh
    face?: Face3;
    // only exist when hit mesh
    uv?: Vector2;
    /**
     * @deprecated use `primitiveIndex` instead
     * only exist when hit mesh
     */
    faceIndex?: number;
    // only exist when hit instanceMesh
    instanceIndex?: number;
}

/**
 * This class is designed to assist with raycasting.
 * Raycasting is used for mouse picking (working out what objects in the 3d space the mouse is over) amongst other things.
 */
export class Raycaster {
    /**
     * The Ray used for the raycasting.
     */
    ray: Ray;
    /**
     * The near factor of the raycaster.
     * This value indicates which objects can be discarded based on the distance.
     * This value shouldn't be negative and should be smaller than the far property.
     */
    near: number;
    /**
     * The far factor of the raycaster.
     * This value indicates which objects can be discarded based on the distance.
     * This value shouldn't be negative and should be larger than the near property.
     */
    far: number;
    /**
     * The precision factor of the raycaster when intersecting Line objects.
     */
    linePrecision = 1;
    /**
     * The distance threshold to check a point's intersection.
     */
    pointThreshold = 1;

    layers = new Layers();
    /**
     * Accept some difference when picked point do not locate on the line or points
     */
    enableScreenSpaceTolerance = false;

    _camera: Nullable<Camera3D> = null;
    _viewHeight = 1000;

    constructor(origin?: Vector3, direction?: Vector3, near = 0, far = Infinity) {
        this.ray = new Ray(origin, direction);
        this.near = near;
        this.far = far;
    }
    /**
     * Set {@link ray| ray}, {@link near| near} and {@link far| far} by given origin and direction.
     * @param origin The origin vector where the ray casts from.
     * @param direction The normalized direction vector that gives direction to the ray.
     */
    set(origin: Vector3, direction: Vector3) {
        this.ray.set(origin, direction);
        this.near = 0;
        this.far = Infinity;
    }
    /**
     * Set {@link ray| ray} by given camera's {@link Camera3D.castRay| castRay}.
     * @param coords the position of window where the ray through out.
     * @param camera used to decide a way of casting the ray.
     * @param {number} viewHeight the hight of view window.
     */
    setFromCamera(coords: Vector2, camera: Camera3D, viewHeight?: number) {
        if (viewHeight === undefined) {
            viewHeight = window.innerHeight;
        }
        this.layers.mask = camera.layers.mask;
        if (TypeAssert.isPerspectiveCamera(camera) || TypeAssert.isOrthographicCamera(camera)) {
            this.near = camera.near;
            this.far = camera.far;
        }
        camera.castRay(this.ray, coords);
        this._camera = camera;
        this._viewHeight = viewHeight;
    }
    /**
     * @internal
     */
    getScreenLineToleranceSq(distance: number): number {
        if (!this._camera) {
            return 0;
        }
        const tolerance = this.linePrecision / this._camera.pixelsPerUnit(distance, this._viewHeight);
        return tolerance * tolerance;
    }
    /**
     * @internal
     */
    getPointTolerance(distance: number): number {
        if (!this._camera) {
            return 0;
        }
        if (!this.enableScreenSpaceTolerance) {
            return this.pointThreshold;
        }
        return this.pointThreshold / this._camera.pixelsPerUnit(distance, this._viewHeight);
    }
    /**
     * Calculating intersection for given object, return this object if the ray intersect with it.
     * @param recursive put children of given object into calculation together.
     * @param intersects if given, the result will be store here.
     */
    intersectObject(object: Object3D, recursive: boolean, intersects: Intersection[] = []) {
        intersectObject(object, this, intersects, recursive);
        return intersects.sort(ascSort);
    }

    /**
     * Calculating intersection for array of objects, return the objects which the ray intersect with.
     * @param recursive put children of objects into calculation together.
     * @param intersects if given, the result will be store here.
     */
    intersectObjects(objects: Object3D[], recursive: boolean, intersects: Intersection[] = []) {
        if (hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
            ManagedContentBridge.raycastList(objects, recursive, intersects, this);
        } else {
            for (let i = 0, l = objects.length; i < l; i++) {
                intersectObject(objects[i], this, intersects, recursive);
            }
        }
        return intersects.sort(ascSort);
    }

    raycastScene(scene: Scene3D, intersects: Intersection[]) {
        if (hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
            ManagedContentBridge.raycastScene(scene, intersects, this);
        } else {
            this.intersectObjects([scene], true, intersects);
        }
        return intersects.sort(ascSort);
    }
}
