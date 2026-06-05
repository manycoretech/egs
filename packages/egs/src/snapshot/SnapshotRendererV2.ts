import { deferred } from '@qunhe/egs-lib';
import type { Object3D } from '../scene/Object3D';
import { SnapshotResult, SnapshotResultResultType } from './SnapshotResult';
import type { Camera3D } from '../scene/cameras/Camera3D';
import { type SnapshotAxisDirection, SnapshotBoxPrecision, setupCamera, createRenderTarget } from './util';
import { RenderMode, type ConfigCellImpl } from '../engine/EngineConfig';
import type { Light } from '../scene/lights/Light';
import { Box3 } from '../math/Box3';
import type { Size } from '../utils/Utils';
import type { Material } from '../elements/materials/Material';
import { type IRenderer, RendererBackend, RendererState } from '../renderer/IRenderer';
import type { RenderTarget } from '../elements/textures/RenderTarget';
import { OrthographicCamera } from '../scene/cameras/OrthographicCamera';
import { Scene3D } from '../scene/Scene3D';
import { PostPipeline } from '../fx/Pipeline';
import { TypeAssert } from '../scene/tools/TypeAssert';
import { ContentBridge } from '../ContentAPI';
import { DrawableList } from '../scene/tools/DrawcallList';
import type { Drawable } from '../scene/drawables/Drawable';
import { Vector3 } from '../math/Vector3';
import { PipelineContentAPIForRenderingAndFilteringEnabled, PipelineContentBridge } from '../fx/PipelineAPI';
import { SnapShotAdaptor } from './SnapshotAdaptor';
import { RendererAdaptor } from '../fx/RendererAdaptor';
import { MaterialShadingWithDynamicShapeDispatcher } from '../renderer/MaterialDispatcher';
import { logger } from '../utils/Logger';
import { DirectionalLight } from '../scene/lights/DirectionalLight';
import { AmbientLight } from '../scene/lights/AmbientLight';
import { type PipelineConfig, createPipelineConfig } from '../fx/PipelineConfig';
import { DownsampleMaterial } from '../elements/materials/quad/DownsampleMaterial';
import { Quad } from '../scene/renderables/Quad';
import type { RenderAttachment } from '../elements/textures/RenderTarget';
import { MixColorAndDepthMaterial } from '../elements/materials/quad/CopyMaterial';
import { DepthPackingStrategies, MeshDepthMaterial } from '../elements/materials/mesh/MeshDepthMaterial';
import { Blending, SamplerFilter } from '../utils/Constants';
import { BackgroundMode } from '../scene/renderables/Background';
import { Color } from '../math/Color';
import { type RenderingConfig, type DrivenCullingConfig, TextureCompression } from '../fx/plugins/PipelinePlugin';
import { FilterTarget } from '../elements/materials/quad/FilterMaterial';
import { SplatSortedEvent, type Splat } from '../scene/splat/Splat';

type IPipelineConfig = ConfigCellImpl<Omit<PipelineConfig, 'SceneClip' | 'ShadowMap' | 'Composite' | 'Debug'>> & {
    Stylize?: {
        /**
         * @deprecated use target instead
         */
        applyToBackgroundAndGround?: boolean;
    };
};

function getPipelineConfigObject(config: PipelineConfig, result: IPipelineConfig = {}): IPipelineConfig {
    for (const k in config) {
        const c = (config as any)[k];
        if (typeof c.get === 'function') {
            (result as any)[k] = c.get();
        } else if (typeof c === 'object') {
            getPipelineConfigObject(c, ((result as any)[k] = {}));
        } else {
            throw new Error('value type invalid');
        }
    }
    return result;
}

function setPipelineConfig(pipeline: PipelineConfig, configs: IPipelineConfig[]): boolean {
    let isChanged: boolean = false;
    function setter(pipeline: any, configs: any) {
        for (const k in pipeline) {
            const config = pipeline[k];
            if (typeof config.get === 'function') {
                const current = config.get();
                const value = configs.find((v: any) => v[k] !== undefined)?.[k];
                const isEqual = current?.equals ? current.equals(value) : current === value;
                if (!isEqual) {
                    isChanged = true;
                    config.set(value);
                }
            } else if (typeof config === 'object') {
                const newConfigs = configs.map((v: any) => v[k]).filter((v: any) => v !== undefined);
                if (newConfigs.length) {
                    setter(config, newConfigs);
                }
            } else {
                throw new Error('value type invalid');
            }
        }
    }
    setter(pipeline, configs);
    return isChanged;
}

