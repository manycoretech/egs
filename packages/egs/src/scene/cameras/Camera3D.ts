import { Matrix4 } from '../../math/Matrix4';
import { Object3D, Object3DChangeEvent } from '../Object3D';
import { Vector3 } from '../../math/Vector3';
import type { Serializer, Deserializer } from '../../utils/Serialization';
import type { ReadonlyVector2, Vector2 } from '../../math/Vector2';
import type { Ray } from '../../math/Ray';
import { Culler } from '../tools/Culler';
import type { Drawable } from '../drawables/Drawable';
import { Vector4 } from '../../math/Vector4';
import { ContentBridge, cameraState } from '../../ContentAPI';
import { readonlyMath } from '../../math/Readonly';

// Its instance will be useful when there were more than one camera.
export interface CameraView {
    fullWidth: number;
    fullHeight: number;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
    enabled: boolean;
}

/**
 * Abstract base class for cameras. This class should always be inherited when you build a new camera,
 * such as perspective and orthographic camera.
 * The abstracted function need to respectively implement for different types of cameras.
 */
export abstract class Camera3D extends Object3D {
    @cameraState()
    enableFrustumCulling = true;
    @cameraState()
    enableDetailCulling = false;

    /**
     * @internal
     */
    culler = new Culler();

    /**
     * @internal
     */
    queryCulling = (object: Drawable) => {
        if (!this.layers.test(object.netLayer)) {
            return false;
        }
        return this.culler.queryCulling(object);
    };
    /**
     * @internal
     */
    filterLayers = (object: Drawable) => {
        return this.layers.test(object.netLayer);
    };

    /**
     * Check the type whether it belongs to Camera3D.
     * This value should not be changed by user.
     */
    isCamera3D = true;
    /**
     * The type of this Object3D.
     */
    type = 'Camera';
    /**
     * This is the inverse of matrixWorld. MatrixWorld contains the Matrix which has the world transform of the Camera3D.
     */
    matrixWorldInverse = new Matrix4();
    // this used in defer world reconstruct
    worldRotation = new Matrix4();
    /**
     * @internal
     */
    viewRotation = new Matrix4();
    worldPosition = new Vector3();
    /**
     * This matrix decides the method of projection such as perspective and orthographic.
     */
    projectionMatrix = new Matrix4();
    /**
     * The inverse matrix of {@link projectionMatrix| projectionMatrix }.
     */
    projectionMatrixInverse = new Matrix4();
    /**
     * This is used to adapt the bounds of camera to canvas.
     */
    bounds = new Vector4(0, 0, 1, 1);
    /**
     * The name of instance's class.
     */
    className() {
        return 'Camera';
    }
    /**
     * Make the engine to render the scene again.
     */
    notifyCameraChanged() {
        this.emit(Object3DChangeEvent);
    }
    /**
     * Copy the data to this camera instance from source.
     * This method need override in derived classes to copy extended data.
     * @param {Camera3D} source the data source.
     * @param {boolean} recursive if true, descendants of the object are also cloned. Default is true.
     */
    copy(source: Camera3D, recursive?: boolean) {
        super.copy(source, recursive);
        this.matrixWorldInverse.copy(source.matrixWorldInverse);
        this.projectionMatrix.copy(source.projectionMatrix);
        this.projectionMatrixInverse.copy(source.projectionMatrixInverse);
        return this;
    }
    /**
     * Set the value of camera's faced direction to given vector.
     * @param {Vector3} target this vector representing the world space direction in which the camera is looking.
     */
    getWorldDirection(target: Vector3) {
        this.updateMatrixWorld(true);
        const e = this.matrixWorld._elements;
        return target.set(- e[8], - e[9], - e[10]).normalize();
    }
    /**
     * Update the camera's {@link Object3D.matrixWorld| matrixWorld } and {@link matrixWorldInverse| matrixWorldInverse }.
     * @param {boolean} updateParents if true, it also updates all the parents.
     * @param {boolean} updateChildren if true, it also updates all the children.
     * @param {boolean} force Whether or not force to updates the matrix.
     */
    updateWorldMatrix(updateParents: boolean, updateChildren: boolean, force: boolean = false) {
        super.updateWorldMatrix(updateParents, updateChildren, force);
        this.matrixWorldInverse.getInverse(this.matrixWorld);
        this.matrixWorld.getPosition(this.worldPosition);
        this.worldRotation.extractRotation(this.matrixWorld);
        // rotation is orthogonal matrix, just use transpose instead of inverse
        // faster.
        this.viewRotation.copy(this.worldRotation).transpose();

        ContentBridge.sceneNodeUpdate(this);
    }
    /**
     * Store the attributes of this class into string as serializing format.
     * @param {Serializer} ctx an instance used to store the data of scene objects.
     */
    serialize(ctx: Serializer) {
        super.serialize(ctx);
        ctx.puts<Camera3D>(['projectionMatrix']);
    }
    /**
     * Parse the data for this class from string according to serializing format.
     * @param {Deserializer} ctx an instance give the method to take the data for attribute.
     */
    deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        ctx.reads<Camera3D>(['projectionMatrix']);
    }
    /**
     * Update the projection matrix base on different type of camera. And a modification also can be applied on the projection.
     */
    abstract updateProjectionMatrix(jitter?: { offset: Vector2, canvas_size: Vector2 }): void;

    private _jitter: ReadonlyVector2 = readonlyMath.vec2(0, 0);
    updateJitter(jitter: ReadonlyVector2) {
        this._jitter = jitter;
        ContentBridge.cameraUpdateJitter(this, jitter);
    }
    getJitter() {
        return this._jitter;
    }

    updatePrev() {
        ContentBridge.cameraUpdatePrev(this);
    }

    /**
     * how many screen pixels rendered in 1 distance from camera
     */
    abstract getPixelsOfDistOne(): number;

    /**
     * Calculate how many screen pixel match one world unit at given distance.
     * @param {number} distance the distance from camera to object.
     * @param {number} viewHeight the hight of view window.
     */
    abstract pixelsPerUnit(distance: number, viewHeight: number): number;
    /**
     * return a function that compute pixelsPerUnit
     */
    pixelsPerUnitCreator(viewHeight: number): (distance: number) => number {
        return (distance) => this.pixelsPerUnit(distance, viewHeight);
    }

    /**
     * Calculate a scale value that keep one object's screen unit size match it's world unit size
     * @param {number} distance the distance from camera to object.
     * @param {number} viewHeight the hight of view window.
     */
    getViewIndependentScaleRatio(distance: number, viewHeight: number) {
        return 1 / this.pixelsPerUnit(distance, viewHeight);
    }

    /**
     * Set the origin and direction for ray.
     * @param {Ray} ray the calculate result will be set to this.
     * @param {Vector2} coords the position of window where the ray through out.
     */
    abstract castRay(ray: Ray, coords: Vector2): void;
}
