import { type Drawable, DrawableRenderMode } from '../../drawables/Drawable';
import type { Scene3D } from '../../Scene3D';
import { TypeAssert } from '../TypeAssert';
import { InstancePool } from './InstancePool';
import { DynamicAnalyser, extractorCreator } from './DynamicAnalyser';
import { DrawableSet, DrawableAdd, DrawableDelete, DrawableChange } from './DrawableSet';
import { MeshMergePool } from './MeshMergePool';
import { DrawableList, ProjectedDrawcallList, DrawcallListClassifyList } from '../DrawcallList';
import type { Camera3D } from '../../cameras/Camera3D';
import { PipelineContentAPIForRenderingAndFilteringEnabled, PipelineContentBridge } from '../../../fx/PipelineAPI';
import { hasManagedContentAPI, ManagedContentBridge } from '../../../ContentAPI';
import { PopMeshMergeManager } from '../mesh-merge/PopMeshMergeManager';
import type { PopMesh } from '../../drawables/PopMesh';
import { TextureCompression } from '../../../fx/plugins/PipelinePlugin';

export class RenderProxyManager {
    private scene: Scene3D;

    staticFrameDirtyId = 0; // mark the static group-frame-cache dirty
    isProxyChanged = false; // when proxy been updated, we don't want to trigger a new render automatically, so we use another state.

    // the analyser of free renderable
    private freeDynamicAnalyser = new DynamicAnalyser();
    private allRenderables = new Set<Drawable>(); // this set contains all render objects in the scene
    private allFreeRenderables = new DrawableSet(); // this set contains render objects that not been proxyed such as instancePool

    private instancePool = new InstancePool(this);
    private meshMergePool = new MeshMergePool(this);

    constructor(scene: Scene3D) {
        this.scene = scene;
        this.allFreeRenderables.on(DrawableAdd, d => {
            this.freeDynamicAnalyser.onObjectAdd(d);
        });
        this.allFreeRenderables.on(DrawableDelete, d => {
            this.freeDynamicAnalyser.onObjectDelete(d);
        });
        this.allFreeRenderables.on(DrawableChange, d => {
            this.freeDynamicAnalyser.onObjectChange(d);
        });
        this.freeDynamicAnalyser.onStaticFrameDirty = () => {
            this.staticFrameDirtyId++;
        };
    }

    // use a global ticker
    tick() {
        const timestamp = performance.now();
        if (hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
            ManagedContentBridge.sceneTick(this.scene, timestamp);
        } else {
            this.freeDynamicAnalyser.tick(timestamp);
            this.instancePool.dynamicAnalyser.tick(timestamp);
            this.meshMergePool.dynamicAnalyser.tick(timestamp);
        }
    }

    private popMerger = new PopMeshMergeManager();
    private _enablePopMeshMerge = false;
    get enablePopMeshMerge() {
        if (hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
            return this._enablePopMeshMerge;
        }
        return this.popMerger.enabled;
    }
    set enablePopMeshMerge(value: boolean) {
        this._enablePopMeshMerge = value;
        if (hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
            ManagedContentBridge.sceneSyncData(this.scene);
        } else {
            if (this.enablePopMeshMerge !== value) {
                this.popMerger.enabled = value;
                this.scene.notifySceneChange();
                this.scene.traverse(o => {
                    if (TypeAssert.isDrawable(o)) {
                        o.resetRenderEntity();
                    }
                });
            }
        }
        this.isProxyChanged = true;
    }

    mergePopMesh(popMesh: PopMesh) {
        if (hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
            return null;
        }
        return this.popMerger.merge(popMesh);
    }

