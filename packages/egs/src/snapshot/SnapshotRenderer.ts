import type { Material } from '../elements/materials/Material';
import type { RenderTarget } from '../elements/textures/RenderTarget';
import { PostPipeline } from '../fx/Pipeline';
import { RendererAdaptor } from '../fx/RendererAdaptor';
import { SnapShotAdaptor } from './SnapshotAdaptor';
import { Box3 } from '../math/Box3';
import { Color } from '../math/Color';
import { Vector3 } from '../math/Vector3';
import { type IRenderer, RendererState } from '../renderer/IRenderer';
import { MaterialShadingWithDynamicShapeDispatcher } from '../renderer/MaterialDispatcher';
import type { Camera3D } from '../scene/cameras/Camera3D';
import { OrthographicCamera } from '../scene/cameras/OrthographicCamera';
import type { Object3D } from '../scene/Object3D';
import { Scene3D } from '../scene/Scene3D';
import { DrawableList } from '../scene/tools/DrawcallList';
import type { Layers } from '../scene/tools/Layers';
import { TypeAssert } from '../scene/tools/TypeAssert';
import type { Size, IRange } from '../utils/Utils';
import { RenderMode } from '../engine/EngineConfig';
import type { Drawable } from '../scene/drawables/Drawable';
import { Geometry } from '../elements/geometries/containers/Geometry';
import { BufferGeometry } from '../elements/geometries/containers/BufferGeometry';
import { PipelineContentAPIForRenderingAndFilteringEnabled, PipelineContentBridge } from '../fx/PipelineAPI';
import { ContentBridge } from '../ContentAPI';
import { SnapshotResult, SnapshotResultResultType } from './SnapshotResult';
import { type SnapshotAxisDirection, setupCamera, SnapshotBoxPrecision, createRenderTarget } from './util';
import { type DeprecatedPipelineConfig, createDeprecatedPipelineConfig } from '../fx/PipelineConfig';
import { BackgroundMode } from '../scene/renderables/Background';
import { type RenderingConfig, type DrivenCullingConfig, TextureCompression } from '../fx/plugins/PipelinePlugin';
import { logger } from '../utils/Logger';

export interface SnapshotRenderConfig {
    worldBox?: Box3;
    boxPrecision?: SnapshotBoxPrecision;
}

const snapshotRenderConfigDefault: SnapshotRenderConfig = {
    worldBox: undefined,
    boxPrecision: SnapshotBoxPrecision.BoundingBox,
};

/**
 * This class provide function to get
 */
export class SnapshotRenderer {
    defaultScene = new Scene3D();

    constructor(private renderer: IRenderer) {
        this.onRendererChanged(renderer);
    }
    destroy() {
        this.postPipeline.destroy();
        this.camera.destroy();
        this.defaultScene.destroy();
    }

    private postPipeline: PostPipeline;
    private pipelineConfig: DeprecatedPipelineConfig;

    backgroundColor = new Color();
    backgroundAlpha = 0;
    defaultAdjustMaxSideSize = 500;
    extraPaddingForEffect = 1;
    skipSceneVisible = false;

    private camera = new OrthographicCamera();
    getCamera(): Readonly<OrthographicCamera> {
        return this.camera;
    }

    private effectConfig = {
        mode: RenderMode.SHADING,
        isAOEnabled: false,
        enableBackgroundAndGround: false,
        isDeferredEnabled: false,
        isTaaEnabled: false,
        taaSampleCount: 8,
    };

    private drivenCullingConfig: DrivenCullingConfig = {
        frustumCullingEnabled: false,
        occlusionCullingEnabled: false,
        detailCullingEnabled: false,
        layersCullingEnabled: false,
        triCullingEnabled: false,
        occlusionCullingBias: 0,
    };
    private renderingConfig: RenderingConfig = {
        MSAA: true,
        tlsFlags: 0,
        gpuDriven: {
            enabled: false,
            requested: false,
            textureCompression: TextureCompression.None,
        },
    };

    /**
     * @internal
     */
    onRendererChanged(renderer: IRenderer) {
        if (this.postPipeline) {
            this.postPipeline.updateRenderer(renderer);
            this.postPipeline.resetContentCache();
        } else {
            this.postPipeline = new PostPipeline(new RendererAdaptor(renderer));
            this.pipelineConfig = createDeprecatedPipelineConfig(this.postPipeline, this.renderingConfig);
        }
        this.renderer = renderer;
    }

