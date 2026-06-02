import { Object3D } from './Object3D';
import { Light } from './lights/Light';
import { TypeAssert } from './tools/TypeAssert';
import { Nullable } from '../utils/Utils';
import { Camera3D } from './cameras/Camera3D';
import { RenderProxyManager } from './tools/proxy/RenderProxyManager';
import { EventType } from '../utils/EventDispatcher';
import { SceneElementRefManager } from './tools/ElementRefManger';
import { CoordinateSystemHelper } from './helpers/CoordinateSystemHelper';
import { IRenderer } from '../renderer/IRenderer';
import { DrawableList } from './tools/DrawcallList';
import { ContentBridge, hasManagedContentAPI, ManagedContentBridge } from '../ContentAPI';
import { Plane } from '../math/Plane';
import { SplatManager } from './splat/SplatManager';
import { ShaderComponentRegistry } from './ShaderComponentRegistry';

export const SceneChangeEvent = new EventType();
let globalSceneID = 0;

/**
 * Scene3D is a root node of 3d scene graph, other kinds of 3D object need to be add as children into it.
 * This class provides operating functions to control nodes in scene tree and record which nodes are changed in current frame.
 * The effect and renderable content also can be managed here.
 */
export class Scene3D extends Object3D {
    /**
     * Mark this scene with a unique number.
     */
    readonly sceneId = globalSceneID++;
    readonly scene: Scene3D;
    readonly attachedNodes: Map<number, Object3D> = new Map();
    /**
     * Store all {@link Light| lights } source which need to apply on the models of scene.
     */
    lights: Set<Light> = new Set();
    /**
     * Clipping planes setting for scene. When setting changed, should call notifyClippingChanged to update
     */
    clippingPlanes: Plane[] = [];
    /**
     * If enable the scene level clipping
     */
    enableSceneClipping: boolean = false;
    notifyClippingChanged() {
        this.shaderComponentRegistry.clipping.clippingPlanes = this.enableSceneClipping ? this.clippingPlanes.slice() : [];
        if (hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
            ManagedContentBridge.sceneSyncData(this);
        }
    }
    /**
     * The type of current {@link Object3D| Object3D }.
     * @deprecated
     */
    type = 'Scene';
    /**
     * The {@link CoordinateSystemHelper| coordSysHelper } of this scene, if it needs to be rendered.
     */
    coordSysHelper: Nullable<CoordinateSystemHelper> = null;
    /**
     * The instance of RenderProxyManager that is used to process some optimization.
     */
    renderProxyManager = new RenderProxyManager(this);
    /**
     * Give api to nodes of this scene to mark them with a reference.
     * @internal
     */
    _refManager = new SceneElementRefManager();
    /**
     * The instance of ShaderComponentRegistry.
     * This class has a static map to cache the key of shader components which will be rendered to screen.
     * In addition, update light need use the api of this.
     * @internal
     */
    shaderComponentRegistry = new ShaderComponentRegistry();
    /**
     * @internal
     */
    splatManager = new SplatManager();
    /**
     * If any nodes of scene is added, deleted or changed, this would be set to true.
     * @defaultValue `false`
     */
    anyDrawableChanged = false;
    shadowMapNeedsUpdate = true;
    // these sets for caching changes between frame
    private newAddedSceneNodes: Set<Object3D> = new Set();
    private newDeletedSceneNodes: Set<Object3D> = new Set();
    private newChangedSceneNodes: Set<Object3D> = new Set();
    private allNodes = new Set<Object3D>();
    /**
     * @internal
     */
    anythingChanged = false;
    private updateId = 0;
    private _layerLightEnabled = false;
    /**
     * @internal
     */
    get layerLightEnabled() {
        return this._layerLightEnabled;
    }
    /**
     * @internal
     */
    set layerLightEnabled(value: boolean) {
        this._layerLightEnabled = value;
        if (hasManagedContentAPI()) {
            ManagedContentBridge.sceneSyncData(this);
        }
    }
    private _onlyDirectLight = false;
    /**
     * @internal
     */
    get onlyDirectLight() {
        return this._onlyDirectLight;
    }
    /**
     * @internal
     */
    set onlyDirectLight(value: boolean) {
        this._onlyDirectLight = value;
        if (hasManagedContentAPI()) {
            ManagedContentBridge.sceneSyncData(this);
        }
    }
    private _bvhEnabled: boolean = false;
    /**
     * @internal
     */
    get bvhEnabled() {
        return this._bvhEnabled;
    }
    /**
     * @internal
     */
    set bvhEnabled(v) {
        this._bvhEnabled = v;
        if (hasManagedContentAPI()) {
            ManagedContentBridge.sceneSyncData(this);
        }
    }
    /**
     * The name of instance's class.
     */
    className() {
        return 'Scene3D';
    }

