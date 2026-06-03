import { Camera3D, type CameraView } from './Camera3D';
import { _Math } from '../../math/Math';
import type { Nullable } from '../../utils/Utils';
import type { Serializer, Deserializer } from '../../utils/Serialization';
import type { Vector2 } from '../../math/Vector2';
import type { Ray } from '../../math/Ray';
import { ContentBridge, cameraState } from '../../ContentAPI';

const TO_RADIANS = Math.PI / 180;
/**
 * Camera that uses perspective projection.
 * This projection mode is designed to mimic the way the human eye sees.
 * It is the most common projection mode used for rendering a 3D scene.
 */
export class PerspectiveCamera extends Camera3D {
    /**
     * Check the type whether it belongs to PerspectiveCamera.
     * This value should not be changed by user.
     */
    readonly isPerspectiveCamera = true;
    @cameraState()
    private _isTwoPointPerspectiveViewEnabled = false;
    /**
     * This effect can elongate models when camera looks up or down.
     */
    get isTwoPointPerspectiveViewEnabled() { return this._isTwoPointPerspectiveViewEnabled; }
    set isTwoPointPerspectiveViewEnabled(v) {
        this._isTwoPointPerspectiveViewEnabled = v;
        this.setMatrixDirty();
        this.notifyCameraChanged();
    }
    /**
     * Update the camera's {@link Object3D.matrixWorld| matrixWorld } and {@link matrixWorldInverse| matrixWorldInverse }.
     * @param {boolean} force Whether or not force to updates the matrix.
     */
    updateMatrixWorld(force?: boolean) {
        super.updateMatrixWorld(force);
        if (this._isTwoPointPerspectiveViewEnabled) {
            this.matrixWorld._elements[4] = 0;
            this.matrixWorld._elements[5] = 0;
            this.matrixWorld._elements[6] = 1;
            this.matrixWorld._elements[7] = 0;
        }
        this.matrixWorldInverse.getInverse(this.matrixWorld);
    }

    @cameraState()
    private _fov: number;
    /**
     * Camera frustum vertical field of view, from bottom to top of view, in degrees.
     */
    get fov() { return this._fov; }
    set fov(v) { this._fov = v; this.notifyCameraChanged(); }

    @cameraState()
    private _zoom: number;
    /**
     * Scale width and height of view frustum.
     */
    get zoom() { return this._zoom; }
    set zoom(v) { this._zoom = v; this.notifyCameraChanged(); }

    @cameraState()
    private _near: number;
    /**
     * Distance from camera position to small plane of view frustum.
     */
    get near() { return this._near; }
    set near(v) { this._near = v; this.notifyCameraChanged(); }

    @cameraState()
    private _far: number;
    /**
     * Distance from camera position to big plane of view frustum.
     */
    get far() { return this._far; }
    set far(v) { this._far = v; this.notifyCameraChanged(); }

    @cameraState()
    private _focus: number;
    /**
     * Object distance used for stereoscopy and depth-of-field effects.
     * @defaultValue `10`.
     */
    get focus() { return this._focus; }
    set focus(v) { this._focus = v; this.notifyCameraChanged(); }

    @cameraState()
    private _aspect: number;
    /**
     * Full screen width divided by its height in case of more view, this value equals to fov when there was only one viewer.
     */
    get aspect() { return this._aspect; }
    set aspect(v) { this._aspect = v; this.notifyCameraChanged(); }
    /**
     * Frustum window specification or null.
     * This is set using the {@link setViewOffset| setViewOffset } method and cleared using {@link clearViewOffset| clearViewOffset }.
     */
    @cameraState()
    view: Nullable<CameraView> = null;
    /**
     * Film size used for the larger axis. Default is 35 (millimeters).
     * This parameter does not influence the projection matrix unless {@link filmOffset| filmOffset } is set to a nonzero value.
     */
    @cameraState()
    filmGauge: number;
    /**
     * Horizontal off-center offset in the same unit as {@link filmGauge| filmGauge }.
     * @defaultValue `0`.
     */
    @cameraState()
    filmOffset: number;
    /**
     * The name of instance's class.
     */
    className() {
        return 'PerspectiveCamera';
    }

