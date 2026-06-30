import { RenderEngine, ResetRendererEvent, RendererInitialized } from './engine/RenderEngine.js';
import { type RenderInfo, FrameInfo } from './utils/RenderInfo.js';
import type { ViewerConfig, EngineInitializeConfig, RenderMode, ConfigCell } from './engine/EngineConfig.js';
import {
    BackgroundMode,
    type BackgroundParameter,
    type SolidColorBackgroundParameter,
    type GradientBackgroundParameter,
    type SkyBackgroundParameter,
    type EnvMapBackgroundParameter,
    type BasicBackgroundParameter,
} from './scene/renderables/Background.js';
import { Scene3D, SceneChangeEvent } from './scene/Scene3D.js';
import { exportScene } from './scene/tools/SceneIO.js';
import { type Size, Utils, type IRange } from './utils/Utils.js';
import type { Camera3D } from './scene/cameras/Camera3D.js';
import { Picker } from './scene/tools/Picker.js';
import { EventType, EventDispatcher } from './utils/EventDispatcher.js';
import { TickEvent } from './utils/FPSTimer.js';
import { logger } from './utils/Logger.js';
import type { SnapshotRenderer as DeprecatedSnapshotRenderer } from './snapshot/SnapshotRenderer.js';
import type { SnapshotRenderer } from './snapshot/SnapshotRendererV2.js';
import {
    ContextLostEvent,
    ContextLostRestoreFailedEvent,
    type CtxLostInfo,
    MemoryGrowFailed,
} from './renderer/IRenderer.js';
import { CoordinateSystemHelper } from './scene/helpers/CoordinateSystemHelper.js';
import type { RenderTarget } from './elements/textures/RenderTarget.js';
import type { ArrayCamera } from './scene/cameras/ArrayCamera.js';
import type { BaseElement } from './utils/ElementBase.js';
import { ContentBridge } from './ContentAPI.js';
import { type MemoryInfo, RendererBackend } from './renderer/IRenderer.js';
import { TypeAssert } from './scene/tools/TypeAssert.js';
import type { HighLightItem, HighlightGroup } from './fx/plugins/Highlight.js';
import { type RenderingConfig, TextureCompression } from './fx/plugins/PipelinePlugin.js';
import { COMPOSITE_TARGET_NAME } from './fx/plugins/Composite.js';
import { Viewport } from './Viewport.js';
import type { Vector4 } from './math/Vector4.js';
import { ToggleWebGPUEvent, WebGPUUnstable, WebGPUValidationFailed } from './Bridge/utils.js';
import { applicationTimer } from './utils/ApplicationTimer.js';

export type { HighLightItem, HighlightGroup } from './fx/plugins/Highlight.js';

export type RequestRenderHandler = () => void;

// Canvas size change event
/**
 * Event emitted after a viewer is resized.
 */
export const ViewerResizeEvent = new EventType<{ target: Viewer; width: number; height: number }>();
/**
 * Event emitted when a viewer is uninitialized.
 */
export const ViewerUnInitializeEvent = new EventType<{ target: Viewer }>();

// emit before egs rendering starts, used for tracking when rendering is over
export const RenderEvent = new EventType();
/**
 * Event emitted after a render pass completes.
 */
export const RenderOverEvent = new EventType();
export const NoRenderForAWhileEvent = new EventType();
export const ConfigChangeEvent = new EventType();

/**
 * Event emitted when the viewer encounters a fatal runtime error.
 */
export const RuntimeFatalErrorEvent = new EventType();

interface MaybeHasSubResource extends BaseElement {
    destroyAllResourcesOwned(): void;
}

export class DefaultResourceCell<T extends MaybeHasSubResource> {
    default: T;
    _item: T;
    constructor(def: T) {
        this.default = def;
    }

    set item(item: T) {
        this._item = item;
    }

    get item() {
        if (this._item) {
            return this._item;
        } else {
            return this.default;
        }
    }

    destroy() {
        this.default.destroyAllResourcesOwned();
    }
}

export interface ViewerPlugin {
    /**
     * called when register to viewer
     */
    init(viewer: Viewer, viewerContainer: HTMLElement): void;
    /**
     * called when unregister from viewer or destroying viewer.
     */
    destroy(viewer: Viewer, viewerContainer: HTMLElement): void;
    /**
     * called on every rendering request started.
     * @param requestFrameId the frame id will be rendered in current rendering request
     * @param lastRenderedFrameId last actually rendered the frame id
     */
    beforeRendering?(requestFrameId: number, lastRenderedFrameId: number): void;
    /**
     * called on every rendering request finish, but the rendering request maybe not actually executed.
     * use `renderedFrameId` to check whether rendering request has executed.
     * @param renderedFrameId the latest rendered frame id after current rendering request finished.
     */
    afterRendering?(renderedFrameId: number): void;
}