interface RenderConfig {
    mode: RenderMode;
    deferred: boolean;
    ao: boolean;
    antialias: 'ssaa' | 'msaa' | 'taa' | 'disable';
    outline: 'default';
    resolutionRatio: number;
    physicalSizeRatio: number;

    background: [number, number];
    light: 'default' | 'scene' | Light[];
    overrideMaterial: Material | undefined;
    ignoreVisible: boolean;
    maxRenderSize: number;
    calcRenderSizeType: 'default' | 'pixel';
    autoPOT: boolean;

    combineDepthAlpha: boolean;
    overrideOutputSize: Size | undefined;

    pipelineConfig: IPipelineConfig;
}

interface DirectionCameraCustom {
    type: SnapshotAxisDirection;
    layer?: number;
    worldBox?: Box3;
    boxPrecision?: SnapshotBoxPrecision;
}

interface CustomCamera {
    type: Camera3D;
    size: Size;
}

interface SnapshotCtx {
    drawableList: DrawableList;
    scene: Scene3D;
    camera: Camera3D;
    size: Size;
    freeables: RenderTarget[];
}

/**
 * Preset snapshot renderer configurations.
 */
export enum PresetRenderConfig {
    Default = 'default',
    Tool_2D = 'tool_2d', // only use in bim or yunDesign tool 2d view
    Tool_2D_Depth = 'tool_2d_depth',
}

const DEFAULT_RENDER_CONFIG: RenderConfig = {
    mode: RenderMode.SHADING,
    background: [0xffffff, 0],
    light: 'default',
    outline: 'default',
    antialias: 'disable',
    resolutionRatio: 1,
    physicalSizeRatio: 1,
    ao: false,
    deferred: false,
    overrideMaterial: undefined,
    ignoreVisible: false,
    maxRenderSize: 512,
    calcRenderSizeType: 'default',
    autoPOT: false,
    combineDepthAlpha: false,
    overrideOutputSize: undefined,
    pipelineConfig: {},
};

function getPresetRenderConfig(preset: PresetRenderConfig): Partial<RenderConfig> {
    switch (preset) {
        case PresetRenderConfig.Default:
            return {};
        case PresetRenderConfig.Tool_2D:
            return { physicalSizeRatio: 0.15, antialias: 'ssaa', resolutionRatio: 2, maxRenderSize: 256 };
        case PresetRenderConfig.Tool_2D_Depth:
            return {
                background: [0, 0],
                combineDepthAlpha: true,
                physicalSizeRatio: 0.15,
                antialias: 'ssaa',
                resolutionRatio: 2,
                maxRenderSize: 256,
            };
    }
}

export class SnapshotRenderer {
    private DEFAULT_PIPELINE_CONFIG: IPipelineConfig;

    private renderer: IRenderer;
    private pipeline: PostPipeline;
    private pipelineConfig: PipelineConfig;
    private defaultScene = new Scene3D();
    private defaultCamera = new OrthographicCamera();
    private defaultLights: Light[];
    private renderConfig: RenderConfig = Object.assign({}, DEFAULT_RENDER_CONFIG);
    private isDestroy: boolean = false;
    private isAdvancedBackend = false;

    private quadDrawer = new Quad();
    private downsample = new DownsampleMaterial();
    private downsampleDepth = new DownsampleMaterial();
    private mixColorDepth = new MixColorAndDepthMaterial();
    private depthMaterial = new MeshDepthMaterial();

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