    /**
     * Set RenderMode and AO effect for snapshot rendering.
     */
    setEffectConfig(
        mode: RenderMode,
        isAOEnabled: boolean = false,
        isDeferredEnabled: boolean = false,
        isHighQuality: boolean = false,
        taaSampleCount: number = 8,
    ) {
        this.effectConfig.mode = mode;
        this.effectConfig.isAOEnabled = isAOEnabled;
        this.effectConfig.isDeferredEnabled = isDeferredEnabled;
        this.effectConfig.isTaaEnabled = isHighQuality;
        this.effectConfig.taaSampleCount = taaSampleCount;
    }

    private updatePipelineParam(adaptor: SnapShotAdaptor) {
        const pipeline = this.postPipeline;
        const { mode, isAOEnabled, isDeferredEnabled, isTaaEnabled, taaSampleCount } = this.effectConfig;
        this.pipelineConfig.deferred.enabled.set(isDeferredEnabled);
        this.pipelineConfig.deferred.autoExposedEnabled.set(isDeferredEnabled);
        this.pipelineConfig.renderMode.type.set(mode);
        this.pipelineConfig.ao.enabled.set(isAOEnabled);
        this.pipelineConfig.taa.enabled.set(isTaaEnabled);
        this.pipelineConfig.taa.maxSample.set(taaSampleCount);
        this.pipelineConfig.__INTERNAL__.Background.ground.enabled.set(false);
        this.pipelineConfig.__INTERNAL__.Background.background.active.set(BackgroundMode.BasicBackground);
        this.pipelineConfig.__INTERNAL__.Background.background.basic.color.set(this.backgroundColor);
        this.pipelineConfig.__INTERNAL__.Background.background.basic.alpha.set(this.backgroundAlpha);

        pipeline.updateEffect(adaptor, true, true, this.renderingConfig, this.drivenCullingConfig);
        pipeline.resetContentCache();
    }