const toDataURL = HTMLCanvasElement.prototype.toDataURL;
const toBlob = HTMLCanvasElement.prototype.toBlob;
const CanvasPatched = Symbol('CanvasPatched');

/**
 * This class is used to set up the configuration and canvas for RenderEngine.
 * It also contains instance of grid-like ground, background and Coordinate System.
 */
export class Viewer extends EventDispatcher {
    static instances: Set<Viewer> = new Set();
    /**
     * The name of viewer, which could be empty.
     */
    name: string;
    /**
     * HTMLElements, which is set in the constructor function.
     */
    private _canvasContainer: HTMLElement;
    get canvasContainer() {
        return this._canvasContainer;
    }

    private engine: RenderEngine;
    /**
     * @internal
     */
    _getEngine() {
        return this.engine;
    }
    /**
     * @internal
     */
    frameInfo = new FrameInfo();
    private statistics = new RenderStatistics();
    private scene: DefaultResourceCell<Scene3D> = new DefaultResourceCell(new Scene3D());

    /**
     * @internal
     */
    renderingConfig: RenderingConfig = {
        MSAA: true,
        tlsFlags: 0,
        gpuDriven: {
            enabled: false,
            requested: true,
            textureCompression: TextureCompression.BC7,
        },
    };
    /**
     * Get the instance of 3D scene in current viewer.
     */
    getScene(): Scene3D {
        return this.scene.item;
    }
    /**
     * If some users hopes to replace or update the 3d scene, they need to use the function,
     * which has been invoked in constructor to initialize the root.
     * @param scene A Scene3D object of current scene.
     * @tips If change the scene, ground, coordinate system and background will be reset.
     */
    setScene(scene: Scene3D): void {
        const old = this.getScene();
        if (old === scene) {
            return;
        }
        old.off(SceneChangeEvent, this.requestRender);
        scene.on(SceneChangeEvent, this.requestRender);
        scene.layerLightEnabled = this.scene.item.layerLightEnabled;
        scene.bvhEnabled = this.scene.item.bvhEnabled;
        scene.coordSysHelper = this.coordSysHelper;

        scene.renderProxyManager.enableGpuDriven = this.enableGpuDriven;
        scene.renderProxyManager.gpuDriveCompressTextureCompression = this.gpuDrivenTextureCompression;

        scene.renderProxyManager.enableInstance = this.enableInstance;
        scene.renderProxyManager.enablePopMeshMerge = this.enableMeshMerge;
        scene.renderProxyManager.enableMeshMerge = this.enableMultiMeshMerge;
        scene.renderProxyManager.enableAutoInstanceKey = this.enableAutoInstanceKey;
        this.scene.item = scene;
        this.viewportList.forEach(v => (v.scene = scene));
        this.engine.refreshRenderables();
        this.requestRender();
    }

    private _isDestroyed = false;
    get isDestroyed() {
        return this._isDestroyed;
    }

    /**
     * Enabled instance rendering can make engine accelerate render for a large number of same objects in the scene.
     * It is effective for both 2D and 3D scene.
     * @defaultValue `false`
     */
    private _enableInstance: boolean = false;
    get enableInstance() {
        return this._enableInstance;
    }
    set enableInstance(v) {
        this._enableInstance = v;
        if (this.scene) {
            this.scene.item.renderProxyManager.enableInstance = v;
        }
    }
    /**
     * Enabled auto instance key can automatically generate instance key on meshes without this key originally.
     * @defaultValue `false`
     */
    private _enableAutoInstanceKey: boolean = false;
    get enableAutoInstanceKey() {
        return this._enableAutoInstanceKey;
    }
    set enableAutoInstanceKey(v) {
        this._enableAutoInstanceKey = v;
        if (this.scene) {
            this.scene.item.renderProxyManager.enableAutoInstanceKey = v;
        }
    }
    /**
     * Enabled this attribute can accelerate render for all mesh by merge some small objects into one big buffer.
     * It is effective for both 2D and 3D scene.
     * @defaultValue `true`
     */
    private _enableMultiMeshMerge: boolean = false;
    get enableMultiMeshMerge() {
        return this._enableMultiMeshMerge;
    }
    set enableMultiMeshMerge(v) {
        this._enableMultiMeshMerge = v;
        if (this.scene) {
            this.scene.item.renderProxyManager.enableMeshMerge = v;
        }
    }
    /**
     * Enabled this attribute can accelerate render each mesh by merge some small objects into one big buffer.
     * It is only effective for 3D scene.
     * @defaultValue `true`
     */
    private _enableMeshMerge: boolean = false;
    get enableMeshMerge() {
        return this._enableMeshMerge;
    }
    set enableMeshMerge(v) {
        this._enableMeshMerge = v;
        if (this.scene) {
            this.scene.item.renderProxyManager.enablePopMeshMerge = v;
        }
    }