    constructor(renderer: IRenderer) {
        this.onRendererChanged(renderer);
        const al = new AmbientLight(0xffffff, 0.67);
        const dl0 = new DirectionalLight(0xffffff, 0.2);
        dl0.position = new Vector3(6526, 5750, 14940);
        dl0.lookAt(new Vector3(0, 0, 0));
        const dl1 = new DirectionalLight(0xffffff, 0.22);
        dl1.position = new Vector3(8804, -579, 741);
        dl1.lookAt(new Vector3(0, 0, 0));
        const dl2 = new DirectionalLight(0xffffff, 0.22);
        dl2.position = new Vector3(-3832, -2587, 4772);
        dl2.lookAt(new Vector3(0, 0, 0));
        this.defaultLights = [al, dl0, dl1, dl2];
        this.depthMaterial.depthPacking = DepthPackingStrategies.BasicDepthPacking;
        this.downsampleDepth.blending = Blending.NoBlending;
        this.downsampleDepth.correctColor = true;
    }

    get config(): Readonly<RenderConfig> {
        return this.renderConfig;
    }

    private get realRatio(): number {
        if (this.renderConfig.antialias !== 'ssaa') {
            return 1;
        }
        const pipelineConfig = this.pipelineConfig;
        if (pipelineConfig.Forward.solid.enabled.get() || pipelineConfig.TransparentLine.enabled.get()) {
            return 1;
        }
        return this.renderConfig.resolutionRatio;
    }

    destroy() {
        this.isDestroy = true;
        this.pipeline.destroy();
        this.defaultCamera.destroy();
        this.defaultScene.destroy();
        this.quadDrawer.destroy();
        this.downsample.destroy();
        this.downsampleDepth.destroy();
        this.mixColorDepth.destroy();
        this.depthMaterial.destroy();
    }

    private updateRenderConfig(config: RenderConfig): void {
        const pipelineConfig: IPipelineConfig = {};
        pipelineConfig.Background = {
            enabled: true,
            ground: { enabled: false },
            background: {
                active: BackgroundMode.BasicBackground,
                basic: { color: new Color(config.background[0]), alpha: config.background[1] },
            },
        };

        if (config.ao) {
            pipelineConfig.AO = { enabled: true };
        }
        if (config.antialias === 'taa') {
            pipelineConfig.TAA = { enabled: true, maxSample: 32, outputSample: 32 };
        }
        if (config.deferred) {
            pipelineConfig.Deferred = { enabled: true, autoExposedEnabled: true };
        } else {
            switch (config.mode) {
                case RenderMode.SHADING:
                    pipelineConfig.Forward = { enabled: true };
                    break;
                case RenderMode.TRANSPARENT_LINE:
                    pipelineConfig.Forward = { enabled: false };
                    pipelineConfig.TransparentLine = { enabled: true };
                    break;
                case RenderMode.OUTLINE_ONLY:
                    pipelineConfig.Forward = { enabled: true, solid: { enabled: true } };
                    pipelineConfig.Outline = { enabled: true };
                    break;
                case RenderMode.OUTLINE_WITH_SHADING:
                    pipelineConfig.Forward = { enabled: true };
                    pipelineConfig.Outline = { enabled: true };
                    break;
                case RenderMode.TOON_SHADING:
                    pipelineConfig.Forward = { enabled: true, toon: { enabled: true } };
                    break;
                case RenderMode.OUTLINE_WITH_TOON:
                    pipelineConfig.Forward = { enabled: true, toon: { enabled: true } };
                    pipelineConfig.Outline = { enabled: true };
                    break;
            }
        }
        if (config.outline === 'default') {
            const outline = pipelineConfig.Outline ?? (pipelineConfig.Outline = {});
            outline.enableDepth = false;
            outline.indexEdgeThickness = 2;
            outline.normalCoefficient = 0.5;
        }

        // migrate deprecated config
        if (config.pipelineConfig.Stylize?.applyToBackgroundAndGround) {
            if (config.pipelineConfig.Stylize) {
                config.pipelineConfig.Stylize.target = FilterTarget.All;
            } else {
                config.pipelineConfig.Stylize = {
                    target: FilterTarget.All,
                };
            }
        }

        const pipelineChanged = setPipelineConfig(this.pipelineConfig, [
            config.pipelineConfig,
            pipelineConfig,
            this.DEFAULT_PIPELINE_CONFIG,
        ]);
        if (pipelineChanged) {
            this.pipeline.resetContentCache();
        }
        Object.assign(this.renderConfig, config);
        if (!this.isAdvancedBackend && this.renderConfig.antialias === 'msaa') {
            this.renderConfig.antialias = 'disable';
        }
    }

