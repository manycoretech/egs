import { logger } from '../../utils/Logger.js';
import {
    type BufferGeometryBase,
    type BufferRange,
    BufferGeometry,
} from '../../elements/geometries/containers/BufferGeometry.js';
import type { GeometryBase } from '../../elements/geometries/containers/GeometryBase.js';
import type { Material } from '../../elements/materials/Material.js';
import { MeshBasicMaterial } from '../../elements/materials/mesh/MeshBasicMaterial.js';
import { Box3 } from '../../math/Box3.js';
import { Matrix3 } from '../../math/Matrix3.js';
import { Matrix4 } from '../../math/Matrix4.js';
import { Sphere } from '../../math/Sphere.js';
import { Vector3 } from '../../math/Vector3.js';
import type { Renderer } from '../../renderer/Renderer.js';
import type { Deserializer, Serializer } from '../../utils/Serialization.js';
import type { Nullable } from '../../utils/Utils.js';
import type { Camera3D } from '../cameras/Camera3D.js';
import { Object3D } from '../Object3D.js';
import type { Scene3D } from '../Scene3D.js';
import type { Drawcall } from '../tools/DrawcallList.js';
import type { Intersection, Raycaster } from '../tools/Raycaster.js';
import { ContentBridge, drawableState, hasManagedContentAPI, ManagedContentBridge } from '../../ContentAPI.js';
import { DrawMode } from '../../utils/Constants.js';

/**
 * Render placement mode used by drawable scene objects.
 */
export enum DrawableRenderMode {
    Default,
    Overlay,
}

/**
 * Controls whether a drawable participates in outline rendering.
 */
export enum OutlineRenderMode {
    Default, // in outline render, and create outline
    DisableOutline, // in outline render, and not create outline
    Overlay, // out of outline render
}

/**
 * Controls how a drawable is shaded during outline rendering.
 */
export enum OutlineShadingMode {
    Default, // shading in pipeline type
    Normal, // material shading
}

/**
 * Visual outline mode applied to a drawable.
 * @deprecated use `OutlineRenderMode` and `OutlineRenderMode` pair instead
 */
export enum OutlineMode {
    Disabled, // render origin style in outline
    Outlined, // render outline style in outline
    Solid, // render in solid background color in outline with solid background mode
    Exclude, // render origin style, top level and overflow outline
}

// minimum value of z. used to keep 0 < screenSpaceEstimate < infinity.
const MIN_DRAWABLE_Z = 1e-6;

const temp = new Vector3();
const temp2 = new Vector3();

export type RenderHook = (
    renderer: Renderer,
    geometry: GeometryBase,
    material: Material,
    object: Drawable,
    group: Nullable<BufferRange>,
) => void;

/**
 * This is a base class of Mesh, Line, Point and Sprite.
 * This class has attributes which make the engine know the changed data and apply optimization.
 * Only drawable node of scene can be seen on screen.
 */
export class Drawable<
    M extends Material = Material,
    G extends BufferGeometryBase = BufferGeometryBase,
