import { Camera3D, type CameraView } from './Camera3D';
import type { Nullable } from '../../utils/Utils';
import type { Serializer, Deserializer } from '../../utils/Serialization';
import type { Vector2 } from '../../math/Vector2';
import type { Ray } from '../../math/Ray';
import { ContentBridge, cameraState } from '../../ContentAPI';

/**
 * The orthographic camera class, which has no "bigger when it's closer, small when it's far" effect.
 * Size will not be affected by the distance.
 */
export class OrthographicCamera extends Camera3D {
    /**
     * Check the type whether it belongs to OrthographicCamera.
     * This value should not be changed by user.
     */
    isOrthographicCamera = true;
    /**
     * The name of instance's class.
     */
    className() {
        return 'OrthographicCamera';
    }

    @cameraState()
    private _zoom: number;
    /**
     * Scale width and height of view frustum.
     */
    get zoom() {
        return this._zoom;
    }
    set zoom(v) {
        this._zoom = v;
        this.notifyCameraChanged();
    }

    @cameraState()
    protected _left: number;
    /**
     * Distance from projective plane center to left side.
     */
    get left() {
        return this._left;
    }
    set left(v) {
        this._left = v;
        this.notifyCameraChanged();
    }

    @cameraState()
    protected _right: number;
    /**
     * Distance from projective plane center to right side.
     */
    get right() {
        return this._right;
    }
    set right(v) {
        this._right = v;
        this.notifyCameraChanged();
    }
    /**
     * Distance from projective plane center to top side.
     */
    @cameraState()
    protected _top: number;
    get top() {
        return this._top;
    }
    set top(v) {
        this._top = v;
        this.notifyCameraChanged();
    }
    /**
     * Distance from projective plane center to bottom side.
     */
    @cameraState()
    protected _bottom: number;
    get bottom() {
        return this._bottom;
    }
    set bottom(v) {
        this._bottom = v;
        this.notifyCameraChanged();
    }
    /**
     * Distance from camera position to near plane of view frustum.
     */
    @cameraState()
    private _near: number;
    get near() {
        return this._near;
    }
    set near(v) {
        this._near = v;
        this.notifyCameraChanged();
    }
    /**
     * Distance from camera position to far plane of view frustum.
     */
    @cameraState()
    private _far: number;
    get far() {
        return this._far;
    }
    set far(v) {
        this._far = v;
        this.notifyCameraChanged();
    }
    /**
     * Frustum window specification or null.
     * This is set using the {@link setViewOffset| setViewOffset } method and cleared using {@link clearViewOffset| clearViewOffset }.
     */
    @cameraState()
    view: Nullable<CameraView> = null;