    setCameraLayer(layers: Layers) {
        this.camera.layers.copy(layers);
    }
    /**
     * A function to define the width and height of snapshot.
     */
    resolutionAdjustor = (size: Size) => {
        const max = this.defaultAdjustMaxSideSize;
        const sizeMax = Math.max(size.width, size.height);
        if (sizeMax > max) {
            const ratio = max / sizeMax;
            return {
                width: size.width * ratio,
                height: size.height * ratio,
            };
        } else {
            return {
                width: size.width,
                height: size.height,
            };
        }
    };
    /**
     * Render the objects in specified scene except other objects.
     * @param object
     * @param direction set the camera facing direction.
     * @param generate
     * @param extraPadding
     * @param config
     */
    private renderImpl<T extends SnapshotResult | Promise<SnapshotResult>>(
        object: Object3D,
        direction: SnapshotAxisDirection,
        generate: (
            resolution: { width: number; height: number },
            objectsToRender: DrawableList,
            box: Box3,
            camera: Camera3D,
        ) => T,
        extraPadding: number,
        config?: SnapshotRenderConfig,
    ): T {
        config = Object.assign({}, snapshotRenderConfigDefault, config);

        const worldBox = new Box3();
        const objectsToRender = new DrawableList();
        objectsToRender.lodEnabled = false;

        let unionDrawable: (worldBox: Box3, drawable: Drawable) => void | undefined;

        if (config.worldBox) {
            worldBox.copy(config.worldBox);
        } else if (config.boxPrecision === SnapshotBoxPrecision.Vertex) {
            const v = new Vector3();
            unionDrawable = (box, node) => {
                const geometry = node.geometry;
                if (geometry !== undefined) {
                    if (geometry instanceof Geometry) {
                        const vertices = geometry.vertices;
                        for (const vertice of vertices) {
                            v.copy(vertice);
                            v.applyMatrix4(node.matrixWorld);
                            if (!isNaN(v.x) && !isNaN(v.y) && !isNaN(v.z)) {
                                box.expandByPoint(v);
                            }
                        }
                    } else if (geometry instanceof BufferGeometry) {
                        const attribute = geometry.attributes.position;
                        if (attribute !== undefined) {
                            for (let i = 0; i < attribute.count; i++) {
                                v.fromBufferAttribute(attribute, i).applyMatrix4(node.matrixWorld);
                                if (!isNaN(v.x) && !isNaN(v.y) && !isNaN(v.z)) {
                                    box.expandByPoint(v);
                                }
                            }
                        }
                    }
                }
            };
        } else if (config.boxPrecision === SnapshotBoxPrecision.BoundingBox) {
            unionDrawable = (box, drawable) => {
                // drawable.updateBoundings(); //updated before calling union Drawable
                box.unionSafe(drawable.worldBoundingBox);
            };
        }

        ContentBridge.sceneNodeUpdate(object);
        object.updateWorldMatrix(true, true);

        object.traverse(o => {
            if (o.parent) {
                o.netVisibility = o.visible && o.parent.netVisibility;
            } else {
                o.netVisibility = o.visible;
            }
            if (TypeAssert.isDrawable(o) && (this.skipSceneVisible || o.netVisibility)) {
                objectsToRender.push(o);

                if (unionDrawable) {
                    if (TypeAssert.isInstanceMesh(o)) {
                        o.updateRenderEntity();
                    } else {
                        o.updateBoundings();
                    }
                    if (!worldBox.containsBox(o.worldBoundingBox)) {
                        // test bounding box early to save vertex calc
                        unionDrawable(worldBox, o);
                    }
                }
            }
        });
        if (worldBox.isEmpty()) {
            return SnapshotResult.exception(SnapshotResultResultType.Empty) as T;
        }

        if (PipelineContentAPIForRenderingAndFilteringEnabled()) {
            // setup for wasm
            PipelineContentBridge.prepareTempRenderList([object]);
            PipelineContentBridge.drawableListCreate(objectsToRender);
        }

        const size = setupCamera(this.camera, worldBox, direction);
        const resolutionRaw = this.resolutionAdjustor(size);

        // we should padding base on real resized output
        // ratio is how much physical unit to match one output pixel unit
        const sizeRatioX = size.width / resolutionRaw.width;
        const sizeRatioY = size.height / resolutionRaw.height;

        const cameraPaddingX = extraPadding * sizeRatioX;
        const cameraPaddingY = extraPadding * sizeRatioY;

        this.camera.left -= cameraPaddingX;
        this.camera.right += cameraPaddingX;
        this.camera.top += cameraPaddingY;
        this.camera.bottom -= cameraPaddingY;

        const resolution = {
            width: Math.ceil(resolutionRaw.width),
            height: Math.ceil(resolutionRaw.height),
        };
        try {
            return generate(resolution, objectsToRender, worldBox, this.camera);
        } catch (error) {
            return SnapshotResult.exception(SnapshotResultResultType.Error, error) as T;
        } finally {
            PipelineContentBridge.cleanupTempRenderList([object]);
            const adaptor = this.postPipeline.adaptor.adaptor;
            // reset cached items, magic null!!!
            this.postPipeline.adaptor.setAdaptor(null as any);
            adaptor?.destroy();
        }
    }

    private renderInner<T extends SnapshotResult | Promise<SnapshotResult>>(
        createResult: (renderer: IRenderer, target: RenderTarget, range: IRange, box: Box3, camera: Camera3D) => T,
        object: Object3D,
        direction: SnapshotAxisDirection,
        scene?: Scene3D,
        config?: SnapshotRenderConfig,
    ) {
        const needExtraPadding = this.effectConfig.mode !== RenderMode.SHADING;
        return this.renderImpl(
            object,
            direction,
            (resolution, objectsToRender, box, camera) => {
                const renderer = this.renderer;

                let activeScene: Scene3D;
                if (scene) {
                    activeScene = scene;
                } else if (object.scene) {
                    activeScene = object.scene;
                } else {
                    activeScene = this.defaultScene;
                }
                activeScene.update();
                activeScene.updateRegistryAndActive(renderer, this.camera);

                if (PipelineContentAPIForRenderingAndFilteringEnabled()) {
                    PipelineContentBridge.drawableListUpdateSceneAndUse(objectsToRender, activeScene);
                }

                const target = createRenderTarget(resolution.width, resolution.height, this.renderer);
                const adaptor = new SnapShotAdaptor(this.camera, objectsToRender, activeScene);
                this.updatePipelineParam(adaptor);
                this.postPipeline.setFrameSize(resolution.width, resolution.height);

                renderer.setRenderTarget(target);
                renderer.setClearColor(this.backgroundColor, this.backgroundAlpha);
                renderer.clear();

                const snapshotCounts = this.effectConfig.isTaaEnabled ? this.effectConfig.taaSampleCount : 1;
                for (let i = 0; i < snapshotCounts; i++) {
                    this.postPipeline.renderSnapshot(
                        adaptor,
                        { target },
                        this.renderingConfig,
                        this.drivenCullingConfig,
                    );
                }

                return createResult(
                    this.renderer,
                    target,
                    { x: 0, y: 0, width: resolution.width, height: resolution.height },
                    box,
                    camera,
                );
            },
            needExtraPadding ? this.extraPaddingForEffect : 0,
            config,
        );
    }