    /**
     * @internal
     */
    onRendererChanged(renderer: IRenderer) {
        this.isAdvancedBackend =
            renderer.backend === RendererBackend.WEBGL2_JS ||
            renderer.backend === RendererBackend.WEBGL2_WASM ||
            renderer.backend === RendererBackend.WEBGPU_WASM;
        this.renderer = renderer;
        if (this.pipeline) {
            this.pipeline.updateRenderer(renderer);
            this.pipeline.resetContentCache();
        } else {
            this.pipeline = new PostPipeline(new RendererAdaptor(renderer));
            this.pipelineConfig = createPipelineConfig(this.pipeline, this.renderingConfig);
            if (!this.DEFAULT_PIPELINE_CONFIG) {
                this.DEFAULT_PIPELINE_CONFIG = getPipelineConfigObject(this.pipelineConfig);
            }
            this.updateRenderConfig(this.renderConfig);
        }
    }

    private getAxisCamera(
        camera: SnapshotAxisDirection | DirectionCameraCustom | CustomCamera,
        drawableList: DrawableList,
        overrideOutputSize?: Size,
    ): {
        camera: Camera3D;
        size: Size; // render size
        worldBox: Box3;
    } {
        const { calcRenderSizeType, physicalSizeRatio, maxRenderSize, autoPOT } = this.renderConfig;
        let renderCamera: Camera3D | undefined;
        let renderSize: Size | undefined;
        let sizePadding: number = 0;
        let axisDirection: SnapshotAxisDirection | undefined;
        const axisDirectionConfig: Partial<Pick<DirectionCameraCustom, 'boxPrecision' | 'layer' | 'worldBox'>> = {};
        if (typeof camera === 'string') {
            axisDirection = camera;
        } else if (typeof camera.type === 'string') {
            const c = camera as DirectionCameraCustom;
            axisDirection = c.type;
            axisDirectionConfig.layer = c.layer;
            axisDirectionConfig.boxPrecision = c.boxPrecision;
            axisDirectionConfig.worldBox = c.worldBox;
        } else if (TypeAssert.isCamera3D(camera.type)) {
            const c = camera as CustomCamera;
            renderCamera = c.type;
            renderSize = c.size;
            renderCamera.updateMatrixWorld();
        }

        const worldBox = new Box3();
        if (!renderCamera || !renderSize) {
            // we should padding base on real resized output when like outline mode.
            sizePadding = this.pipelineConfig.Outline.enabled.get() ? 1.5 : 0;
            renderCamera = this.defaultCamera;
            renderCamera.layers.mask = axisDirectionConfig.layer ?? 1;
            let union: ((worldBox: Box3, drawable: Drawable) => void) | undefined;
            if (axisDirectionConfig.worldBox) {
                worldBox.copy(axisDirectionConfig.worldBox);
            } else if (
                axisDirectionConfig.boxPrecision === undefined ||
                axisDirectionConfig.boxPrecision === SnapshotBoxPrecision.BoundingBox
            ) {
                union = (box, drawable) => {
                    box.unionSafe(drawable.worldBoundingBox);
                };
            } else if (axisDirectionConfig.boxPrecision === SnapshotBoxPrecision.Vertex) {
                const v = new Vector3();
                union = (box, node) => {
                    const geometry = node.geometry;
                    if (!geometry) {
                        return;
                    }
                    if (TypeAssert.isGeometry(geometry)) {
                        const vertices = geometry.vertices;
                        for (let i = 0; i < vertices.length; i++) {
                            v.copy(vertices[i]).applyMatrix4(node.matrixWorld);
                            if (!isNaN(v.x) && !isNaN(v.y) && !isNaN(v.z)) {
                                box.expandByPoint(v);
                            }
                        }
                    } else if (TypeAssert.isBufferGeometry(geometry)) {
                        const position = geometry.attributes.position;
                        if (!position) {
                            return;
                        }
                        for (let i = 0; i < position.count; i++) {
                            v.fromBufferAttribute(position, i).applyMatrix4(node.matrixWorld);
                            if (!v.hasNan()) {
                                box.expandByPoint(v);
                            }
                        }
                    }
                };
            }

            if (union) {
                for (let i = 0; i < drawableList.list.length; i++) {
                    const o = drawableList.list[i];
                    if (TypeAssert.isInstanceMesh(o)) {
                        o.updateRenderEntity();
                    } else {
                        o.updateBoundings();
                    }
                    if (!worldBox.containsBox(o.worldBoundingBox)) {
                        union(worldBox, o);
                    }
                }
            }

            if (worldBox.isEmpty()) {
                renderSize = { width: 0, height: 0 };
            } else {
                renderSize = setupCamera(renderCamera as OrthographicCamera, worldBox, axisDirection!);
            }
        }

        if (renderSize.width === 0 || renderSize.height === 0) {
            return { camera: renderCamera, size: renderSize, worldBox };
        }

        const size: Size = overrideOutputSize
            ? overrideOutputSize
            : { width: renderSize.width * physicalSizeRatio, height: renderSize.height * physicalSizeRatio };
        if (calcRenderSizeType === 'pixel') {
            const MaxRenderSize = maxRenderSize * 4; // if object very thin and long, max size will limit maxRenderSize * 4
            size.width = Math.min(size.width, MaxRenderSize);
            size.height = Math.min(size.height, MaxRenderSize);

            const pixelCount = size.width * size.height;
            const MaxPixelCount = maxRenderSize ** 2;
            if (pixelCount > MaxPixelCount) {
                const ratio = Math.sqrt(pixelCount / MaxPixelCount);
                size.width = Math.min(size.width / ratio, MaxRenderSize);
                size.height = Math.min(size.height / ratio, MaxRenderSize);
            }
        } else {
            const maxSize = Math.max(size.width, size.height);
            if (maxSize > maxRenderSize) {
                const ratio = maxSize / maxRenderSize;
                size.width = size.width / ratio;
                size.height = size.height / ratio;
            }
        }

        if (autoPOT) {
            size.width = 2 ** Math.floor(Math.log(size.width) / Math.LN2);
            size.height = 2 ** Math.floor(Math.log(size.height) / Math.LN2);
        } else {
            size.width = Math.floor(size.width);
            size.height = Math.floor(size.height);
        }

        const ratio = this.realRatio;
        const paddingX = (sizePadding * renderSize.width) / (size.width * ratio);
        const paddingY = (sizePadding * renderSize.height) / (size.height * ratio);
        this.defaultCamera.left -= paddingX;
        this.defaultCamera.right += paddingX;
        this.defaultCamera.top += paddingY;
        this.defaultCamera.bottom -= paddingY;

        return { camera: renderCamera, size, worldBox };
    }