    private _enableMeshMerge = false;
    get enableMeshMerge() {
        if (hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
            return this._enableMeshMerge;
        }
        return this.meshMergePool.enable;
    }
    set enableMeshMerge(value: boolean) {
        this._enableMeshMerge = value;
        if (hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
            ManagedContentBridge.sceneSyncData(this.scene);
        } else {
            if (this.enableMeshMerge !== value) {
                this.scene.notifySceneChange();
            }
            this.meshMergePool.setEnable(value, this.allFreeRenderables);
        }
        this.isProxyChanged = true; // when drop all proxy, we need refresh cached but invalid proxy in drawcall list
    }

    private _enableInstance = false;
    get enableInstance() {
        if (hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
            return this._enableInstance;
        }
        return this.instancePool.enable;
    }
    set enableInstance(value: boolean) {
        this._enableInstance = value;
        if (hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
            ManagedContentBridge.sceneSyncData(this.scene);
        } else {
            if (this.enableInstance !== value) {
                this.scene.notifySceneChange();
            }
            this.instancePool.setEnable(value, this.allFreeRenderables);
        }
        this.isProxyChanged = true;
    }

    private _enableAutoInstanceKey = false;
    get enableAutoInstanceKey() {
        if (hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
            return this._enableAutoInstanceKey;
        }
        return false;
    }
    set enableAutoInstanceKey(value: boolean) {
        this._enableAutoInstanceKey = value;
        if (hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
            ManagedContentBridge.sceneSyncData(this.scene);
        }
        this.isProxyChanged = true;
    }

    private _enableGpuDriven = false;
    private _gpuDriveCompressTextureCompression: TextureCompression = TextureCompression.BC7;
    get enableGpuDriven() {
        if (hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
            return this._enableGpuDriven;
        }
        return false;
    }
    set enableGpuDriven(value: boolean) {
        this._enableGpuDriven = value;
        if (hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
            ManagedContentBridge.sceneSyncData(this.scene);
        }
        this.isProxyChanged = true;
    }

    /**
     * @internal
     */
    get gpuDriveCompressTextureCompression() {
        if (hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
            return this._gpuDriveCompressTextureCompression;
        }
        return TextureCompression.None;
    }

    /**
     * @internal
     */
    set gpuDriveCompressTextureCompression(value: TextureCompression) {
        this._gpuDriveCompressTextureCompression = value;
        if (hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
            ManagedContentBridge.sceneSyncData(this.scene);
        }
        this.isProxyChanged = true;
    }

    // when obj has anything changed, we need invalidate proxy it if it's proxyed
    onObjectChange(obj: Drawable): void {
        if (hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
            return;
        }
        obj.updateRenderEntity();
        this.allFreeRenderables.changed(obj);
        this.instancePool.onObjectUpdate(obj);
        this.meshMergePool.onObjectUpdate(obj);
    }

    onObjectAdd(obj: Drawable) {
        if (hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
            return;
        }
        obj.updateRenderEntity();
        this.allRenderables.add(obj);
        this.allFreeRenderables.add(obj);
        obj.clearChangeMark();
    }

    onObjectDelete(obj: Drawable) {
        if (hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
            return;
        }
        this.allRenderables.delete(obj);
        this.allFreeRenderables.delete(obj);
        this.instancePool.onObjectDelete(obj);
        this.meshMergePool.onObjectDelete(obj);
        obj.updateRenderEntity();
        obj.clearChangeMark();
    }

    maintain() {
        if (hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
            return;
        }
        let changed = this.instancePool.maintain(this.allFreeRenderables);
        changed = this.meshMergePool.maintain(this.allFreeRenderables) || changed;
        this.isProxyChanged = this.isProxyChanged || changed;
    }

    proxyFree() {
        if (hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
            ManagedContentBridge.sceneOptimize(this.scene);
            return;
        }
        let changed = this.instancePool.maintain(this.allFreeRenderables, true);
        changed = this.meshMergePool.maintain(this.allFreeRenderables, true) || changed;
        this.isProxyChanged = this.isProxyChanged || changed;
    }