    constructor() {
        super();
        this.scene = this;
        ShaderComponentRegistry.global.set(this, this.shaderComponentRegistry);
        this.allNodes.add(this);
        ContentBridge.sceneCreate(this);
        this.onNodeAdd(this);
    }
    /**
     * Clears this scene related data.
     */
    destroy() {
        this._refManager.destroy();
        this.renderProxyManager.destroy();
        this.shaderComponentRegistry.destroy();
        ShaderComponentRegistry.global.delete(this);
        ContentBridge.sceneDestroy(this);
        super.destroy();
    }
    /**
     * Get {@link Scene3D.anythingChanged| anythingChanged } to know if any change of node happen in scene graph.
     * When there is any change happening on the sets which store the all nodes of this scene,
     * the value will be set to true, it does not allow user to arrange.
     */
    get isAnythingChanged() {
        return this.anythingChanged;
    }

    get isShadowMapNeedsUpdate() {
        return this.shadowMapNeedsUpdate;
    }
    /**
     * When any node is added to scene, this method will record which nodes are added or just changed.
     * @param {Object3D} o added node.
     */
    onNodeAdd(o: Object3D) {
        this.emit(SceneChangeEvent);
        this.anythingChanged = true;

        this.newDeletedSceneNodes.delete(o);
        if (!this.allNodes.has(o)) {
            this.newAddedSceneNodes.add(o); // if is not exist last frame, its a new add.
        } else {
            this.newChangedSceneNodes.add(o); // if exist last frame, its actually change
        }

        if (TypeAssert.isLight(o)) {
            this.lights.add(o);
        } else if (TypeAssert.isSplat(o)) {
            this.splatManager.add(o);
        }

        ContentBridge.sceneNodeAttachScene(this, o);
        this.attachedNodes.set(o.id, o);
    }
    /**
     * When any changes occur at the node, this method will be used to record which nodes are changed.
     * @param {Object3D} o changed node.
     */
    onNodeChanged(o: Object3D) {
        this.emit(SceneChangeEvent);
        this.anythingChanged = true;

        if (this.allNodes.has(o)) {
            this.newChangedSceneNodes.add(o);
        }
        if (TypeAssert.isSplat(o)) {
            o.updateVersion();
        }
    }
    /**
     * When any node is deleted, this method will be used to record which nodes are deleted.
     * @param {Object3D} o deleted node.
     */
    onNodeDelete(o: Object3D) {
        this.newAddedSceneNodes.delete(o);
        this.newChangedSceneNodes.delete(o);
        if (this.allNodes.has(o)) {
            this.newDeletedSceneNodes.add(o);
        }

        this.emit(SceneChangeEvent);
        this.anythingChanged = true;

        if (TypeAssert.isLight(o)) {
            this.lights.delete(o);
        } else if (TypeAssert.isSplat(o)) {
            this.splatManager.remove(o);
        }
        ContentBridge.sceneNodeDetachScene(this, o);
        this.attachedNodes.delete(o.id);
    }
    /**
     * change {@link Object3D.updateDirtyId| updateDirtyId } of all node's parent to current update id
     * in order to avoid loop checking.
     */
    popParentChanges() {
        const popParent = (o: Object3D) => {
            if (o.updateDirtyId === this.updateId) {
                return;
            }
            o.updateDirtyId = this.updateId;
            if (o.parent) {
                popParent(o.parent);
            }
        };
        this.newAddedSceneNodes.forEach(o => popParent(o));
        this.newChangedSceneNodes.forEach(o => popParent(o));
        this.newDeletedSceneNodes.forEach(o => popParent(o));
    }
    /**
     * Synchronize the changes of scene nodes to {@link renderProxyManager| renderProxyManager } and clear these cache.
     */
    refreshChangeSets() {
        this.newAddedSceneNodes.forEach(o => {
            if (TypeAssert.isDrawable(o)) {
                this.renderProxyManager.onObjectAdd(o);
                this.anyDrawableChanged = true;
                this.shadowMapNeedsUpdate = true;
            } else if (TypeAssert.isLight(o)) {
                this.shadowMapNeedsUpdate = true;
            }
            this.allNodes.add(o);
        });
        this.newAddedSceneNodes.clear();

        this.newDeletedSceneNodes.forEach(o => {
            if (TypeAssert.isDrawable(o)) {
                this.renderProxyManager.onObjectDelete(o);
                this.anyDrawableChanged = true;
                this.shadowMapNeedsUpdate = true;
            } else if (TypeAssert.isLight(o)) {
                this.shadowMapNeedsUpdate = true;
            }
            this.allNodes.delete(o);
        });
        this.newDeletedSceneNodes.clear();

        this.newChangedSceneNodes.forEach(o => {
            o.clearChangeMark();
            if (TypeAssert.isDrawable(o)) {
                this.renderProxyManager.onObjectChange(o);
                this.anyDrawableChanged = true;
                this.shadowMapNeedsUpdate = true;
            } else if (TypeAssert.isLight(o)) {
                this.shadowMapNeedsUpdate = true;
            }
        });
        this.newChangedSceneNodes.clear();
        this.renderProxyManager.maintain();
    }
    /**
     * When {@link isAnythingChanged| isAnythingChanged } is true, all nodes of this scene will be checked if there is any change and increase update id.
     * The update id is used to compare with nodes' dirty mark and decide it needs to update in current frame.
     * @param {Renderer} renderer give renderer the {@link shaderComponentRegistry| shaderComponentRegistry } of this scene.
     * @param {Camera} camera this is used to update corresponding data.
     */
    update(forceRefreshChanges: boolean = false) {
        this.updateId++;
        if (hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
            ContentBridge.sceneUpdate(this);
        } else {
            this.anythingChanged = this.anythingChanged || forceRefreshChanges;
            if (forceRefreshChanges) {
                this.allNodes.forEach(node => {
                    if (!this.newDeletedSceneNodes.has(node)) {
                        this.newAddedSceneNodes.add(node);
                    }
                });
            }
            if (!this.isAnythingChanged) {
                return;
            }
            this.popParentChanges();
            // emit all hierarchy change
            this.traverseWithChildrenSkip(o => {
                if (o.updateDirtyId < (this.updateId - 1)) {
                    return false;
                }
                let changed = false;
                changed = o.updateVisibility() || changed;
                changed = o.updateWorldRenderData(this.updateId) || changed;
                // dispatch change to children
                if (changed) {
                    this.newChangedSceneNodes.add(o);
                    o.children.forEach(c => c.updateDirtyId = this.updateId - 1);
                }
                return true;
            });
        }

        this.refreshChangeSets();
    }