> extends Object3D {
    /**
     * This value allows the default rendering order of scene graph objects to be overridden although opaque and transparent objects remain sorted independently.
     * When this property is set for an instance of {@link Group| Group }, all descendants objects will be sorted and rendered together.
     * Sorting is from lowest to highest renderOrder.
     * @defaultValue `0`
     */

    @drawableState()
    renderOrder = 0;
    /**
     * This is a decisive attribute for drawing method.
     * @defaultValue Mesh.
     */
    drawMode = DrawMode.Triangles;

    private _outlineMode = OutlineMode.Disabled;
    /**
     * Mark this drawable should be rendered in outline style
     * if you set outlinePipelineMode & outlineShadingMode, get this value maybe not as expected.
     * @deprecated use `outlineShadingMode` and `outlineRenderMode` instead
     */
    get outlineMode(): OutlineMode {
        return this._outlineMode;
    }

    set outlineMode(v: OutlineMode) {
        this._outlineMode = v;
        switch (v) {
            case OutlineMode.Disabled:
                this.outlineRenderMode = OutlineRenderMode.DisableOutline;
                this.outlineShadingMode = OutlineShadingMode.Normal;
                break;
            case OutlineMode.Outlined:
                this.outlineRenderMode = OutlineRenderMode.Default;
                this.outlineShadingMode = OutlineShadingMode.Default;
                break;
            case OutlineMode.Solid:
                this.outlineRenderMode = OutlineRenderMode.DisableOutline;
                this.outlineShadingMode = OutlineShadingMode.Default;
                break;
            case OutlineMode.Exclude:
                this.outlineRenderMode = OutlineRenderMode.Overlay;
                this.outlineShadingMode = OutlineShadingMode.Normal;
                break;
        }
    }

    private _outlineShadingMode: OutlineShadingMode = OutlineShadingMode.Normal;
    get outlineShadingMode() {
        return this._outlineShadingMode;
    }

    set outlineShadingMode(value: OutlineShadingMode) {
        if (this._outlineShadingMode !== value) {
            this._outlineShadingMode = value;
            this.notifySceneChange();
            ContentBridge.drawableSyncData(this, 'outlineShadingMode', value);
        }
    }

    private _outlineRenderMode: OutlineRenderMode = OutlineRenderMode.DisableOutline;
    get outlineRenderMode() {
        return this._outlineRenderMode;
    }
    /**
     * OutlineRenderMode.Overlay is deprecated. use renderMode replaced
     */
    set outlineRenderMode(value: OutlineRenderMode) {
        if (this._outlineRenderMode !== value) {
            this._outlineRenderMode = value;
            this.notifySceneChange();
            if (value === OutlineRenderMode.Overlay) {
                this.renderMode = DrawableRenderMode.Overlay;
            } else {
                ContentBridge.drawableSyncData(this, 'outlineRenderMode', value);
            }
        }
    }

    private _renderMode: DrawableRenderMode = DrawableRenderMode.Default;
    get renderMode() {
        return this._renderMode;
    }
    set renderMode(value: DrawableRenderMode) {
        if (this._renderMode !== value) {
            this._renderMode = value;
            this.notifySceneChange();
            ContentBridge.drawableSyncData(this, 'renderMode', value);
        }
    }
    @drawableState()
    overlayLayers: number = 0;

    /**
     * Mark this drawable can cast shadow
     */
    @drawableState()
    castShadow = false;
    /**
     * Mark this drawable can cast shadow
     */
    @drawableState()
    castPlanarShadow = false;
    /**
     * Used to check type of this or extended instance.
     * This value should not be changed by user.
     */
    isDrawable = true;
    /**
     * Mark the material reference changed.
     * @defaultValue `true`
     */
    materialChanged = true;
    /**
     * Mark the geometry reference changed.
     * @defaultValue `true`
     */
    geometryChanged = true;
    /**
     * Specify the winding orientation of mesh as counter-clock-wise, only meaningful on mesh.
     * @defaultValue `false`.
     */
    frontFaceCW = false;
    /**
     * Store the Model-View matrix for this object.
     * It is not suggested to change the matrix because it will be update automatically when camera move.
     */
    modelViewMatrix = new Matrix4();
    /**
     * This matrix is used to calculate the normal in eye-space.
     */
    normalMatrix = new Matrix3();
    /**
     * Mark bounding need to be recalculated.
     * @defaultValue `true`
     */
    worldBoundingDirty = true;
    /**
     * Calculate the bounding as box.
     */
    worldBoundingBox = new Box3();
    /**
     * Calculate the bounding as sphere.
     */
    worldBoundingSphere = new Sphere();
    /**
     * The distance from object to camera in the direction of camera. Use this value to simply estimate the depth in 3D scene.
     */
    z = 0;
    /**
     * This method allow user manually process data before the engine drawing object.
     * @remarks See {@link RenderHook| RenderHook} for more details.
     */
    onBeforeRender: Nullable<RenderHook> = null;
    /**
     * @internal
     * @deprecated
     */
    hasDynamicShapeMaterial = false;

    private _isAlwaysDynamic = false;
    get isAlwaysDynamic() {
        return this._isAlwaysDynamic;
    }
    set isAlwaysDynamic(v) {
        this._isAlwaysDynamic = v;
        this.notifySceneChange();
    }
    /**
     * This is used to scale a drawable object by specified number when {@link enableViewIndependentScale| enableViewIndependentScale } is true.
     */
    @drawableState()
    viewIndependentScale = 1;
    @drawableState()
    private _enableViewIndependentScale = false;
    /**
     * Let this object can be scale independently.
     */
    get enableViewIndependentScale() {
        return this._enableViewIndependentScale;
    }
    set enableViewIndependentScale(v) {
        this._enableViewIndependentScale = v;
        this.notifySceneChange();
    }

    @drawableState()
    categoryId = 'unmarked';
    @drawableState()
    sourceType = 'common';

    // geometry and material is the class which been set when created.
    // renderGeometry and renderMaterial is the class which goes for real gpu render.
    protected _geometry: G;
    protected _material: M[];
    protected _renderGeometry: Nullable<BufferGeometryBase> = null;
    protected _renderMaterial: Nullable<Material[]> = null;

    /**
     * @internal
     */
    overrideGroups?: BufferRange[];

    constructor(
        geometry: G = new BufferGeometry() as any as G,
        material: M | M[] = new MeshBasicMaterial() as any as M,
    ) {
        super();
        this._geometry = geometry;
        ContentBridge.drawableInit(this);
        this.geometry = geometry;
        this.setMaterials(material);
    }

    /**
     * This attribute stores {@link Geometry| Geometry } or {@link BufferGeometry| BufferGeometry } (or derived classes),
     * defining the object's shape.
     * @defaultValue {@link BoxBufferGeometry| BoxBufferGeometry }
     */
    get geometry() {
        return this._geometry;
    }
    set geometry(newGeo) {
        ContentBridge.drawableSetGeometry(this, newGeo);
        this._geometry = newGeo;
        this.worldBoundingDirty = true;
        this.setGeometryChanged();
    }
    /**
     * Get the geometry which is really rendered by gpu.
     */
    get renderGeometry(): BufferGeometryBase {
        if (this._renderGeometry === null) {
            this.updateRenderEntity();
        }
        return this._renderGeometry!;
    }

    getMaterials(): ReadonlyArray<M> {
        return this._material;
    }

    getMaterialCount() {
        return this._material.length;
    }

    /**
     * Add a new material into this object.
     * If use this method, please make sure that the {@link material| material } has set to Array.
     * @param {Material} material a new material which is set.
     * @param {number} index the target position in the Array.
     */
    setMaterial(material: M, index: number) {
        ContentBridge.drawableSetMaterial(this, material, index);
        this._material[index] = material;
        this.setMaterialChanged();
        return this;
    }

    setMaterials(materials: M[] | M) {
        if (this._material && this._material.length) {
            ContentBridge.drawableClearMaterial(this);
        }
        if (Array.isArray(materials)) {
            this._material = [];
            materials.forEach((material, index) => ContentBridge.drawableSetMaterial(this, material, index));
            this._material.push(...materials);
        } else {
            this._material = [];
            ContentBridge.drawableSetMaterial(this, materials, 0);
            this._material.push(materials);
        }
        this.setMaterialChanged();
        return this;
    }
    setOnlyMaterial(material: M) {
        if (this._material && this._material.length) {
            ContentBridge.drawableClearMaterial(this);
        }
        this._material = [];
        ContentBridge.drawableSetMaterial(this, material, 0);
        this._material.push(material);
        this.setMaterialChanged();
        return this;
    }

    /**
     * Expect this drawable only has one material, and return it.
     */
    expectOnlyMaterial() {
        if (this._material.length > 1) {
            logger.warn('expectOneMaterial failed');
        }
        return this._material[0];
    }

    checkIfOnlyMaterial(innerChecker?: (m: Material) => boolean): boolean {
        if (this._material.length !== 1) {
            return false;
        }
        if (innerChecker) {
            return innerChecker(this._material[0]);
        } else {
            return true;
        }
    }

    /**
     * Do something for every {@link material| material } whatever it is an instance or array.
     * @param {function} f a function to operate the material instance.
     */
    forEachMaterial(v: (m: M) => any) {
        this._material.forEach(v);
    }

    /**
     * Get the material which is really rendered by gpu.
     */
    get renderMaterial(): Material[] {
        if (this._renderMaterial === null) {
            this.updateRenderEntity();
        }
        return this._renderMaterial!;
    }
    /**
     * update the data of bounding box and bounding sphere, set dirty mark to false.
     */
    updateBoundings() {
        if (hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
            this.updateWorldMatrix(true, false);
        }
        this.worldBoundingBox.copy(this.geometry.getBoundingBox()).applyMatrix4(this.matrixWorld);
        this.worldBoundingSphere.copy(this.geometry.getBoundingSphere()).applyMatrix4(this.matrixWorld);
        this.worldBoundingDirty = false;
    }

    _updateMatrixByViewIndependentScale(camera: Camera3D, viewHeight: number) {
        if (this._enableViewIndependentScale) {
            // yes we use matrix position not world aabb center
            const distance = this.matrixWorld.getPosition(temp).distanceTo(camera.position);
            const scale = camera.getViewIndependentScaleRatio(distance, viewHeight) * this.viewIndependentScale;
            // this will not trigger scene change, but ok because camera changed.
            if (scale !== this.viewIndependentOverrideScale.x) {
                this.viewIndependentOverrideScale.set(scale, scale, scale);
                this.localMatrixNeedUpdate = true;
                this.updateMatrix();
                this.updateMatrixWorld(false);
            }
        }
    }

    /**
     * This method is used to update {@link modelViewMatrix| model-view matrix } and {@link normalMatrix| normal matrix } before drawing this object.
     * In addition, the estimated {@link z| depth } information will be update here.
     */
    updateRenderInfo(camera: Camera3D, viewHeight: number) {
        this.worldBoundingBox.getCenterUnsafe(temp);

        // use "(temp - camera.position) · camera.forward" for better z estimation
        // use min z to keep screenSpaceEstimate and LOD level valid.
        temp2.subVectors(temp, camera.position);
        const e = camera.matrixWorld._elements; // camera forward: {x:-e[8], y:-e[9], z:-e[10]}
        this.z = Math.max(MIN_DRAWABLE_Z, -(temp2.x * e[8] + temp2.y * e[9] + temp2.z * e[10]));

        this._updateMatrixByViewIndependentScale(camera, viewHeight);

        this.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse, this.matrixWorld);
        this.normalMatrix.getNormalMatrix(this.modelViewMatrix);
    }

    /**
     * Update the matrix local transform. Override
     */
    updateMatrix() {
        if (this.localMatrixNeedUpdate) {
            if (this._enableViewIndependentScale) {
                this._matrix.compose(this.position, this.quaternion, this.viewIndependentOverrideScale);
            } else {
                this._matrix.compose(this.position, this.quaternion, this.scale);
            }
            this.matrixWorldNeedsUpdate = true;
            this.localMatrixNeedUpdate = false;
        }
    }
    private viewIndependentOverrideScale = new Vector3(1, 1, 1);

    _clearViewIndependentOverrideScale() {
        if (this._enableViewIndependentScale && this.viewIndependentOverrideScale.x !== 1) {
            this.localMatrixNeedUpdate = true;
        }
        this.viewIndependentOverrideScale.set(1, 1, 1);
    }

    /**
     * Set all changing mark, such as {@link geometryChanged| geometryChanged }, {@link materialChanged| materialChanged }
     * and {@link Object3D.clearChangeMark| extended mark }.
     */
    clearChangeMark() {
        super.clearChangeMark();
        this.materialChanged = false;
        this.geometryChanged = false;
    }
    /**
     * This method need override in derived classes to give a special calculation for picking feature.
     * @remarks See {@link Raycaster| Raycaster } for more detail.
     */
    raycast(raycaster: Raycaster, intersects: Intersection[]) {
        if (hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
            ManagedContentBridge.raycast(this, intersects, raycaster);
        } else {
            this.raycastJsImpl(raycaster, intersects);
        }
    }

    protected raycastJsImpl(_raycaster: Raycaster, _intersects: Intersection[]) {}

    /**
     * Clean render data for optimization.
     */
    // refresh self draw proxy
    resetRenderEntity() {
        this._renderMaterial = null;
        this._renderGeometry = null;
        this.notifySceneChange();
    }
    /**
     * Update render data for optimization.
     * This method is used to assign data from {@link geometry| geometry } and {@link material| material } to
     * {@link renderGeometry| renderGeometry } and {@link renderMaterial| renderMaterial }.
     */
    updateRenderEntity() {
        this._renderGeometry = this._geometry;
        this._renderMaterial = this._material;
    }

    private _removeSceneReference() {
        if (this.scene) {
            this.scene._refManager.removeDrawableGeometryRef(this);
            this.scene._refManager.removeDrawableMaterialRef(this);
        }
    }
    private createSceneReference() {
        if (this.scene) {
            this.scene._refManager.createDrawableGeometryRef(this);
            this.scene._refManager.createDrawableMaterialRef(this);
        }
    }
    private addDrawcall(material: Material, range: Nullable<BufferRange>, transparent: Drawcall[], opaque: Drawcall[]) {
        if (!material) {
            logger.warn('can not find material when build drawcall list');
            return;
        }
        if (!material.visible) {
            return;
        }

        const array = material.transparent ? transparent : opaque;
        array.push({
            object: this,
            material,
            geometry: this.renderGeometry,
            range,
        });
    }
    /**
     * Reset entity reference.
     * @remarks See {@link Scene3D._refManager| refManager} for more details.
     */
    refreshSceneReference() {
        this._removeSceneReference();
        this.createSceneReference();
    }
    /**
     * If user changes geometry for drawable, use this method to refresh corresponding states.
     */
    setGeometryChanged() {
        if (hasManagedContentAPI()) {
            return;
        }
        this.geometryChanged = true;
        this.resetRenderEntity();
        this.refreshSceneReference();
    }
    /**
     * Manually {@link Object3D.notifySceneChange| refresh} and {@link resetRenderEntity| reset} data of this drawable.
     * @tips This method can be replaced by {@link resetRenderEntity| resetRenderEntity()}.
     */
    // what should i do, when refed geometry content changed.
    onReferencedGeometryContentChange() {
        this.notifySceneChange();
        this.resetRenderEntity();
    }
    /**
     * If user changes {@link material| material } for drawable, use this method to refresh corresponding states.
     */
    // mark the material reference changed
    setMaterialChanged() {
        if (hasManagedContentAPI()) {
            return;
        }
        this.materialChanged = true;
        this.resetRenderEntity();
        this.refreshSceneReference();
    }

    protected onSelfAttachingScene(scene: Scene3D) {
        super.onSelfAttachingScene(scene);
        this.setGeometryChanged(); // update ref info in scene when attaching
        this.setMaterialChanged();
    }

    protected onSelfDetachingScene(scene: Scene3D) {
        this._removeSceneReference(); // remove ref info when detaching scene
        super.onSelfDetachingScene(scene);
    }

    @drawableState()
    shouldUseGeometryGroupsWhenOnlyHasOneMaterial = false;
    useGeometryGroupsWhenOnlyHasOneMaterial() {
        this.shouldUseGeometryGroupsWhenOnlyHasOneMaterial = true;
        return this;
    }

    /**
     * @internal
     */
    appendDrawcall(transparent: Drawcall[], opaque: Drawcall[]) {
        const renderMaterial = this.renderMaterial;
        const renderGeometry = this.renderGeometry;
        const groups = renderGeometry.getGroups();

        if (
            (!this.shouldUseGeometryGroupsWhenOnlyHasOneMaterial && this._material.length === 1) ||
            (groups.length === 0 && this._material.length >= 1)
        ) {
            this.addDrawcall(this._material[0], null, transparent, opaque);
            return;
        }

        for (let i = 0, l = groups.length; i < l; i++) {
            const group = groups[i];
            const overrideGroup = this.overrideGroups?.[i];
            const groupMaterial = renderMaterial[group.materialIndex];
            this.addDrawcall(groupMaterial, overrideGroup ?? group, transparent, opaque);
        }
    }

    /**
     * Copy the data to this object from source.
     * This method need override in derived classes to copy extended data.
     * @param {Drawable} source the data source.
     * @param {boolean} recursive if true, descendants of the object are also cloned. Default is true.
     */
    copy(source: Drawable<M, G>, recursive?: boolean) {
        super.copy(source, recursive);
        this.drawMode = source.drawMode;
        this.geometry = source.geometry;
        this.renderOrder = source.renderOrder;
        this.shouldUseGeometryGroupsWhenOnlyHasOneMaterial = source.shouldUseGeometryGroupsWhenOnlyHasOneMaterial;
        this.castPlanarShadow = source.castPlanarShadow;
        this.castShadow = source.castShadow;
        this.setMaterials(source._material);
        return this;
    }

    /**
     * Store the attributes of this class into string as serializing format.
     * @param {Serializer} ctx this parameter has not supported external Serializer yet.
     * It may cause that this method can not be used directly.
     * @internal
     */
    serialize(ctx: Serializer) {
        super.serialize(ctx);
        ctx.put('material', '_material');
        ctx.puts<Drawable>([
            'geometry',
            'drawMode',
            'renderOrder',
            'shouldUseGeometryGroupsWhenOnlyHasOneMaterial',
            'castPlanarShadow',
            'castShadow',
        ]);
    }

    set __material(v: M[]) {
        this.setMaterials(v);
    }
    /**
     * Parse the data for this class from string according to serializing format.
     * @param {Deserializer} ctx this parameter has not supported external Deserializer yet.
     * It may cause that this method can not be used directly.
     * @internal
     */
    deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        ctx.read('material', '__material');
        ctx.reads<Drawable>([
            'geometry',
            'drawMode',
            'renderOrder',
            'shouldUseGeometryGroupsWhenOnlyHasOneMaterial',
            'castPlanarShadow',
            'castShadow',
        ]);
        this.updateBoundings();
    }

    destroyAllResourcesOwned() {
        this.getMaterials().forEach(m => m.destroyAllResourcesOwned());
        this.geometry.destroyAllResourcesOwned();
        super.destroyAllResourcesOwned();
    }

    freeAllGpuResourceOwned() {
        this.getMaterials().forEach(m => m.freeAllGpuResourceOwned());
        this.geometry.freeAllGpuResourceOwned();
        this.freeGPU();
    }
}