    /**
     * Enabled gpu driven.
     * @internal
     * @defaultValue `false`
     */
    get enableGpuDriven() {
        return this.renderingConfig.gpuDriven.enabled;
    }
    /**
     * @internal
     */
    set enableGpuDriven(v) {
        const enabled =
            v && this.engine.renderer.backend === RendererBackend.WEBGPU_WASM && !this.renderingConfig.tlsFlags;
        this.renderingConfig.gpuDriven.enabled = enabled;
        if (this.scene) {
            this.scene.item.renderProxyManager.enableGpuDriven = enabled;
        }
    }

    /**
     * Gpu driven texture compression type.
     * @defaultValue `TextureCompression.BC3HighQuality`
     * @internal
     */
    get gpuDrivenTextureCompression() {
        return this.renderingConfig.gpuDriven.textureCompression;
    }

    /**
     * @internal
     */
    set gpuDrivenTextureCompression(v: TextureCompression) {
        this.renderingConfig.gpuDriven.textureCompression = v;
        if (this.scene) {
            this.scene.item.renderProxyManager.gpuDriveCompressTextureCompression = v;
        }
    }

    get rendererBackend() {
        return this.engine.renderer.backend;
    }

    private plugins: ViewerPlugin[] = [];
    /**
     * @internal
     */
    registerPlugin(plugin: ViewerPlugin) {
        this.plugins.push(plugin);
        plugin.init(this, this.canvasContainer);
    }
    /**
     * @internal
     */
    unregisterPlugin(plugin: ViewerPlugin) {
        const index = this.plugins.findIndex(p => p === plugin);
        if (index !== -1) {
            this.plugins.splice(index, 1);
            plugin.destroy(this, this.canvasContainer);
        }
    }

    /**
     * This method provides some information of the engine for users.
     * The instance of RenderInfo can get the number of refreshed times in the Shader program, materials and lights.
     * The frameInfo includes Fps, usage of CPU and so on.
     * The objectInfo includes the number of geometries, textures, drawcall, vertices, faces and so on.
     */
    get renderInfo(): RenderInfo {
        return this.engine.renderer.renderInfo;
    }

    get snapshotRendererV2(): SnapshotRenderer {
        return this.engine.snapshotRenderer;
    }

    /**
     * An customizable arrow function will be called when use requestRender();
     */
    private _requestRenderHandler?: RequestRenderHandler;
    get requestRenderHandler() {
        return this._requestRenderHandler;
    }
    set requestRenderHandler(v) {
        this._requestRenderHandler = v;
        this.viewportList.forEach(v => (v.requestRenderHandler = this._requestRenderHandler));
    }
    /**
     * Request to invoke RenderHandler function if it is not null;
     */
    requestRender = () => {
        this.requestRenderHandler?.();
    };

    private onlyDefaultViewport: boolean = false;
    private viewportList: Viewport[] = [];
    /**
     * @internal
     */
    get defaultViewport() {
        if (!this.onlyDefaultViewport) {
            throw new Error('EGS Exception: default viewport is unavailable when viewport manually created.');
        }
        return this.viewportList[0];
    }

    /**
     * @internal
     */
    clearPipelineCache() {
        this.viewportList.forEach(v => v.pipeline.resetContentCache());
    }

    /**
     * @internal
     */
    set renderPixelRatio(value: number) {
        this.engine.renderPixelRatio = value;
        this.viewportList.forEach(v => v.resize(this.getSize()));
    }

    /**
     * @internal
     */
    get renderPixelRatio(): number {
        return this.engine.renderPixelRatio;
    }