    private isCachedDrawableListDirty(isUseProxy: boolean) {
        return (
            this.drawableListAllCache === undefined ||
            this.isLastBatchUseProxy !== isUseProxy ||
            this.scene.anyDrawableChanged ||
            this.isProxyChanged
        );
    }

    cleanDrawableListCache() {
        if (this.drawableListAllCache) {
            this.drawableListAllCache.destroy();
            this.drawableListAllCache = undefined;
        }
        if (this.overlayDrawableListCache) {
            this.overlayDrawableListCache.destroy();
            this.overlayDrawableListCache = undefined;
        }
    }

    private isLastBatchUseProxy = true;
    private drawableListAllCache?: DrawableList;
    generateDrawableList(isUseProxy: boolean): DrawableList {
        if (!this.isCachedDrawableListDirty(isUseProxy)) {
            return this.drawableListAllCache!;
        }
        this.cleanDrawableListCache();
        this.drawableListAllCache = new DrawableList();
        if (PipelineContentAPIForRenderingAndFilteringEnabled()) {
            PipelineContentBridge.drawableListCreateFromScene(this.drawableListAllCache, this.scene, isUseProxy);
        }

        this.isLastBatchUseProxy = isUseProxy;
        this.isProxyChanged = false;

        const extractor = extractorCreator(this.drawableListAllCache);
        if (isUseProxy) {
            // batch = free + proxyed
            this.allFreeRenderables.forEach(extractor);
            this.instancePool.generateDrawableList(this.drawableListAllCache);
            this.meshMergePool.generateDrawableList(this.drawableListAllCache);
        } else {
            this.allRenderables.forEach(extractor);
        }

        return this.drawableListAllCache;
    }

    private overlayDrawableListCache?: DrawableList;
    generateOverlayDrawableList(): DrawableList {
        if (this.overlayDrawableListCache && !this.scene.anyDrawableChanged) {
            return this.overlayDrawableListCache;
        }
        if (this.overlayDrawableListCache) {
            this.overlayDrawableListCache.destroy();
        }
        const drawableList = (this.overlayDrawableListCache = new DrawableList());
        if (PipelineContentAPIForRenderingAndFilteringEnabled()) {
            PipelineContentBridge.drawableListCreateFromScene(
                drawableList,
                this.scene,
                false,
                DrawableRenderMode.Overlay,
            );
        }
        const extractor = extractorCreator(drawableList, DrawableRenderMode.Overlay);
        // overlay always free not proxied
        this.allFreeRenderables.forEach(extractor);
        return drawableList;
    }

    generateDynamicList(camera: Camera3D) {
        this.scene.update();
        if (PipelineContentAPIForRenderingAndFilteringEnabled()) {
            const list = new ProjectedDrawcallList(new DrawableList(), [], [], camera);
            PipelineContentBridge.drawcallListCreateFromDynamic(list, this.scene, camera);
            return list;
        }

        const dynamicList = new DrawableList();
        this.freeDynamicAnalyser.generateDynamicDrawcallList(dynamicList);
        this.instancePool.generateDynamicList(dynamicList);
        this.meshMergePool.generateDynamicList(dynamicList);
        return dynamicList.project(camera, undefined, undefined, DrawcallListClassifyList.opaque);
    }

    generateStaticList(camera: Camera3D) {
        this.scene.update();
        if (PipelineContentAPIForRenderingAndFilteringEnabled()) {
            const list = new ProjectedDrawcallList(new DrawableList(), [], [], camera);
            PipelineContentBridge.drawcallListCreateFromStatic(list, this.scene, camera);
            return list;
        }

        const staticList = new DrawableList();
        this.freeDynamicAnalyser.generateStaticDrawcallList(staticList);
        this.instancePool.generateStaticList(staticList);
        this.meshMergePool.generateStaticList(staticList);
        return staticList.project(camera, undefined, undefined, DrawcallListClassifyList.opaque);
    }

    destroy() {
        this.popMerger.clear();
    }
}
