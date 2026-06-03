import { type ViewerConfig, createViewConfig, listenViewerConfigChange } from './engine/EngineConfig';
import type { RenderEngine } from './engine/RenderEngine';
import type { Scene3D } from './scene/Scene3D';
import type { Camera3D } from './scene/cameras/Camera3D';
import { CameraWatcher, CameraChangeEvent, CameraEndChangeEvent, CameraStartChangeEvent } from './scene/tools/CameraWatcher';
import type { RequestRenderHandler, Viewer } from './Viewer';
import { TypeAssert } from './scene/tools/TypeAssert';
import { logger, sendKtrackerEvent } from './utils/Logger';
import type { HighlightGroup } from './fx/plugins/Highlight';
import { PostPipeline } from './fx/Pipeline';
import { RendererAdaptor } from './fx/RendererAdaptor';
import type { Size,IRange } from './utils/Utils';
import { PerspectiveCamera } from './scene/cameras/PerspectiveCamera';
import { Vector4 } from './math/Vector4';
import { ContentBridge } from './ContentAPI';
import { COMPOSITE_TARGET_NAME } from './fx/plugins/Composite';
import { SnapshotResult } from './snapshot/SnapshotResult';
import type { DrivenCullingConfig } from './fx/plugins/PipelinePlugin';

/**
 * Named rendering viewport managed by a viewer.
 */
export class Viewport {
    readonly name: string;
    private isDestroyed = false;
    private viewer: Viewer;
    private engine: RenderEngine;
    /**
     * @internal
     */
    pipeline: PostPipeline;
    /**
     * @internal
     */
    viewIndex: number;
    /**
     * @internal
     */
    drivenCullingConfig: DrivenCullingConfig = {
        frustumCullingEnabled: true,
        occlusionCullingEnabled: true,
        detailCullingEnabled: true,
        layersCullingEnabled: true,
        triCullingEnabled: true,
        occlusionCullingBias: 0,
    };

    private _config: ViewerConfig;
    get config() {
        return this._config;
    }

    /**
     * @internal
     */
    scene: Scene3D;

    private isCameraChange = true;
    private isCameraStable = false;
    private cameraObserver = new CameraWatcher();
    private _camera: Camera3D;
    get camera() {
        return this._camera;
    }
    set camera(camera: Camera3D) {
        if (this._camera === camera) {
            return;
        }
        this.cameraObserver.setCamera(camera);
        this._camera = camera;
        this.isCameraChange = true;
        this.isCameraStable = false;
        this.requestRender();
    }

    /**
     * @internal
     */
    requestRenderHandler?: RequestRenderHandler;
    private requestRender = () => this.requestRenderHandler?.();

    layer: number = 0;

    private _bound: Vector4 = new Vector4(0, 0, 1, 1); // x, y, w, h, [0, 1]
    get bound() {
        return this._bound;
    }
    set bound(v) {
        if (this._bound.equals(v)) {
            return;
        }
        this._bound = v;
        this.pipeline.compositePlugin.bound = this._bound;
        this.resize(this.size);
    }

    constructor(name: string, viewer: Viewer, engine: RenderEngine, scene: Scene3D, viewIndex: number, bound?: Vector4) {
        this.name = name;
        this.scene = scene;
        this.engine = engine;
        this.viewer = viewer;
        this.viewIndex = viewIndex;
        this.pipeline = new PostPipeline(new RendererAdaptor(this.engine.renderer));
        this._config = createViewConfig(this.viewer, this.engine, this.pipeline, this.drivenCullingConfig, this.updateTlsFlag);
        listenViewerConfigChange(
            this._config,
            (o, c) => this.isDestroyed || (c?.equals ? c.equals(o) : (o === c)),
            (path, v) => {
                this.engine.refreshRenderables();
                this.requestRender();
                if (typeof v === 'boolean') {
                    sendKtrackerEvent({
                        eventType: `egs_config_update`,
                        data: { v: 1 },
                        labels: { path: `${path}_${v}` },
                    });
                }
            },
        );

        this.resize({ width: this.engine.width, height: this.engine.height });
        if (bound) {
            this.bound = bound;
        }

        this.cameraObserver.on(CameraChangeEvent, () => {
            this.isCameraChange = true;
            this.requestRender();
        });
        this.cameraObserver.on(CameraStartChangeEvent, () => {
            this.isCameraStable = false;
        });
        this.cameraObserver.on(CameraEndChangeEvent, () => {
            this.isCameraStable = true;
            this.requestRender();
        });

        this.camera = new PerspectiveCamera(60, undefined, 100, 1000000);
    }