    /**
     * Creates an instance of Viewer.
     * @param {HTMLElement} canvasContainer
     * A dom of canvas where is used to render.
     * @param {EngineInitializeConfig} engineInitializeConfig
     * User's defined object of EngineInitializeConfig includes antialiasing and alpha, both are boolean types.
     * Default value is usually true for antialiasing and false for alpha
     * @return
     */
    constructor(canvasContainer: HTMLElement, engineInitializeConfig: EngineInitializeConfig) {
        super();
        Viewer.instances.add(this);
        this._canvasContainer = canvasContainer;
        this.setScene(this.scene.item);
        this.engine = new RenderEngine(canvasContainer, engineInitializeConfig);
        this.engine.on(ResetRendererEvent, () => {
            this.viewportList.forEach(v => v.updateRenderer());
        });
        this.engine.on(RendererInitialized, r => {
            if (r === this.engine.renderer) {
                this.viewportList.forEach(v => v.resetPipelineCache());
            }
            this.forceNextFrameRender = true;
            this.requestRender();
        });
        this.engine.on(ContextLostEvent, (payload: CtxLostInfo) => {
            this.requestRender();
            this.emit(ContextLostEvent, payload);
        });
        this.engine.on(ContextLostRestoreFailedEvent, () => {
            this.emit(ContextLostRestoreFailedEvent);
        });
        this.engine.on(WebGPUUnstable, () => this.emit(WebGPUUnstable));
        this.engine.on(WebGPUValidationFailed, frames => this.emit(WebGPUValidationFailed, frames));
        this.engine.once(MemoryGrowFailed, () => this.emit(RuntimeFatalErrorEvent));

        // HACK: current viewer related canvas, make toDataURL, toBlob works on WebGPU
        // related:
        // https://issues.chromium.org/issues/435220210
        // https://github.com/gpuweb/gpuweb/issues/2743
        this.engine.on(ToggleWebGPUEvent, payload => {
            if (payload.enabled && !payload.offscreen && !(payload as any)[CanvasPatched]) {
                const viewer = this;
                payload.canvas.toDataURL = function (...args) {
                    // force render, only if no rendering in current frame
                    if (viewer.engine.lastRenderedFrameId !== viewer.frameInfo.fpsCollector.frameId) {
                        try {
                            viewer.forceNextFrameRender = true;
                            viewer.render();
                        } catch {
                            //
                        }
                    }
                    return toDataURL.apply(this, args);
                };
                payload.canvas.toBlob = function (...args) {
                    // force render, only if no rendering in current frame
                    if (viewer.engine.lastRenderedFrameId !== viewer.frameInfo.fpsCollector.frameId) {
                        try {
                            viewer.forceNextFrameRender = true;
                            viewer.render();
                        } catch {
                            //
                        }
                    }
                    return toBlob.apply(this, args);
                };
                (payload as any)[CanvasPatched] = true;
            }
        });

        this.on(NoRenderForAWhileEvent, () => {
            if (this.scene) {
                this.scene.item.renderProxyManager.proxyFree();
            }
            this.engine.renderer.releaseUnusedResources(1000);
        });
        this.resume();
        this.emit(ViewerResizeEvent, {
            target: this,
            width: this.engine.width,
            height: this.engine.height,
        });
        this.createViewport('default');
        this.onlyDefaultViewport = true;
        this.enableGpuDriven = this.renderingConfig.gpuDriven.requested;
        ContentBridge.sceneSyncData(this.scene.item);
    }

    createViewport(name: string, bound?: Vector4) {
        if (this.onlyDefaultViewport) {
            this.onlyDefaultViewport = false;
            this.clearViewport();
        }
        const viewport = new Viewport(name, this, this.engine, this.getScene(), this.viewportList.length, bound);
        viewport.requestRenderHandler = this.requestRenderHandler;
        this.viewportList.push(viewport);
        return viewport;
    }

    removeViewport(viewport: Viewport) {
        this.viewportList = this.viewportList.filter(v => v !== viewport);
        // update tls flags.
        this.renderingConfig.tlsFlags = 0;
        for (let i = 0, j = this.viewportList.length; i < j; i++) {
            const viewport = this.viewportList[i];
            viewport.viewIndex = i;
            if (viewport.pipeline.transparentLinePlugin.enabled) {
                this.renderingConfig.tlsFlags |= 1 << i;
            }
        }
        viewport.destroy();
        this.enableGpuDriven = this.renderingConfig.gpuDriven.requested;
    }

    clearViewport() {
        this.onlyDefaultViewport = false;
        this.viewportList.forEach(v => v.destroy());
        this.viewportList = [];
        this.renderingConfig.tlsFlags = 0;
        this.enableGpuDriven = this.renderingConfig.gpuDriven.requested;
    }

    private lastRenderEmitTime = 0;
    private noRenderChecker?: Promise<void>;
    private notifyRendered = () => {
        this.lastRenderEmitTime = performance.now();
        if (this.noRenderChecker === undefined) {
            this.noRenderChecker = this.waitForRenderOver().then(() => {
                this.emit(NoRenderForAWhileEvent);
                this.noRenderChecker = undefined;
            });
        }
    };
    /**
     * Give an asynchronous function to user to block program until passed a period from last render.
     * @param {number} time wait for setting milliseconds. Default is 1000.
     */
    waitForRenderOver = async (v: number = 1000) => {
        const time = Math.max(16, v);
        while (performance.now() - this.lastRenderEmitTime < time || this.lastRenderEmitTime === 0) {
            await Utils.wait(time);
        }
    };

    /**
     * Get real size of drawing area from engine's width and height.
     * The size normally is same as canvas.
     */
    getSize(): Size {
        return { width: this.engine.width, height: this.engine.height };
    }

    /**
     * Change the size of rendering area, if the size is not given then it will automatically adapt to the canvas.
     * @param {Size} size Optional parameter.
     */
    resize(size?: Size): void {
        this.engine.resize(size);
        this.viewportList.forEach(v => v.resize(this.getSize()));
        this.emit(ViewerResizeEvent, { target: this, width: this.engine.width, height: this.engine.height });
        this.requestRender();
    }