    constructor(fov?: number, aspect?: number, near?: number, far?: number) {
        super();
        ContentBridge.cameraInit(this);
        this.fov = fov !== undefined ? fov : 50;
        this.zoom = 1;

        this.near = near !== undefined ? near : 0.1;
        this.far = far !== undefined ? far : 2000;
        this.focus = 10;

        this.aspect = aspect !== undefined ? aspect : 1;

        this.filmGauge = 35;	// width of the film (default in millimeters)
        this.filmOffset = 0;	// horizontal film offset (same unit as gauge)

        this.updateProjectionMatrix();
    }
    /**
     * Copy the data to this camera instance from source.
     * This method need override in derived classes to copy extended data.
     * @param {PerspectiveCamera} source the data source.
     * @param {boolean} recursive if true, descendants of the object are also cloned. Default is true.
     */
    copy(source: PerspectiveCamera, recursive?: boolean) {
        super.copy(source, recursive);

        this.fov = source.fov;
        this.zoom = source.zoom;

        this.near = source.near;
        this.far = source.far;
        this.focus = source.focus;

        this.aspect = source.aspect;
        this.view = source.view === null ? null : Object.assign({}, source.view);

        this.filmGauge = source.filmGauge;
        this.filmOffset = source.filmOffset;

        return this;
    }
    /**
     * The tangent value of camera frustum's vertical angle.
     */
    getPixelsOfDistOne() {
        return 2 * Math.tan(this.fov * TO_RADIANS / 2) / this.zoom;
    }

    /**
     * As name says
     */
    getDistanceWhenEachWorldUnitMatchScreenUnit(viewHeight: number) {
        return (viewHeight) / this.getPixelsOfDistOne();
    }

    /**
     * Calculate how many screen pixel match one world unit at given distance.
     * @param {number} distance the distance from camera to object.
     * @param {number} viewHeight the hight of view window.
     */
    pixelsPerUnit(distance: number, viewHeight: number) {
        return this.getDistanceWhenEachWorldUnitMatchScreenUnit(viewHeight) / distance;
    }

