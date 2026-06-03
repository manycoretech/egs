import { logger } from '../utils/Logger';
import { type IRenderer, RendererState, type RendererParameters } from '../renderer/IRenderer';
import { ContextLostEvent, ContextLostRestoreFailedEvent, MemoryGrowFailed, type CtxLostInfo } from '../renderer/IRenderer';
import type { Camera3D } from '../scene/cameras/Camera3D';
import type { Scene3D } from '../scene/Scene3D';
import { EventDispatcher, EventType } from '../utils/EventDispatcher';
import type { Size } from '../utils/Utils';
import type { EngineInitializeConfig } from './EngineConfig';
import { SnapshotRenderer as DeprecatedSnapshotRenderer } from '../snapshot/SnapshotRenderer';
import { SnapshotRenderer } from '../snapshot/SnapshotRendererV2';
import { SceneAdaptor } from '../fx/SceneAdaptor';
import { ContentBridge } from '../ContentAPI';
import { ToggleWebGPUEvent, WebGPUUnstable, WebGPUValidationFailed, type ToggleWebWebGpuPayload } from '../Bridge/utils';
import type { RenderingConfig,DrivenCullingConfig } from '../fx/plugins/PipelinePlugin';
import type { PostPipeline } from '../fx/Pipeline';
import type { Vector4 } from '../math/Vector4';
import { Application } from '../Application';
import { globalOverrideDefaultRendererImpl } from '../renderer/RendererOverride';

/**
 * Event emitted when the renderer has been reset
 */
export const ResetRendererEvent = new EventType();
export const RendererInitialized = new EventType<IRenderer>();

export class RenderEngine extends EventDispatcher {
    private _enablePhysicalShading = false;
    get enablePhysicalShading() {
        return this._enablePhysicalShading;
    }
    set enablePhysicalShading(v) {
        ContentBridge.setEnablePhysicalShading(v);
        this._enablePhysicalShading = v;
    }
    renderer: IRenderer;
    config: EngineInitializeConfig;
    forceFrameIsUnstable = false;
    snapshotRenderer: SnapshotRenderer;
    deprecatedSnapshotRenderer: DeprecatedSnapshotRenderer;
    lastRenderedFrameId = -1;
    private isRefreshRenderables = true;    // enable this to skip lazy rendering
    private _renderPixelRatio: number = 1;

    private lastRestoreTimeStamp = 0; // prevent endless lost and restore
    private _countOfFailed = 0;
    private _sumOfTime = 0;
    private _restoreFailed = false;

    private canvasContainer: HTMLElement;
    private canvas: HTMLCanvasElement;
    private requestedSize?: Size;

    constructor(canvasContainer: HTMLElement, config: EngineInitializeConfig) {
        super();
        this.canvasContainer = canvasContainer;
        this.config = config;
        this.resetRenderer();
    }

    get renderParameter(): RendererParameters {
        return {
            name: this.config.name ?? 'unknown',
            version: Application.version,
            canvas: this.canvas,
            container: this.canvasContainer,
            preferWebGL1: this.config.preferWebGL1,
            preserveDrawingBuffer: this.config.preserveDrawingBuffer ?? true,
            antialias: this.config.antialiasing ?? true,
            alpha: this.config.alpha ?? false,
            depth: true,
            stencil: true,
            premultipliedAlpha: false,
            powerPreference: 'high-performance',
        };
    };

    get width() {
        return this.renderer.getSize().width;
    }

    get height() {
        return this.renderer.getSize().height;
    }

    get canvasElement() {
        return this.canvas;
    }

    set renderPixelRatio(value: number) {
        this._renderPixelRatio = value;
        this.renderer.setPixelRatio(getDevicePixelRatio() * this._renderPixelRatio);
        this.resize(this.requestedSize);
    }

    get renderPixelRatio(): number {
        return this._renderPixelRatio;
    }

    refreshRenderables() {
        this.isRefreshRenderables = true;
    }

    private toggleWebgpu = (payload: ToggleWebWebGpuPayload) => {
        this.canvas = payload.canvas;
        this.emit(ToggleWebGPUEvent, payload);
        this.emit(ResetRendererEvent);
    };

    destroy(): void {
        if (this.canvasContainer.contains(this.canvas)) {
            this.canvasContainer.removeChild(this.canvas);
        }
        this.snapshotRenderer.destroy();
        this.deprecatedSnapshotRenderer.destroy();
        this.canvas = null!;
        this.renderer.destroy();
        this.renderer = null!;
        this.clearAllListeners();
    }

    resize(size?: Size): void {
        let width = this.canvasContainer.clientWidth;
        let height = this.canvasContainer.clientHeight;
        if (size) {
            width = size.width;
            height = size.height;
        }
        this.requestedSize = size;
        this.renderer.setSize(width, height);
    }