    private baseShading(
        width: number,
        height: number,
        multiSample: boolean,
        adaptor: SnapShotAdaptor,
        renderSize: Size,
        ctx: SnapshotCtx,
    ) {
        const { drawableList, camera, freeables } = ctx;
        const { background, antialias, overrideMaterial } = this.renderConfig;
        const target = createRenderTarget(width, height, this.renderer, multiSample);

        let resolveTarget: RenderTarget | undefined;
        if (multiSample) {
            resolveTarget = createRenderTarget(width, height, this.renderer, false);
        }

        freeables.push(target);
        this.pipeline.updateEffect(adaptor, true, true, this.renderingConfig, this.drivenCullingConfig);
        this.pipeline.setFrameSize(renderSize.width, renderSize.height);
        this.renderer.setRenderTarget(target, resolveTarget);
        this.renderer.setClearColor(background[0], background[1]);
        this.renderer.clear();
        if (!!overrideMaterial) {
            this.renderer.beginPass(true, true, false, false);
            this.renderer.overrideDispatcher = new MaterialShadingWithDynamicShapeDispatcher(overrideMaterial);
            this.renderer.overrideDispatcher.update();
        }
        const renderCounts = antialias === 'taa' ? 32 : 1;
        for (let i = 0; i < renderCounts; i++) {
            if (!!overrideMaterial) {
                this.renderer.renderRenderable(drawableList.project(camera));
            } else {
                this.pipeline.renderSnapshot(
                    adaptor,
                    { target, resolveTarget },
                    this.renderingConfig,
                    this.drivenCullingConfig,
                );
            }
        }
        this.renderer.overrideDispatcher = null;

        if (overrideMaterial) {
            this.renderer.endPass();
        }
        return resolveTarget || target;
    }