    /**
     * Set the origin and direction for ray.
     * @param {Ray} ray the calculate result will be set to this.
     * @param {Vector2} coords the position of window where the ray through out.
     */
    castRay(ray: Ray, coords: Vector2) {
        ray.origin.setFromMatrixPosition(this.matrixWorld);
        ray.direction.set(coords.x, coords.y, 0.5).unproject(this).sub(ray.origin).normalize();
    }
    /**
     * Sets the FOV by focal length in respect to the current {@link filmGauge | filmGauge }.
     * Values for focal length and film gauge must have the same unit.
     * @defaultValue The default film gauge is 35, so that the focal length can be specified for a 35mm (full frame) camera.
     */
    setFocalLength(focalLength: number): void {
        // see http://www.bobatkins.com/photography/technical/field_of_view.html
        const vExtentSlope = 0.5 * this.getFilmHeight() / focalLength;
        this.fov = _Math.RAD2DEG * 2 * Math.atan(vExtentSlope);
        this.updateProjectionMatrix();
    }
    /**
     * Calculates the focal length from the current {@link fov | fov } and {@link filmGauge | filmGauge }.
     */
    getFocalLength() {
        const vExtentSlope = Math.tan(_Math.DEG2RAD * 0.5 * this.fov);
        return 0.5 * this.getFilmHeight() / vExtentSlope;
    }
    /**
     * Returns the current vertical field of view angle in degrees considering {@link zoom | zoom }.
     */
    getEffectiveFOV() {
        return _Math.RAD2DEG * 2 * Math.atan(Math.tan(_Math.DEG2RAD * 0.5 * this.fov) / this.zoom);
    }
    /**
     * Returns the width of the image on the film. If .aspect is greater than or equal to one (landscape format), the result equals {@link filmGauge | filmGauge }.
     */
    getFilmWidth() {
        // film not completely covered in portrait format (aspect < 1)
        return this.filmGauge * Math.min(this.aspect, 1);
    }
    /**
     * Returns the height of the image on the film. If .aspect is less than or equal to one (portrait format), the result equals {@link filmGauge | filmGauge }.
     */
    getFilmHeight() {
        // film not completely covered in landscape format (aspect > 1)
        return this.filmGauge / Math.max(this.aspect, 1);
    }
    /**
     * Sets an offset in a larger frustum. This is useful for multi-window or multi-monitor/multi-machine setups.
     * For example, if you have 3x2 monitors and each monitor is 1920x1080 and the monitors are in grid like this: <br />
     * +---+---+---+ <br />
     * | A | B | C | <br />
     * +---+---+---+ <br />
     * | D | E | F | <br />
     * +---+---+---+ <br />
     * then for each monitor you would call it like this:
     * `
     * let w = 1920;
     * let h = 1080;
     * let fullWidth = w * 3;
     * let fullHeight = h * 2;
     *  // A
     * camera.setOffset( fullWidth, fullHeight, w * 0, h * 0, w, h );
     *  // B
     * camera.setOffset( fullWidth, fullHeight, w * 1, h * 0, w, h );
     *  // C
     * camera.setOffset( fullWidth, fullHeight, w * 2, h * 0, w, h );
     *  // D
     * camera.setOffset( fullWidth, fullHeight, w * 0, h * 1, w, h );
     *  // E
     * camera.setOffset( fullWidth, fullHeight, w * 1, h * 1, w, h );
     *  // F
     * camera.setOffset( fullWidth, fullHeight, w * 2, h * 1, w, h );
     * `
     * @tips there is no reason monitors have to be the same size or in a grid.
     * @param {number} fullWidth full width of multi-view setup.
     * @param {number} fullHeight full height of multi-view setup.
     * @param {number} x horizontal offset of sub-camera.
     * @param {number} y vertical offset of sub-camera.
     * @param {number} width width of sub-camera.
     * @param {number} height height of sub-camera.
     */
    setViewOffset(fullWidth: number, fullHeight: number, x: number, y: number, width: number, height: number) {
        this.aspect = fullWidth / fullHeight;
        if (this.view === null) {
            this.view = {
                enabled: true,
                fullWidth: 1,
                fullHeight: 1,
                offsetX: 0,
                offsetY: 0,
                width: 1,
                height: 1
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
    updateProjectionMatrix(jitter?: { offset: Vector2, canvas_size: Vector2 }) {
        const near = this.near;
        let top = near * Math.tan(_Math.DEG2RAD * 0.5 * this.fov) / this.zoom;
        let height = 2 * top;
        let width = this.aspect * height;
        let left = - 0.5 * width;

        if (this.view !== null && this.view.enabled) {
            const view = this.view;
            const fullWidth = view.fullWidth;
            const fullHeight = view.fullHeight;

            left += view.offsetX * width / fullWidth;
            top -= view.offsetY * height / fullHeight;
            width *= view.width / fullWidth;
            height *= view.height / fullHeight;
        }

        const skew = this.filmOffset;
        if (skew !== 0) {
            left += near * skew / this.getFilmWidth();
        }
        this.projectionMatrix.makePerspective(left, left + width, top, top - height, near, this.far);

        if (jitter) {
            this.projectionMatrix._elements[8] += ((2 * jitter.offset.x - 1) / jitter.canvas_size.x);
            this.projectionMatrix._elements[9] += ((2 * jitter.offset.y - 1) / jitter.canvas_size.y);
        }

        this.projectionMatrixInverse.getInverse(this.projectionMatrix);

    }
    /**
     * Store the attributes of this class into string as serializing format.
     * @param {Serializer} ctx an instance used to store the data of scene objects.
     */
    serialize(ctx: Serializer) {
        super.serialize(ctx);
        ctx.puts<PerspectiveCamera>([
            'fov', 'zoom', 'near', 'far', 'focus', 'aspect', 'filmGauge', 'filmOffset', 'isTwoPointPerspectiveViewEnabled'
        ]);
        ctx.putRaw('view', ctx.deepClone(this.view));
    }
    /**
     * Parse the data for this class from string according to serializing format.
     * @param {Deserializer} ctx an instance give the method to take the data for attribute.
     */
    deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        ctx.reads<PerspectiveCamera>([
            'fov', 'zoom', 'near', 'far', 'focus', 'aspect', 'filmGauge', 'filmOffset', 'isTwoPointPerspectiveViewEnabled'
        ]);
        this.view = ctx.readRaw('view');
    }
    /**
     * Return a cloned instance of this instance.
     */
    clone(recursive?: boolean) {
        return new PerspectiveCamera().copy(this, recursive);
    }
}