    private renderWithOverrideMaterialImpl<T extends SnapshotResult | Promise<SnapshotResult>>(
        createResult: (renderer: IRenderer, target: RenderTarget, range: IRange, box: Box3, camera: Camera3D) => T,
        object: Object3D,
        direction: SnapshotAxisDirection,
        material: Material,
        config?: SnapshotRenderConfig,
    ): T {
        return this.renderImpl(
            object,
            direction,
            (resolution, objectsToRender, box, camera) => {
                const target = createRenderTarget(resolution.width, resolution.height, this.renderer);

                this.renderer.setRenderTarget(target);
                this.renderer.setClearColor(this.backgroundColor, this.backgroundAlpha);
                this.renderer.clear();
                this.renderer.overrideDispatcher = new MaterialShadingWithDynamicShapeDispatcher(material);
                this.renderer.overrideDispatcher.update();
                this.renderer.beginPass(true, true, false, false);
                this.renderer.renderRenderable(objectsToRender.project(this.camera));
                this.renderer.endPass();
                this.renderer.flushCommands?.();
                this.renderer.overrideDispatcher = null;

                return createResult(
                    this.renderer,
                    target,
                    { x: 0, y: 0, width: resolution.width, height: resolution.height },
                    box,
                    camera,
                );
            },
            0,
            config,
        );
    }

    /**
     * @deprecated use `renderWithOverrideMaterialAsync` instead, sync function will unavailable in webgpu version
     */
    renderWithOverrideMaterial(
        object: Object3D,
        direction: SnapshotAxisDirection,
        material: Material,
        config?: SnapshotRenderConfig,
    ): SnapshotResult {
        logger.error(
            'SnapshotRenderer.renderWithOverrideMaterial is deprecated, use renderWithOverrideMaterialAsync instead.',
        );
        return this.renderWithOverrideMaterialImpl(
            (renderer, target, range, box, camera) => {
                const resultBuffer = this.readPixels(renderer, target, range);
                return new SnapshotResult(
                    resultBuffer,
                    {
                        height: range.height,
                        width: range.width,
                    },
                    {
                        projectionMatrix: camera.projectionMatrix.clone(),
                        worldMatrix: camera.matrixWorld.clone(),
                    },
                    box,
                );
            },
            object,
            direction,
            material,
            config,
        );
    }

    async renderWithOverrideMaterialAsync(
        object: Object3D,
        direction: SnapshotAxisDirection,
        material: Material,
        config?: SnapshotRenderConfig,
    ): Promise<SnapshotResult> {
        if (this.renderer.rendererStatus.state === RendererState.Initializing) {
            await this.renderer.rendererStatus.initialized;
        }

        return this.renderWithOverrideMaterialImpl(
            async (renderer, target, range, box, camera) => {
                const resultBuffer = await this.readPixelsAsync(renderer, target, range);
                return new SnapshotResult(
                    resultBuffer,
                    {
                        height: range.height,
                        width: range.width,
                    },
                    {
                        projectionMatrix: camera.projectionMatrix.clone(),
                        worldMatrix: camera.matrixWorld.clone(),
                    },
                    box,
                );
            },
            object,
            direction,
            material,
            config,
        );
    }