    /**
     * keep instance but do nothing in CPU;
     */
    private isPaused = true;
    pause() {
        if (this.isPaused || this._isDestroyed) {
            return;
        }

        this.isPaused = true;
        this.frameInfo.fpsCollector.stop();
        this.off(RenderEvent, this.notifyRendered);
        this.frameInfo.fpsCollector.clearAllListeners();
    }
    resume() {
        if (!this.isPaused || this._isDestroyed) {
            return;
        }

        this.isPaused = false;
        this.frameInfo.fpsCollector.start();
        this.on(RenderEvent, this.notifyRendered);
        this.frameInfo.fpsCollector.on(TickEvent, () => {
            this.scene.item.renderProxyManager.tick();
            this.engine.renderer.tick(performance.now());
        });
    }

    /**
     * @internal
     */
    forceNextFrameRender: boolean = false;
    private isPerformanceSlow: boolean = false;
    /**
     * Render one frame with the configuration and objects in the scene.
     * All setting of config, scene or camera need to be finished before this.
     * @tip If user draw a 2D scene, the attribute render2D should be set to true in advance.
     */
    render(): void {
        if (this.isPaused || this.isDestroyed) {
            return;
        }

        this.plugins.forEach(p =>
            p.beforeRendering?.(this.frameInfo.fpsCollector.frameId, this.engine.lastRenderedFrameId),
        );
        ContentBridge.beforeFrame(this);
        this.engine.renderer.beforeFrameRender(this.frameInfo.fpsCollector.frameId, this.engine.lastRenderedFrameId);
        this.frameInfo.beginFrameTick();
        applicationTimer.updateFirstRenderTime(this.frameInfo.timeStart);
        this.emit(RenderEvent);

        const scene = this.getScene();
        ContentBridge.maintainTheWorld(scene);
        scene.update();

        let shouldContinue = false;
        const viewportList = this.viewportList.sort((a, b) => a.layer - b.layer);
        for (let i = 0; i < viewportList.length; i++) {
            const viewport = viewportList[i];
            shouldContinue =
                viewport.render(
                    this.frameInfo.fpsCollector.frameId,
                    this.forceNextFrameRender || viewportList.length > 1,
                    this.isPerformanceSlow,
                ) || shouldContinue;
        }
        scene.afterRender();
        this.engine.afterRender();
        this.forceNextFrameRender = false;

        this.emit(RenderOverEvent);
        this.frameInfo.endFrameTick();
        const frameTimeAvg = this.frameInfo.fpsCollector.getAverageFrameTime();
        this.isPerformanceSlow = 1000 / frameTimeAvg < 30;
        ContentBridge.afterFrame();
        this.engine.renderer.afterFrameRender(this.engine.lastRenderedFrameId);
        this.plugins.forEach(p => p.afterRendering?.(this.engine.lastRenderedFrameId));
        if (shouldContinue) {
            this.requestRender();
        }
    }

    /**
     * Get render result to a TypedArray from the Framebuffer.
     * The result is a rectangular area from left-bottom beginning to right-top ending pixel.
     * @param {Uint8Array} resultData All color will be store in this array, which color' format is RGBA within 0-255,
     * @param {number} x Beginning pixel position's x.
     * @param {number} y Beginning pixel position's y.
     * @param {number} width Rectangular area's width.
     * @param {number} height Rectangular area's height.
     * @deprecated use `readRenderResultAsync` instead
     */
    readRenderResult(resultData: Uint8Array, range: IRange) {
        logger.error('readRenderResult is deprecated, use readRenderResultAsync instead.');
        if (this.engine === null) {
            logger.invalidInput('this.engine has been destroyed');
            return;
        }
        const target = this.defaultViewport.pipeline
            ._getEffectComposer()
            ._getFrameBuffer(COMPOSITE_TARGET_NAME) as RenderTarget;
        if (!target) {
            logger.invalidInput('readRenderResult need enable isExtraCopyBeforeScreenEnabled');
            return;
        }
        this.engine.renderer.readPixels(target, range, resultData);
    }

    /**
     * Get render result to a TypedArray from the Framebuffer.
     * The result is a rectangular area from left-bottom beginning to right-top ending pixel.
     * @param {Uint8Array} resultData All color will be store in this array, which color' format is RGBA within 0-255,
     * @param {number} x Beginning pixel position's x.
     * @param {number} y Beginning pixel position's y.
     * @param {number} width Rectangular area's width.
     * @param {number} height Rectangular area's height.
     */
    readRenderResultAsync(resultData: Uint8Array, range: IRange) {
        if (this.engine === null) {
            logger.invalidInput('this.engine has been destroyed');
            return;
        }
        const target = this.defaultViewport.pipeline
            ._getEffectComposer()
            ._getFrameBuffer(COMPOSITE_TARGET_NAME) as RenderTarget;
        if (!target) {
            logger.invalidInput('readRenderResult need enable isExtraCopyBeforeScreenEnabled');
            return;
        }
        return this.engine.renderer.readPixelsAsync(target, range, resultData);
    }