    generateDepthTexture(
        width: number,
        height: number,
        multiSample: boolean,
        adaptor: SnapShotAdaptor,
        ctx: SnapshotCtx,
    ): RenderAttachment {
        const { size, drawableList, camera, freeables } = ctx;
        const overrideMaterial = this.depthMaterial;
        const target = createRenderTarget(width, height, this.renderer, multiSample);
        freeables.push(target);
        this.pipeline.updateEffect(adaptor, true, true, this.renderingConfig, this.drivenCullingConfig);
        this.pipeline.setFrameSize(size.width, size.height);
        this.renderer.setRenderTarget(target);
        this.renderer.setClearColor(0, 0);
        this.renderer.clear();
        this.renderer.overrideDispatcher = new MaterialShadingWithDynamicShapeDispatcher(overrideMaterial);
        this.renderer.overrideDispatcher.update();
        this.renderer.renderRenderable(drawableList.project(camera));
        this.renderer.overrideDispatcher = null;
        return target.colors[0];
    }

    private downsampleShading(
        target: RenderTarget,
        renderSize: Size,
        downsample: DownsampleMaterial,
        correctRGBOnly: boolean,
        ctx: SnapshotCtx,
    ) {
        const { size, freeables } = ctx;
        downsample.tDiffuse = target.colors[0]; // safe
        correctRGBOnly ? downsample.setTexelZero() : downsample.setTexelSize(renderSize.width, renderSize.height);
        const downsampleTarget = createRenderTarget(size.width, size.height, this.renderer, false);
        freeables.push(downsampleTarget);
        this.pipeline.setFrameSize(size.width, size.height);
        this.renderer.setRenderTarget(downsampleTarget);
        this.quadDrawer.config(this.renderer);
        this.renderer.beginPass(true, true, false, false);
        this.quadDrawer.setMaterial(downsample);
        this.quadDrawer.render(this.renderer);
        this.renderer.endPass();
        return downsampleTarget;
    }

    private mixDepthShading(colorTarget: RenderTarget, depthTexture: RenderAttachment, ctx: SnapshotCtx) {
        const { size, freeables } = ctx;
        const targetDepth = createRenderTarget(size.width, size.height, this.renderer, false);
        freeables.push(targetDepth);
        this.renderer.setRenderTarget(targetDepth);
        this.renderer.setClearColor(0, 0);
        this.renderer.clear();
        const copy = this.mixColorDepth;
        copy.tDiffuse = colorTarget.colors[0];
        depthTexture.configSampler(s => {
            s.minFilter = SamplerFilter.Nearest;
        });
        copy.depth = depthTexture;
        this.quadDrawer.config(this.renderer);
        this.renderer.beginPass(true, true, false, false);
        this.quadDrawer.setMaterial(copy);
        this.quadDrawer.render(this.renderer);
        this.renderer.endPass();
        return targetDepth;
    }