    afterRender() {
        this.anythingChanged = false;
        this.shadowMapNeedsUpdate = false;
    }
    /**
     * {@link update| update } the data of current scene and let {@link renderProxyManager| renderProxyManager } do optimize before final drawing;
     * @param {Renderer} renderer give renderer the {@link shaderComponentRegistry| shaderComponentRegistry } of this scene.
     * @param {Camera} camera this is used to update corresponding data.
     * @internal
     */
    generateDrawableList(isUseProxy: boolean = true): DrawableList {
        this.update();
        const result = this.renderProxyManager.generateDrawableList(isUseProxy);
        this.anyDrawableChanged = false;
        return result;
    }
    /**
     * Update data and render the effect of shader components whose corresponding config is active.
     * @param {IRenderer} renderer give renderer the {@link shaderComponentRegistry| shaderComponentRegistry } of this scene.
     * @param {Camera} camera this is used to update corresponding data.
     */
    updateRegistryAndActive(renderer: IRenderer, camera: Camera3D) {
        const { light, dynamicForwardLight } = this.shaderComponentRegistry;
        const lightLayer = this.layerLightEnabled ? camera.layers : undefined;
        light.activeLayers = lightLayer;
        dynamicForwardLight.activeLayers = lightLayer;
        light.onlyDirectLight = this.onlyDirectLight;
        light.collectLights(this.lights);
        dynamicForwardLight.setupOnlyLightSetForLaterRecollecting(this.lights);
        light.update(camera);
        dynamicForwardLight.update(camera);
        renderer.useRegistry(this.shaderComponentRegistry);
    }
    /**
     * Ues {@link Object3D.copy| copy() } of Object3D to copy {@link Object3D.matrixAutoUpdate| matrixAutoUpdate },
     * {@link Object3D.overrideMaterial| overrideMaterial } and data from source.
     * @param {Scene3D} source the data source.
     * @param {boolean} recursive if true, all nodes of this scene are also cloned. Default is true.
     */
    copy(source: Scene3D, recursive?: boolean) {
        super.copy(source, recursive);
        return this;
    }
}