    /**
     * Get render result to a Data Url from the canvas api.
     * @deprecated unstable read back, depend on browser's implement, use `readRenderResultAsync` instead.
     * @param {string} type A DOMString indicating the image format. The default type is image/png;
     */
    readRenderResultDataUrl(type?: string, ...args: any[]): string {
        this.render();
        const canvas = this._canvasContainer.firstElementChild as HTMLCanvasElement;
        return canvas.toDataURL(type, ...args);
    }

    /**
     * stop the listening events,
     * reset scene graph and camera,
     * release the resource of engine
     * and remove bounded canvas.
     */
    destroy(): void {
        if (this._isDestroyed) {
            return;
        }

        this.frameInfo.destroy();
        this.plugins.forEach(p => p.destroy(this, this.canvasContainer));
        this.scene.destroy();
        this.coordSysHelper.destroy();
        this._canvasContainer = null!;
        this.requestRenderHandler = undefined;
        this.emit(ViewerUnInitializeEvent, { target: this });
        this.clearAllListeners();
        this.clearViewport();

        this.engine.destroy();
        this.engine = null!;
        this._isDestroyed = true;
        Viewer.instances.delete(this);
    }

    /**
     * Statistics data not only include the content of RenderInfo,
     * also provide the size of geometryBuffer, textureByte and Framebuffer and so on.
     * @remarks See {@link renderInfo | renderInfo } for more details.
     */
    getRenderStatistics(): Readonly<RenderStatistics> {
        const re = this.statistics;
        if (!this.isPaused && !this.isDestroyed) {
            re.totalTime = this.frameInfo.lastFrameTime;
            re.CPUTime = this.frameInfo.lastFrameRenderCPUTime;
            re.backend = this.engine.renderer.backend;
            this.engine.renderer.updateRenderStatistics(re);
        }

        return re;
    }

    getMemoryInfo(whenGrowFailed?: boolean): Readonly<MemoryInfo> {
        return this.engine.renderer.getMemoryInfo(whenGrowFailed);
    }

    /**
     * Download a file which store the data of current scene from browser.
     * @param {string} name The name of downloaded file. Default name is debug.
     */
    downloadSceneData(name: string = 'debug') {
        if (this.scene) {
            exportScene(this.scene.item, name);
        }
    }

    /**
     * If user needs picking feature, this method will offer a Picker's instance with two APIS: pick and pickFirst.
     */
    createPicker(): Picker {
        return new Picker(this);
    }

    /**
     * free gpu memory by context lost, restore gpu memory when next draw
     */
    freeGPU() {
        this.engine.renderer.forceContextLost();
    }

    //#region TODO: deprecated
    /**
     * An instance of SnapshotRenderer used to take snapshot of selected object.
     * @deprecated use snapshotRendererV2
     * @initialize It is initialized in the constructor of the RenderEngine.
     * @remarks See {@link SnapshotRenderer| SnapshotRenderer} for more details.
     */
    get snapshotRenderer(): DeprecatedSnapshotRenderer {
        return this.engine.deprecatedSnapshotRenderer;
    }
    /**
     * An instance of EngineConfig used to manipulate configuration of the engine.
     * @initialize The instance is initialized in constructor function of Viewer.
     * @remarks See {@link EngineConfig| EngineConfig} for more details.
     */
    get config(): ViewerConfig {
        return this.defaultViewport.config;
    }
    /**
     * The background mode which is shown in current canvas.
     * @defaultValue `BackgroundMode.SkyBackground`
     * @deprecated
     * currentBackground is move to postPipeline
     */
    get currentBackground(): BackgroundMode {
        return this.config.background.active.get();
    }
    set currentBackground(v: BackgroundMode) {
        this.config.background.active.set(v);
    }

    get ground() {
        return this.defaultViewport.pipeline.backgroundPlugin.ground;
    }
    set ground(v) {
        if (v !== this.ground) {
            this.defaultViewport.pipeline.backgroundPlugin.ground = v;
        }
    }
    /**
     * An instance of CoordinateSystemHelper which could be turned on by the config.
     */
    coordSysHelper = new CoordinateSystemHelper();
    /**
     * The mode of render which is applied in current scene.
     * @defaultValue `RenderMode.SHADING`
     * @deprecated
     */
    get currentRenderMode(): RenderMode {
        return this.defaultViewport.pipeline.currentRenderMode;
    }