    /**
     * @deprecated use `renderAsync` instead, sync function will unavailable in webgpu version
     */
    render(
        object: Object3D,
        direction: SnapshotAxisDirection,
        scene?: Scene3D,
        config?: SnapshotRenderConfig,
    ): SnapshotResult {
        logger.error('SnapshotRenderer.render is deprecated, use renderAsync instead.');
        let userScene: Scene3D | undefined = scene;
        const enableBackup = new Map();
        let intensityBackup = 0.6;
        if (userScene === undefined) {
            userScene = object.scene ?? undefined;
        }
        if (userScene) {
            userScene.lights.forEach(l => {
                enableBackup.set(l, l.enabled);
                if (l.className() === 'DirectionalLight' || l.className() === 'AmbientLight') {
                    l.enabled = true;
                    if (l.className() === 'AmbientLight') {
                        intensityBackup = l.intensity;
                        l.intensity = 0.6;
                    }
                } else {
                    l.enabled = false;
                }
            });
        }

        const result = this.renderInner(
            (renderer: IRenderer, target: RenderTarget, range: IRange, box: Box3, camera) => {
                const resultBuffer = this.readPixels(renderer, target, range);
                return new SnapshotResult(
                    resultBuffer,
                    {
                        height: range.height,
                        width: range.width,
                    },
                    {
                        projectionMatrix: camera.projectionMatrix.clone(),
                        worldMatrix: camera.matrixWorld.clone(),
                    },
                    box,
                );
            },
            object,
            direction,
            scene,
            config,
        );

        if (userScene) {
            userScene.lights.forEach(l => {
                if (enableBackup.get(l) !== undefined) {
                    l.enabled = enableBackup.get(l);
                }
                if (l.className() === 'AmbientLight') {
                    l.intensity = intensityBackup;
                }
            });
        }

        return result;
    }

    async renderAsync(
        object: Object3D,
        direction: SnapshotAxisDirection,
        scene?: Scene3D,
        config?: SnapshotRenderConfig,
    ): Promise<SnapshotResult> {
        if (this.renderer.rendererStatus.state === RendererState.Initializing) {
            await this.renderer.rendererStatus.initialized;
        }

        let userScene: Scene3D | undefined = scene;
        const enableBackup = new Map();
        let intensityBackup = 0.6;
        if (userScene === undefined) {
            userScene = object.scene ?? undefined;
        }
        if (userScene) {
            userScene.lights.forEach(l => {
                enableBackup.set(l, l.enabled);
                if (l.className() === 'DirectionalLight' || l.className() === 'AmbientLight') {
                    l.enabled = true;
                    if (l.className() === 'AmbientLight') {
                        intensityBackup = l.intensity;
                        l.intensity = 0.6;
                    }
                } else {
                    l.enabled = false;
                }
            });
        }
        // render is sync, we don't need to wait it.
        const result = this.renderInner(
            async (renderer: IRenderer, target: RenderTarget, range: IRange, box: Box3, camera) => {
                const resultBuffer = await this.readPixelsAsync(renderer, target, range);
                return new SnapshotResult(
                    resultBuffer,
                    {
                        height: range.height,
                        width: range.width,
                    },
                    {
                        projectionMatrix: camera.projectionMatrix.clone(),
                        worldMatrix: camera.matrixWorld.clone(),
                    },
                    box,
                );
            },
            object,
            direction,
            scene,
            config,
        );

        if (userScene) {
            userScene.lights.forEach(l => {
                if (enableBackup.get(l) !== undefined) {
                    l.enabled = enableBackup.get(l);
                }
                if (l.className() === 'AmbientLight') {
                    l.intensity = intensityBackup;
                }
            });
        }

        return result;
    }