    private size: Size;
    private viewBound: Vector4;

    private updateTlsFlag = (value: boolean) => {
        const flag = 1 << this.viewIndex;
        this.viewer.renderingConfig.tlsFlags = value ? this.viewer.renderingConfig.tlsFlags | flag :
            this.viewer.renderingConfig.tlsFlags & ~flag;
    };

    /**
     * @internal
     */
    resize(size: Size) {
        this.size = size;
        this.viewBound = new Vector4(
            this.bound.x * size.width,
            this.bound.y * size.height,
            this.bound.z * size.width,
            this.bound.w * size.height,
        ).round();
        this.pipeline.setFrameSize(this.viewBound.z, this.viewBound.w);
    };

    /**
     * @internal
     */
    updateRenderer() {
        this.pipeline.updateRenderer(this.engine.renderer);
        this.resetPipelineCache();
    }

    /**
     * @internal
     */
    resetPipelineCache() {
        this.pipeline.resetContentCache();
        this.pipeline.taaPlugin.resetSample();
    }

    /**
     * @internal
     */
    render(
        frameId: number,
        forceRender: boolean = false,
        isPerformanceSlow: boolean = false,
    ) {
        const { camera, pipeline } = this;
        camera.updateMatrixWorld();
        camera.culler.update(camera);
        ContentBridge.sceneNodeUpdate(camera);

        this.pipeline.isPerformanceSlow = isPerformanceSlow;
        this.pipeline.sceneClipPlugin.setSceneClip(this.scene);
        const compositeEnabled = this.pipeline.compositePlugin.enabled;

        // disable occlusion culling for orthographic camera
        const occlusionCullingEnabled = this.drivenCullingConfig.occlusionCullingEnabled;
        if (TypeAssert.isOrthographicCamera(this.camera)) {
            this.drivenCullingConfig.occlusionCullingEnabled = false;
        }

        const shouldContinue = this.engine.render(
            this.scene,
            camera,
            pipeline,
            this.isCameraChange,
            this.isCameraStable,
            this.viewer.renderingConfig,
            this.drivenCullingConfig,
            compositeEnabled ? undefined : this.viewBound,
            frameId,
            forceRender,
        );
        // restore override config.
        this.drivenCullingConfig.occlusionCullingEnabled = occlusionCullingEnabled;
        this.isCameraChange = false;
        pipeline.sceneClipPlugin.restoreSceneClip(this.scene);

        return shouldContinue;
    }

    setHighlightGroups(groups: HighlightGroup[]): void {
        if (this.isDestroyed) {
            return;
        }
        const result: HighlightGroup[] = [];
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
            result.push(highlightGroup);
        }
        this.pipeline.highlightPlugin.setHighlightGroups(result);
        this.pipeline.compositePlugin.notifyChanged();
        this.viewer.forceNextFrameRender = true;
        this.requestRender();
    }

    snapshotRenderResult(range?: IRange): Promise<SnapshotResult> | undefined {
        if (this.isDestroyed) {
            return;
        }
        const target = this.pipeline._getEffectComposer()._getFrameBuffer(COMPOSITE_TARGET_NAME)!;
        if (!target) {
            logger.invalidInput('readRenderBuffer need enable composite pipeline.');
            return;
        }

        if (!range) {
            range = {
                x: 0,
                y: 0,
                width: target.width,
                height: target.height
            };
        }

        const buffer = new Uint8Array(range.width * range.height * 4);
        const projectionMatrix = this.camera.projectionMatrix.clone();
        const worldMatrix = this.camera.matrixWorld.clone();
        return this.engine.renderer.readPixelsAsync(target, range, buffer).then(() => new SnapshotResult(buffer, { width: range!.width, height: range!.height }, { worldMatrix, projectionMatrix }));
    }

    destroy() {
        if (this.isDestroyed) {
            return;
        }
        this.isDestroyed = true;
        this.viewer.removeViewport(this);
        this.engine = undefined!;
        this.scene = undefined!;
        this.viewer = undefined!;
        this.camera.destroy();
        this.cameraObserver.dispose();
        this.requestRenderHandler = undefined;
    }
}