    /**
     * An instance of BasicBackground, which only works when the render mode of background is set to BasicBackground.
     * @deprecated use `config.background.basic` instead
     * basicBackground is move to postPipeline
     */
    get basicBackground() {
        return this.defaultViewport.pipeline.backgroundPlugin.basicBackground;
    }
    /**
     * @deprecated  set is not allow to use, use `config.background.basic` to update parameters instead.
     * basicBackground is move to postPipeline
     */
    set basicBackground(background) {
        this.defaultViewport.pipeline.backgroundPlugin.basicBackground = background;
    }
    /**
     * An instance of SolidColorBackground, which only works when the render mode of background is set to SolidColorBackground.
     * @deprecated use `config.background.solid` instead
     * solidBackground is move to postPipeline
     */
    get solidBackground() {
        return this.defaultViewport.pipeline.backgroundPlugin.solidBackground;
    }
    /**
     * @deprecated set is not allow to use, use `config.background.solid` to update parameters instead.
     * solidBackground is move to postPipeline
     */
    set solidBackground(background) {
        this.defaultViewport.pipeline.backgroundPlugin.solidBackground = background;
    }
    /**
     * An instance of SkyBackground, which only works when the render mode of background is set to SkyBackground.
     * @deprecated use `config.background.sky` instead
     * skyBackground is move to postPipeline
     */
    get skyBackground() {
        return this.defaultViewport.pipeline.backgroundPlugin.skyBackground;
    }
    /**
     * @deprecated set is not allow to use, use `config.background.sky` to update parameters instead.
     * skyBackground is move to postPipeline
     */
    set skyBackground(background) {
        this.defaultViewport.pipeline.backgroundPlugin.skyBackground = background;
    }
    /**
     * An instance of EnvMapBackground, which only works when the render mode of background is set to EnvMapBackground.
     * @deprecated use `config.background.envmap` instead
     * envBackground is move to postPipeline
     */
    get envBackground() {
        return this.defaultViewport.pipeline.backgroundPlugin.envBackground;
    }
    /**
     * @deprecated set is not allow to use, use `config.background.envmap` to update parameters instead.
     * envBackground is move to postPipeline
     */
    set envBackground(background) {
        this.defaultViewport.pipeline.backgroundPlugin.envBackground = background;
    }
    /**
     * An instance of GradientBackground, which only works when the render mode of background is set to GradientBackground.
     * @deprecated use `config.background.gradient` instead
     * gradientBackground is move to postPipeline
     */
    get gradientBackground() {
        return this.defaultViewport.pipeline.backgroundPlugin.gradientBackground;
    }
    /**
     * @deprecated set is not allow to use, use `config.background.gradient` to update parameters instead.
     * gradientBackground is move to postPipeline
     */
    set gradientBackground(background) {
        this.defaultViewport.pipeline.backgroundPlugin.gradientBackground = background;
    }

    /**
     * @deprecated use `canvasContainer`
     * Get instance of HTMLElement that will attach canvas which is set in the constructor function.
     */
    getContainerElement(): Readonly<HTMLElement> {
        return this.canvasContainer;
    }

    /**
     * Change the parameters of background such as mode and corresponding parameters.
     * @param {BackgroundParameter} parameter An object of BackgroundParameter.
     * @deprecated use `config.background` instead.
     */
    updateBackGroundParameter(parameter: BackgroundParameter) {
        const setter = (cell: ConfigCell<any>, v: any) => {
            if (v !== undefined) {
                cell.set(v);
            }
        };

        if (parameter.parameter !== undefined) {
            switch (parameter.mode) {
                case BackgroundMode.BasicBackground:
                    const basic = parameter.parameter as BasicBackgroundParameter;
                    setter(this.config.background.basic.alpha, basic.alpha);
                    setter(this.config.background.basic.color, basic.color);
                    setter(this.config.background.basic.texture, basic.texture);
                    break;
                case BackgroundMode.SolidColorBackground:
                    const solid = parameter.parameter as SolidColorBackgroundParameter;
                    setter(this.config.background.solid.alpha, solid.alpha);
                    setter(this.config.background.solid.color, solid.color);
                    break;
                case BackgroundMode.GradientBackground:
                    const gradient = parameter.parameter as GradientBackgroundParameter;
                    setter(this.config.background.gradient.groundColor, gradient.groundColor);
                    setter(this.config.background.gradient.skyColor, gradient.skyColor);
                    break;
                case BackgroundMode.SkyBackground:
                    const sky = parameter.parameter as SkyBackgroundParameter;
                    setter(this.config.background.sky.luminance, sky.luminance);
                    setter(this.config.background.sky.mieCoefficient, sky.mieCoefficient);
                    setter(this.config.background.sky.mieDirectionalG, sky.mieDirectionalG);
                    setter(this.config.background.sky.rayleigh, sky.rayleigh);
                    setter(this.config.background.sky.turbidity, sky.turbidity);
                    break;
                case BackgroundMode.EnvMapBackground:
                    const env = parameter.parameter as EnvMapBackgroundParameter;
                    setter(this.config.background.envmap.texture, env.texture);
                    setter(this.config.background.envmap.luma, env.luma);
                    setter(this.config.background.envmap.verticalRotation, env.verticalRotation);
                    setter(this.config.background.envmap.horizonRotation, env.horizonRotation);
                    break;
                default:
                    break;
            }
        }
        this.setBackGroundMode(parameter.mode);
    }
    /**
     * Change the mode of background, and the parameters of the background will be set to default values;
     * @param {BackgroundMode} type A constant of BackgroundMode.
     * @deprecated use `config.background.active` instead.
     */
    setBackGroundMode(type: BackgroundMode) {
        this.config.background.active.set(type);
    }
    /**
     * Apply user's camera to renderer.
     * This only works for 3D scene.
     * `ArrayCamera` is not supported in this function, use Viewport instead.
     * @param {Camera3D | ArrayCamera} camera An instance belongs or extents form Camera.
     * @tips If the user changes the camera's parameter or uses a new camera, the better way is through this function to avoid errors;
     */
    setCamera(camera: Camera3D | ArrayCamera): void {
        if (TypeAssert.isArrayCamera(camera)) {
            logger.error('Viewer.setCamera does not support ArrayCamera, use Viewport instead.');
            return;
        }
        this.defaultViewport.camera = camera;
    }
    /**
     * Get the camera instance of current viewer.
     * This only works for 3D scene.
     */
    getCamera(): Camera3D {
        return this.defaultViewport.camera;
    }