    private renderCustomViewImpl<T extends SnapshotResult | Promise<SnapshotResult>>(
        createResult: (target: RenderTarget) => T,
        object: Object3D | Object3D[],
        camera: Camera3D,
        resolution: Size,
    ): T {
        const objects = Array.isArray(object) ? object : [object];
        let scene: Scene3D;
        if (objects[0]?.scene) {
            scene = objects[0].scene;
            objects[0].scene.updateRegistryAndActive(this.renderer, camera);
        } else {
            scene = this.defaultScene;
            this.defaultScene.updateRegistryAndActive(this.renderer, camera);
        }
        scene.update();

        const objectsToRender = new DrawableList();
        objectsToRender.lodEnabled = false;
        for (let i = 0; i < objects.length; i++) {
            const ob = objects[i];
            ContentBridge.sceneNodeUpdate(ob);
            ob.updateWorldMatrix(true, true);

            ob.traverse(o => {
                if (o.parent) {
                    o.netVisibility = o.visible && o.parent.netVisibility;
                } else {
                    o.netVisibility = o.visible;
                }
                if (TypeAssert.isDrawable(o) && o.netVisibility) {
                    objectsToRender.push(o);
                }
            });
        }

        try {
            const target = createRenderTarget(resolution.width, resolution.height, this.renderer);

            if (PipelineContentAPIForRenderingAndFilteringEnabled()) {
                PipelineContentBridge.prepareTempRenderList(objects);
                PipelineContentBridge.drawableListCreate(objectsToRender);
                PipelineContentBridge.drawableListUpdateSceneAndUse(objectsToRender, scene);
            }

            const adaptor = new SnapShotAdaptor(camera, objectsToRender, scene);
            this.updatePipelineParam(adaptor);
            this.postPipeline.setFrameSize(resolution.width, resolution.height);
            const renderer = this.renderer;

            renderer.setRenderTarget(target);
            renderer.setClearColor(this.backgroundColor, this.backgroundAlpha);
            renderer.clear();

            const snapshotCounts = this.effectConfig.isTaaEnabled ? this.effectConfig.taaSampleCount : 1;
            for (let i = 0; i < snapshotCounts; i++) {
                this.postPipeline.renderSnapshot(adaptor, { target }, this.renderingConfig, this.drivenCullingConfig);
            }

            return createResult(target);
        } catch (error) {
            return SnapshotResult.exception(SnapshotResultResultType.Error, error) as T;
        } finally {
            PipelineContentBridge.cleanupTempRenderList(objects);
            const adaptor = this.postPipeline.adaptor.adaptor;
            // reset cached items, magic null!!!
            this.postPipeline.adaptor.setAdaptor(null as any);
            adaptor?.destroy();
        }
    }

    /**
     * @deprecated use `renderCustomViewAsync` instead, sync function will unavailable in webgpu version
     */
    renderCustomView(object: Object3D | Object3D[], camera: Camera3D, resolution: Size): SnapshotResult {
        logger.error('SnapshotRenderer.renderCustomView is deprecated, use renderCustomViewAsync instead.');
        return this.renderCustomViewImpl(
            target => {
                const resultBuffer = this.readPixels(this.renderer, target, {
                    x: 0,
                    y: 0,
                    width: resolution.width,
                    height: resolution.height,
                });
                return new SnapshotResult(resultBuffer, resolution, {
                    projectionMatrix: camera.projectionMatrix.clone(),
                    worldMatrix: camera.matrixWorld.clone(),
                });
            },
            object,
            camera,
            resolution,
        );
    }

    async renderCustomViewAsync(
        object: Object3D | Object3D[],
        camera: Camera3D,
        resolution: Size,
    ): Promise<SnapshotResult> {
        if (this.renderer.rendererStatus.state === RendererState.Initializing) {
            await this.renderer.rendererStatus.initialized;
        }

        return this.renderCustomViewImpl(
            async target => {
                const resultBuffer = await this.readPixelsAsync(this.renderer, target, {
                    x: 0,
                    y: 0,
                    width: resolution.width,
                    height: resolution.height,
                });
                return new SnapshotResult(resultBuffer, resolution, {
                    projectionMatrix: camera.projectionMatrix.clone(),
                    worldMatrix: camera.matrixWorld.clone(),
                });
            },
            object,
            camera,
            resolution,
        );
    }

    private readPixels(renderer: IRenderer, target: RenderTarget, range: IRange): Uint8Array {
        const resultBuffer = new Uint8Array(range.width * range.height * 4);
        renderer.readPixels(target, range, resultBuffer);
        return resultBuffer;
    }

    private async readPixelsAsync(renderer: IRenderer, target: RenderTarget, range: IRange): Promise<Uint8Array> {
        const resultBuffer = new Uint8Array(range.width * range.height * 4);
        await renderer.readPixelsAsync(target, range, resultBuffer);
        return resultBuffer;
    }
}