    render(
        scene: Scene3D,
        camera: Camera3D,
        pipeline: PostPipeline,
        isCameraChange: boolean,
        isCameraStable: boolean,
        renderingConfig: RenderingConfig,
        drivenCullingConfig: DrivenCullingConfig,
        viewport?: Vector4, // x, y, width, height
        frameId: number = -1,
        forceRender: boolean = false,
    ) {
        this.checkRestoreCtx();
        if (this.renderer.rendererStatus.state >= RendererState.ContextLost) {
            return false;
        }

        const isFrameStable = !(scene.isAnythingChanged || isCameraChange || this.isRefreshRenderables || this.forceFrameIsUnstable);
        const adaptor = new SceneAdaptor(scene, camera);
        pipeline.updateEffect(adaptor, isFrameStable, isCameraStable, renderingConfig, drivenCullingConfig);

        const shouldRenderFrame = pipeline.shouldRenderFrame();
        if (!forceRender && isFrameStable && !shouldRenderFrame) {
            return false;
        }

        scene.updateRegistryAndActive(this.renderer, camera);
        if (viewport) {
            this.renderer.setViewport(viewport.x, viewport.y, viewport.z, viewport.w);
            this.renderer.setScissor(viewport.x, viewport.y, viewport.z, viewport.w);
            this.renderer.setScissorTest(true);
        }
        pipeline.render(adaptor, renderingConfig, drivenCullingConfig);
        adaptor.destroy();
        this.lastRenderedFrameId = frameId;

        return pipeline.shouldRenderNextFrame();
    }

    afterRender() {
        this.isRefreshRenderables = false;
    }

    /**
     * @internal
     */
    _unsafeDestroyRenderer() {
        if (this.renderer) {
            this.renderer.destroy(false);
        }
    }

    resetRenderer(canvas?: HTMLCanvasElement, context?: WebGLRenderingContext | WebGL2RenderingContext) {
        const destroyCurrentResource = !canvas || this.canvas !== canvas;
        if (this.renderer) {
            this.renderer.destroy(destroyCurrentResource);
        }

        const renderParameter = this.renderParameter;

        if (destroyCurrentResource) {
            if (this.canvasContainer.contains(this.canvas)) {
                this.canvasContainer.removeChild(this.canvas);
            }

            this.canvas = canvas!;
            if (!this.canvas) {
                this.canvas = document.createElement('canvas');
                this.canvas.tabIndex = 0;
                this.canvas.style.outline = 'none';
                this.canvas.setAttribute('data-engine', `EGS ${renderParameter.version} ${renderParameter.name}`);
            }
            this.canvasContainer.appendChild(this.canvas);
        }

        renderParameter.canvas = this.canvas;
        renderParameter.context = context;

        this.renderer = globalOverrideDefaultRendererImpl(renderParameter);
        this.renderer.on(ToggleWebGPUEvent, this.toggleWebgpu);
        this.renderer.on(ContextLostEvent, this.onCtxLost);
        this.renderer.on(WebGPUUnstable, this.onWebGPUUnstable);
        this.renderer.on(WebGPUValidationFailed, this.onWebGPUValidationFailed);
        this.renderer.once(MemoryGrowFailed, () => this.emit(MemoryGrowFailed));

        this.renderer.setPixelRatio(getDevicePixelRatio() * this._renderPixelRatio);

        if (this.snapshotRenderer) {
            this.snapshotRenderer.onRendererChanged(this.renderer);
        } else {
            this.snapshotRenderer = new SnapshotRenderer(this.renderer);
        }
        if (this.deprecatedSnapshotRenderer) {
            this.deprecatedSnapshotRenderer.onRendererChanged(this.renderer);
        } else {
            this.deprecatedSnapshotRenderer = new DeprecatedSnapshotRenderer(this.renderer);
        }

        this.resize(this.requestedSize);
        this.refreshRenderables();
        this.emit(ResetRendererEvent);
        if (this.renderer.rendererStatus.state === RendererState.Ready) {
            this.emit(RendererInitialized, this.renderer);
        } else if (this.renderer.rendererStatus.state === RendererState.Initializing) {
            this.renderer.rendererStatus.initialized.then(_ => this.emit(RendererInitialized, this.renderer));
        }
    }

    private onCtxLost = (ctxLostInfo: CtxLostInfo) => {
        if (!ctxLostInfo.manual) {
            logger.warn('Context Lost, try restoring \n' + this.renderer.getGPUInfo() + '\n' + JSON.stringify(ctxLostInfo));
        }
        this.emit(ContextLostEvent, ctxLostInfo);
    };

    private onWebGPUUnstable = () => {
        this.emit(WebGPUUnstable);
    };

    private onWebGPUValidationFailed = (frames: number) => {
        this.emit(WebGPUValidationFailed, frames);
    };

    private checkRestoreCtx() {
        if (this.renderer.rendererStatus.state < RendererState.ContextLost || this._restoreFailed) {
            return;
        }

        this._countOfFailed += 1;

        const currentTimeStamp = performance.now();
        const durationFromLast = currentTimeStamp - this.lastRestoreTimeStamp;

        this._sumOfTime += durationFromLast;
        this.lastRestoreTimeStamp = currentTimeStamp;

        if (this._sumOfTime >= 10000) { // 长时间lost频率统计，至少统计10s以上
            if (this._countOfFailed / this._sumOfTime > 0.0004) { // lost频率
                this.emit(ContextLostRestoreFailedEvent);
                this._restoreFailed = true;
                return;
            }
            this._sumOfTime = 0;
            this._countOfFailed = 0;
        } else if (this._countOfFailed > 4) { // 短时间lost次数，10s内已经lost至少5次
            this.emit(ContextLostRestoreFailedEvent);
            this._restoreFailed = true;
            return;
        }

        this.resetRenderer();
    }
}

let _enableDebugFixedDevicePixelRatio = false;
export function enableDebugFixedDevicePixelRatio() {
    _enableDebugFixedDevicePixelRatio = true;
}
export function disableDebugFixedDevicePixelRatio() {
    _enableDebugFixedDevicePixelRatio = false;
}
export function getDevicePixelRatio() {
    if (_enableDebugFixedDevicePixelRatio) {
        return 1;
    }
    return window.devicePixelRatio;
}