    private inner_render(ctx: SnapshotCtx) {
        const { drawableList, scene, camera, size } = ctx;
        const { combineDepthAlpha, antialias } = this.renderConfig;
        const ratio = this.realRatio;
        const { Outline, Forward } = this.pipelineConfig;
        const downsampleShading = ratio > 1;
        const extraOutlineShading =
            downsampleShading && antialias !== 'taa' && Outline.enabled.get() && !Forward.solid.enabled.get();
        const renderSize: Size = {
            width: Math.floor(size.width * ratio),
            height: Math.floor(size.height * ratio),
        };
        const adaptor = new SnapShotAdaptor(camera, drawableList, scene);

        if (extraOutlineShading) {
            this.pipelineConfig.Outline.enabled.set(false);
        }

        let target = this.baseShading(
            renderSize.width,
            renderSize.height,
            antialias === 'msaa',
            adaptor,
            renderSize,
            ctx,
        );
        let depthTexture = target.depth!;

        // always correct rgb when bg is 0x0 0
        if (combineDepthAlpha && (antialias === 'ssaa' || antialias === 'msaa')) {
            target = this.downsampleShading(target, renderSize, this.downsampleDepth, !downsampleShading, ctx);
        } else if (downsampleShading) {
            target = this.downsampleShading(target, renderSize, this.downsample, false, ctx);
        }

        if (extraOutlineShading) {
            const deferredEnabled = this.pipelineConfig.Deferred.enabled.get();
            const forwardEnabled = this.pipelineConfig.Forward.enabled.get();
            this.pipelineConfig.Background.enabled.set(false);
            this.pipelineConfig.Deferred.enabled.set(false);
            this.pipelineConfig.Forward.enabled.set(false);
            this.pipelineConfig.Outline.enabled.set(true);
            this.pipeline.renderSnapshot(adaptor, { target }, this.renderingConfig, this.drivenCullingConfig);
            this.pipelineConfig.Deferred.enabled.set(deferredEnabled);
            this.pipelineConfig.Forward.enabled.set(forwardEnabled);
            this.pipelineConfig.Background.enabled.set(true);
        }

        if (combineDepthAlpha) {
            if (!this.isAdvancedBackend) {
                // create depth
                depthTexture = this.generateDepthTexture(
                    renderSize.width,
                    renderSize.height,
                    antialias === 'msaa',
                    adaptor,
                    ctx,
                );
            }
            target = this.mixDepthShading(target, depthTexture, ctx);
        }

        this.renderer.flushCommands?.();

        return target;
    }

    private async prerender(ctx: SnapshotCtx) {
        const { drawableList, scene, camera, size } = ctx;
        if (!scene.splatManager.splatCounts) {
            return;
        }
        const splat = scene.splatManager.splats[0];
        const { promise, resolve } = deferred();
        splat.once(SplatSortedEvent, resolve);
        const ratio = this.realRatio;
        const renderSize: Size = {
            width: Math.floor(size.width * ratio),
            height: Math.floor(size.height * ratio),
        };
        const adaptor = new SnapShotAdaptor(camera, drawableList, scene);
        this.baseShading(renderSize.width, renderSize.height, false, adaptor, renderSize, ctx);
        await promise;
    }