    /**
     * This method will add highlight effect to all objects in the array.
     * @param {HighLightItem[]} objects HighLightItem is an interface which requires a Drawable object and an optional group index of geometry.
     */
    setHighlightObjects(objects: HighLightItem[]): void {
        this.setHighlightGroups([{ items: objects }]);
    }

    setHighlightGroups(groups: HighlightGroup[]): void {
        if (!this.engine) {
            return;
        }
        const highlightGroups: HighlightGroup[] = [];
        for (let i = 0; i < groups.length; i++) {
            const highlightGroup = groups[i];
            const invalidObject = highlightGroup.items.find(o => {
                const geometry = o.object.geometry;
                if (!o.highlightGroupIndex || !TypeAssert.isBufferGeometry(geometry)) {
                    return false;
                }
                return o.highlightGroupIndex.find(v => !geometry.getGroup(v));
            });
            if (invalidObject) {
                logger.invalidInput(`HighlightItem invalid, highlight group index to group is null.`);
                continue;
            }
            highlightGroups.push(highlightGroup);
        }
        this.defaultViewport.pipeline.highlightPlugin.setHighlightGroups(highlightGroups);
        if (this.scene) {
            this.scene.item.notifySceneChange();
        }
        this.requestRender();
    }
    //#endregion
}

/**
 * Runtime statistics collected from viewer rendering.
 */
export class RenderStatistics {
    backend: RendererBackend = RendererBackend.WEBGL2_JS;
    /**
     * The number of WebGL drawcall.
     */
    calls: number = 0;
    /**
     * The number of driven mesh counts.
     */
    drivenDrawcalls: number = 0;
    /**
     * used by frontend custom statistics.
     */
    callsByObjectCategoryId: Map<string, number> = new Map();
    /**
     * used by frontend custom statistics.
     */
    callsBySourceType: Map<string, number> = new Map();
    /**
     * The number of geometry vertices.
     */
    vertices: number = 0;
    /**
     * The number of driven geometry vertices.
     */
    drivenVertices: number = 0;
    /**
     * The number of geometry faces.
     */
    faces: number = 0;
    /**
     * The number of texture.
     */
    textures: number = 0;
    /**
     * The number of BufferGeometry.
     */
    geometries: number = 0;
    /**
     * The number of shader program.
     */
    programs: number = 0;
    /**
     * The number of frame.
     */
    frames: number = 0;
    /**
     * Record some information of refresh.
     */
    counters = new Map<string, number>();
    /**
     * One frame time (CPU + GPU time).
     */
    totalTime: number = 0;
    /**
     * CPU frame time.
     */
    CPUTime: number = 0;
    /**
     * CPU time details.
     */
    timeDetails = new Map<string, number>();
    /**
     * The byte length of geometry attributes
     */
    geometryBufferByteSize = 0;
    /**
     * The byte length of texture
     */
    textureByteSize = 0;
    /**
     * The byte length of UBO
     */
    uboByteSize = 0;
    /**
     * The byte length of FBO
     */
    fboByteSize = 0;
    /**
     * The byte length of storageBuffer
     */
    storageByteSize = 0;
    /**
     * the byte length of storageBuffer used
     */
    storageByteSizeUsed = 0;
}