    constructor(left?: number, right?: number, top?: number, bottom?: number, near?: number, far?: number) {
        super();
        ContentBridge.cameraInit(this);
        this.zoom = 1;

        this.left = left !== undefined ? left : -1;
        this.right = right !== undefined ? right : 1;
        this.top = top !== undefined ? top : 1;
        this.bottom = bottom !== undefined ? bottom : -1;

        this.near = near !== undefined ? near : 0.1;
        this.far = far !== undefined ? far : 2000;

        this.updateProjectionMatrix();
    }
    /**
     * Copy the data to this camera instance from source.
     * This method need override in derived classes to copy extended data.
     * @param {OrthographicCamera} source the data source.
     * @param {boolean} recursive if true, descendants of the object are also cloned. Default is true.
     */
    copy(source: OrthographicCamera, recursive?: boolean) {
        super.copy(source, recursive);

        this.left = source.left;
        this.right = source.right;
        this.top = source.top;
        this.bottom = source.bottom;
        this.near = source.near;
        this.far = source.far;

        this.zoom = source.zoom;
        this.view = source.view === null ? null : Object.assign({}, source.view);

        return this;
    }
    /**
     * @remarks See {@link PerspectiveCamera.setViewOffset | PerspectiveCamera } for more details.
     */
    setViewOffset(fullWidth: number, fullHeight: number, x: number, y: number, width: number, height: number) {
        if (this.view === null) {
            this.view = {
                enabled: true,
                fullWidth: 1,
                fullHeight: 1,
                offsetX: 0,
                offsetY: 0,
                width: 1,
                height: 1,
            };
        }

        this.view.enabled = true;
        this.view.fullWidth = fullWidth;
        this.view.fullHeight = fullHeight;
        this.view.offsetX = x;
        this.view.offsetY = y;
        this.view.width = width;
        this.view.height = height;

        this.updateProjectionMatrix();
    }
    /**
     * Removes any offset set by the {@link setViewOffset | setViewOffset } method.
     */
    clearViewOffset() {
        if (this.view !== null) {
            this.view.enabled = false;
        }

        this.updateProjectionMatrix();
    }
    /**
     * Updates the camera's {@link projectionMatrix | projectionMatrix } and {@link projectionMatrixInverse | projectionMatrixInverse }.
     * When user change the attribute such as far, top ...,
     * this method will have to be called for the changes to take effect.
     * @param { Object } jitter if jitters need to be applied on this camera, this parameter need to be given.
     */
    updateProjectionMatrix(jitter?: { offset: Vector2; canvas_size: Vector2 }) {
        const dx = (this.right - this.left) / (2 * this.zoom);
        const dy = (this.top - this.bottom) / (2 * this.zoom);
        const cx = (this.right + this.left) / 2;
        const cy = (this.top + this.bottom) / 2;

        let left = cx - dx;
        let right = cx + dx;
        let top = cy + dy;
        let bottom = cy - dy;

        if (this.view !== null && this.view.enabled) {
            const zoomW = this.zoom / (this.view.width / this.view.fullWidth);
            const zoomH = this.zoom / (this.view.height / this.view.fullHeight);
            const scaleW = (this.right - this.left) / this.view.width;
            const scaleH = (this.top - this.bottom) / this.view.height;

            left += scaleW * (this.view.offsetX / zoomW);
            right = left + scaleW * (this.view.width / zoomW);
            top -= scaleH * (this.view.offsetY / zoomH);
            bottom = top - scaleH * (this.view.height / zoomH);
        }

        if (jitter) {
            const offsetX = ((jitter.offset.x - 0.5) * (right - left)) / jitter.canvas_size.x;
            const offsetY = ((jitter.offset.y - 0.5) * (top - bottom)) / jitter.canvas_size.y;
            left += offsetX;
            right += offsetX;
            top += offsetY;
            bottom += offsetY;
        }

        this.projectionMatrix.makeOrthographic(left, right, top, bottom, this.near, this.far);
        this.projectionMatrixInverse.getInverse(this.projectionMatrix);
    }

    /**
     * The tangent value of camera frustum's vertical angle.
     */
    getPixelsOfDistOne() {
        return Math.abs(this.top - this.bottom) / this.zoom;
    }

    /**
     * Calculate how many screen pixel match one world unit at given distance.
     * @param {number} distance the distance from camera to object.
     * @param {number} viewHeight the hight of view window.
     */
    pixelsPerUnit(_: number, viewHeight: number) {
        return viewHeight / this.getPixelsOfDistOne();
    }

    /**
     * Set the origin and direction for ray.
     * @param {Ray} ray the calculate result will be set to this.
     * @param {Vector2} coords the position of window where the ray through out.
     */
    castRay(ray: Ray, coords: Vector2) {
        ray.origin.set(coords.x, coords.y, (this.near + this.far) / (this.near - this.far)).unproject(this); // set origin in plane of camera
        ray.direction.set(0, 0, -1).transformDirection(this.matrixWorld);
    }
    /**
     * Store the attributes of this class into string as serializing format.
     * @param {Serializer} ctx an instance used to store the data of scene objects.
     */
    serialize(ctx: Serializer) {
        super.serialize(ctx);
        ctx.puts<OrthographicCamera>(['zoom', 'left', 'right', 'top', 'bottom', 'near', 'far']);
        ctx.putRaw('view', ctx.deepClone(this.view));
    }
    /**
     * Parse the data for this class from string according to serializing format.
     * @param {Deserializer} ctx an instance give the method to take the data for attribute.
     */
    deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        ctx.reads<OrthographicCamera>(['zoom', 'left', 'right', 'top', 'bottom', 'near', 'far']);
        this.view = ctx.readRaw('view');
    }
    /**
     * Return a cloned instance of this instance.
     */
    clone(recursive?: boolean) {
        return new OrthographicCamera().copy(this, recursive);
    }
}