    async render(
        object: Object3D | Object3D[],
        camera: SnapshotAxisDirection | DirectionCameraCustom | CustomCamera,
        config:
            | PresetRenderConfig
            | Partial<RenderConfig & { extends: PresetRenderConfig }> = PresetRenderConfig.Default,
    ): Promise<SnapshotResult> {
        // the implement should only allow read back and pre check to be async.
        // no async action in render body!!!
        if (this.renderer.rendererStatus.state === RendererState.Initializing) {
            await this.renderer.rendererStatus.initialized;
        }

        if (this.isDestroy) {
            return Promise.resolve(
                SnapshotResult.exception(SnapshotResultResultType.Error, new Error('SnapshotRenderer is destroy.')),
            );
        }
        {
            const renderConfig: RenderConfig = Object.assign(
                {},
                DEFAULT_RENDER_CONFIG,
                typeof config === 'string'
                    ? getPresetRenderConfig(config)
                    : config.extends
                      ? Object.assign({}, getPresetRenderConfig(config.extends), config)
                      : config,
            );
            this.updateRenderConfig(renderConfig);
        }

        const { ignoreVisible, light, overrideOutputSize } = this.renderConfig;
        const objects = Array.isArray(object) ? object : [object];
        objects[0]?.scene?.update(); // sync object update

        let scene: Scene3D | undefined;
        let sceneLights: Light[] = [];
        if (light === 'default') {
            scene = this.defaultScene;
            scene.add(this.defaultLights);
            sceneLights = this.defaultLights;
        } else if (light === 'scene') {
            scene = objects[0]?.scene ?? undefined;
        } else if (Array.isArray(light)) {
            scene = this.defaultScene;
            scene.add(light);
            sceneLights = light;
        }
        if (!scene) {
            logger.invalidInput('SnapshotError: scene is null. fullback to default');
            scene = this.defaultScene;
            scene.add(this.defaultLights);
            sceneLights = this.defaultLights;
        }

        const sceneSplats: Splat[] = [];
        const drawableList = new DrawableList();
        drawableList.lodEnabled = false;
        for (let i = 0; i < objects.length; i++) {
            const o = objects[i];
            ContentBridge.sceneNodeUpdate(o);
            o.updateWorldMatrix(true, true);
            o.traverse(o => {
                if (o.parent) {
                    o.netVisibility = o.visible && o.parent.netVisibility;
                } else {
                    o.netVisibility = o.visible;
                }
                if (ignoreVisible || o.netVisibility) {
                    if (TypeAssert.isDrawable(o)) {
                        drawableList.push(o);
                    } else if (TypeAssert.isSplat(o) && !scene!.splatManager.has(o)) {
                        scene!.splatManager.add(o);
                        sceneSplats.push(o);
                    }
                }
            });
        }

        const { camera: renderCamera, size, worldBox } = this.getAxisCamera(camera, drawableList, overrideOutputSize);
        if (size.width === 0 || size.height === 0) {
            return Promise.resolve(SnapshotResult.exception(SnapshotResultResultType.Empty));
        }

        scene.update();
        scene.updateRegistryAndActive(this.renderer, renderCamera);

        const recompileMaterials: Material[] = [];
        const freeables: RenderTarget[] = [];
        try {
            if (PipelineContentAPIForRenderingAndFilteringEnabled()) {
                PipelineContentBridge.prepareTempRenderList(objects);
                PipelineContentBridge.drawableListCreate(drawableList);
                PipelineContentBridge.drawableListUpdateSceneAndUse(drawableList, scene);
            } else {
                // js cached shaderKey, lightableMaterial need recompile
                const overrideMaterial = this.renderConfig.overrideMaterial;
                if (overrideMaterial) {
                    if (TypeAssert.isLightableMaterial(overrideMaterial)) {
                        overrideMaterial.notifyRecompileShader();
                        recompileMaterials.push(overrideMaterial);
                    }
                } else {
                    for (let i = 0; i < drawableList.list.length; i++) {
                        const renderMaterials = drawableList.list[i].renderMaterial;
                        for (let j = 0; j < renderMaterials.length; j++) {
                            const renderMaterial = renderMaterials[j];
                            if (TypeAssert.isLightableMaterial(renderMaterial)) {
                                renderMaterial.notifyRecompileShader();
                                recompileMaterials.push(renderMaterial);
                            }
                        }
                    }
                }
            }

            const ctx: SnapshotCtx = { drawableList, scene, camera: renderCamera, size, freeables };
            if (ctx.scene.splatManager.splatCounts) {
                await this.prerender(ctx);
            }
            const target = this.inner_render(ctx);

            const resultBuffer = new Uint8Array(size.width * size.height * 4);
            const projectionMatrix = renderCamera.projectionMatrix.clone();
            const cameraWorldMatrix = renderCamera.matrixWorld.clone();

            return this.renderer
                .readPixelsAsync(target, { x: 0, y: 0, width: size.width, height: size.height }, resultBuffer)
                .then(
                    () =>
                        new SnapshotResult(
                            resultBuffer,
                            size,
                            {
                                projectionMatrix,
                                worldMatrix: cameraWorldMatrix,
                            },
                            worldBox,
                        ),
                    e => SnapshotResult.exception(SnapshotResultResultType.Error, e),
                );
        } catch (error) {
            return Promise.resolve(SnapshotResult.exception(SnapshotResultResultType.Error, error));
        } finally {
            for (let i = 0; i < sceneSplats.length; i++) {
                const splat = sceneSplats[i];
                scene.splatManager.remove(splat);
            }
            for (let i = 0; i < sceneLights.length; i++) {
                scene.remove(sceneLights[i]);
            }
            for (let i = 0; i < recompileMaterials.length; i++) {
                recompileMaterials[i].notifyRecompileShader();
            }
            for (let i = 0; i < freeables.length; i++) {
                freeables[i].destroy();
            }
            PipelineContentBridge.cleanupTempRenderList(objects);
            const adaptor = this.pipeline.adaptor.adaptor;
            // reset cached items, magic null!!!
            this.pipeline.adaptor.setAdaptor(null as any);
            adaptor?.destroy();
        }
    }
}
