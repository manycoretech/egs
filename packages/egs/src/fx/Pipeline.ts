import { type IRenderer, RendererBackend } from '../renderer/IRenderer';
import { EffectComposer } from '../rendergraph/EffectComposer';
import { screen, pass, target, colorAttachment } from '../rendergraph/NodeMakers';
import { RenderGraph } from '../rendergraph/RenderGraph';
import { Shadow } from '../scene/shadows/Shadow';
import { HashKeyBuilder } from '../utils/HashKeyBuilder';
import type { RendererAdaptor } from './RendererAdaptor';
import { type SceneAdaptor, SceneAdaptorDispatcher } from './SceneAdaptor';
import { RenderMode } from '../engine/EngineConfig';
import { ShadowMapPlugin } from './plugins/ShadowMap';
import { BackgroundPlugin } from './plugins/Background';
import { DeferredPlugin } from './plugins/Deferred';
import { ForwardPlugin } from './plugins/Forward';
import { HighlightPlugin } from './plugins/Highlight';
import { AOPlugin } from './plugins/AO';
import { OutlinePlugin } from './plugins/Outline';
import { OverlayScenePlugin } from './plugins/OverlayScene';
import { StylizePlugin } from './plugins/Stylize';
import { TAAPlugin } from './plugins/TAA';
import { TransparentLinePlugin } from './plugins/TransparentLine';
import { SceneClipPlugin } from './plugins/SceneClip';
import type { PipelinePlugin, IEffectConfig, RenderingConfig, DrivenCullingConfig } from './plugins/PipelinePlugin';
import { DrivenGenHZBMaterial } from '../elements/materials/driven/DrivenGenHZBMaterial';
import type { OverrideScreenOutputTarget } from '../rendergraph/nodes/PassNode';
import { CompositePlugin } from './plugins/Composite';
import { DebugPlugin } from './plugins/Debug';
import type { RenderTargetNode } from '../rendergraph/nodes/RenderTargetNode';
import { SamplerBindingType } from '../elements/textures/Texture';
import { SplattingPlugin } from './plugins/Splatting';
import { TextureFormat } from '../elements/textures/types';

export class PostPipeline {
    /**
     * @internal
     */
    isPerformanceSlow = false;
    /**
     * @internal
     */
    currentRenderMode = RenderMode.SHADING;
    /**
     * @internal
     */
    adaptor = new SceneAdaptorDispatcher();
    /**
     * @internal
     */
    rendererAdaptor: RendererAdaptor;
    private depthPyramid: RenderTargetNode;
    private effectComposer: EffectComposer;

    _getEffectComposer() {
        return this.effectComposer;
    }

    sceneClipPlugin: SceneClipPlugin;
    shadowMapPlugin: ShadowMapPlugin;
    backgroundPlugin: BackgroundPlugin;

    splattingPlugin: SplattingPlugin;
    deferredPlugin: DeferredPlugin;
    transparentLinePlugin: TransparentLinePlugin;
    forwardPlugin: ForwardPlugin;

    stylizePlugin: StylizePlugin;
    aoPlugin: AOPlugin;
    outlinePlugin: OutlinePlugin;
    overlayScene: OverlayScenePlugin;
    highlightPlugin: HighlightPlugin;
    taaPlugin: TAAPlugin;
    compositePlugin: CompositePlugin;
    debugPlugin: DebugPlugin;

    private _cachedPlugins?: PipelinePlugin[];
    private get plugins(): PipelinePlugin[] {
        if (!this._cachedPlugins) {
            this._cachedPlugins = [
                this.sceneClipPlugin,
                this.shadowMapPlugin,

                this.backgroundPlugin,
                this.deferredPlugin,
                this.transparentLinePlugin,
                this.forwardPlugin,
                this.debugPlugin,
                this.splattingPlugin,

                this.stylizePlugin,
                this.aoPlugin,
                this.outlinePlugin,
                this.overlayScene,
                this.highlightPlugin,
                this.taaPlugin,
                this.compositePlugin,
            ].filter(v => v.envSupported);
        }

        return this._cachedPlugins;
    }

    constructor(rendererAdaptor: RendererAdaptor) {
        this.rendererAdaptor = rendererAdaptor;
        this.effectComposer = new EffectComposer(rendererAdaptor);

        this.sceneClipPlugin = new SceneClipPlugin(this.adaptor, rendererAdaptor);
        this.shadowMapPlugin = new ShadowMapPlugin(this.adaptor, rendererAdaptor);
        this.backgroundPlugin = new BackgroundPlugin(this.adaptor, rendererAdaptor);

        this.deferredPlugin = new DeferredPlugin(this.adaptor, rendererAdaptor);
        this.transparentLinePlugin = new TransparentLinePlugin(this.adaptor, rendererAdaptor);
        this.forwardPlugin = new ForwardPlugin(this.adaptor, rendererAdaptor);
        this.debugPlugin = new DebugPlugin(this.adaptor, rendererAdaptor);

        this.stylizePlugin = new StylizePlugin(this.adaptor, rendererAdaptor);
        this.aoPlugin = new AOPlugin(this.adaptor, rendererAdaptor);
        this.outlinePlugin = new OutlinePlugin(this.adaptor, rendererAdaptor);
        this.splattingPlugin = new SplattingPlugin(this.adaptor, rendererAdaptor);
        this.overlayScene = new OverlayScenePlugin(this.adaptor, rendererAdaptor);
        this.highlightPlugin = new HighlightPlugin(this.adaptor, rendererAdaptor);
        this.taaPlugin = new TAAPlugin(this.adaptor, rendererAdaptor);
        this.compositePlugin = new CompositePlugin(this.adaptor, rendererAdaptor);
        this.debugPlugin = new DebugPlugin(this.adaptor, rendererAdaptor);
        this.depthPyramid = target('depth_pyramid', false, false)
            .modify(node => {
                const color = colorAttachment('depth_pyramid_color');
                color.format = TextureFormat.R32Float;
                color.sampler.samplerBindingType = SamplerBindingType.NonFiltering;
                color.setFilter(false, true);
                node.attach(color);
            })
            .keepContent()
            .from(
                pass('pre_create_depth_pyramid_pass')
                    .disableClear()
                    .use(() => {}),
            );
        this.setFrameSize(rendererAdaptor.width, rendererAdaptor.height);
    }

    mapPlugins(callback: (plugin: PipelinePlugin) => void) {
        const plugins = this.plugins;
        for (let i = 0; i < plugins.length; i++) {
            callback(plugins[i]);
        }
    }

    updateRenderer(renderer: IRenderer) {
        this.resetContentCache();
        this.rendererAdaptor.renderer = renderer;
    }

    resetContentCache() {
        // all fbo destroyed, static frame cache is not exist
        this.backgroundPlugin.notifyChanged();
        this.splattingPlugin.notifyChanged();
        this.forwardPlugin.notifyChanged();
        this.compositePlugin.notifyChanged();
        this.outlinePlugin.notifyChanged();
        this.backgroundPlugin.notifyChanged();
        this.highlightPlugin.notifyChanged();
        this.effectComposer.clear();
        this._cachedPlugins = undefined;
    }

    setFrameSize(width: number, height: number) {
        this.resetContentCache();
        const pixelRatio = this.rendererAdaptor.renderer.getPixelRatio();
        const w = width * pixelRatio;
        const h = height * pixelRatio;
        this.rendererAdaptor.setSize(w, h);
        this.mapPlugins(plugin => plugin.updateFrameSize(w, h));
    }

    updateEffect(
        scene: SceneAdaptor,
        isFrameStable: boolean,
        isCameraStable: boolean,
        renderingConfig: RenderingConfig,
        drivenCullingConfig: DrivenCullingConfig,
    ) {
        this.adaptor.setAdaptor(scene);

        const effectConfig: IEffectConfig = {
            isPerformanceSlow: this.isPerformanceSlow,
            planarShadowEnabled: false,
            planarShadowReady: false,
            taaEnabled: false,
            taaStable: false,
        };
        this.splattingPlugin.updateEffect(scene);
        this.forwardPlugin.updateEffect(scene, isFrameStable, isCameraStable, effectConfig);
        this.aoPlugin.updateEffect(scene, isFrameStable, isCameraStable, effectConfig);
        this.taaPlugin.updateEffect(scene, isFrameStable, isCameraStable, effectConfig);
        this.compositePlugin.updateEffect(scene, isFrameStable, isCameraStable, effectConfig);

        // if taa is on, force disable staticFrameCache
        if (effectConfig.taaEnabled) {
            (this.forwardPlugin as any).staticFrameCacheActive = false;
        }

        if (
            this.shouldRenderNextFrameByHZB &&
            renderingConfig.gpuDriven.enabled &&
            drivenCullingConfig.occlusionCullingEnabled
        ) {
            this.shouldRenderNextFrameByHZB = false;
            this.shouldRenderCurrentFrameByHZB = true;
        }

        if (!isFrameStable && renderingConfig.gpuDriven.enabled && drivenCullingConfig.occlusionCullingEnabled) {
            this.shouldRenderNextFrameByHZB = true;
        }
    }

    private shouldRenderCurrentFrameByHZB = false;
    private shouldRenderNextFrameByHZB = false;
    shouldRenderFrame(): boolean {
        const result = this.shouldRenderCurrentFrameByHZB || this.plugins.some(p => p.shouldRender);
        this.shouldRenderCurrentFrameByHZB = false;
        return result;
    }

    shouldRenderNextFrame(): boolean {
        return this.shouldRenderNextFrameByHZB || this.plugins.some(p => p.shouldRender);
    }

    render(
        sceneAdaptor: SceneAdaptor,
        renderingConfig: RenderingConfig,
        drivenCullingConfig: DrivenCullingConfig,
    ): void {
        this.adaptor.setAdaptor(sceneAdaptor);
        const isTaaEnabled = (Shadow._IN_TEMPORAL = this.taaPlugin.enabled);
        if (isTaaEnabled) {
            this.taaPlugin.tick();
            this.taaPlugin.jitterCamera(sceneAdaptor.camera, this.rendererAdaptor.width, this.rendererAdaptor.height);
        } else {
            // need to remove the taa jitter to reset camera correct
            this.taaPlugin.jitterClear(sceneAdaptor.camera);
            sceneAdaptor.camera.updateProjectionMatrix();
        }

        const graph = this.createRenderGraph(renderingConfig, drivenCullingConfig);
        this.effectComposer.render(graph.build());
    }

    renderSnapshot(
        scene: SceneAdaptor,
        target: OverrideScreenOutputTarget,
        renderingConfig: RenderingConfig,
        drivenCullingConfig: DrivenCullingConfig,
    ): void {
        this.effectComposer.overrideScreenOutputTarget = target;
        this.render(scene, renderingConfig, drivenCullingConfig);
        this.effectComposer.overrideScreenOutputTarget = undefined;
    }

    private graphCaches = new Map<string, RenderGraph>();
    private volatileGraphCaches = new Map<string, RenderGraph>();
    private genHZBMaterial = new DrivenGenHZBMaterial();
    private createRenderGraph(renderingConfig: RenderingConfig, drivenCullingConfig: DrivenCullingConfig): RenderGraph {
        const plugins = this.plugins.filter(plugin => plugin.enabled);
        const configMSAA = renderingConfig.MSAA;
        const backend = this.rendererAdaptor.renderer.backend;
        renderingConfig.MSAA = configMSAA && backend !== RendererBackend.WEBGL_JS;

        const {
            MSAA,
            gpuDriven: { enabled: drivenEnabled },
        } = renderingConfig;
        const { occlusionCullingEnabled } = drivenCullingConfig;
        const hasher = HashKeyBuilder.getInstance()
            .raw(backend)
            .bool(drivenEnabled)
            .bool(occlusionCullingEnabled)
            .bool(MSAA);
        plugins.forEach(plugin => plugin.updateGraphHash(hasher.raw(plugin.PLUGIN_NAME)));
        const graphKey = hasher.getKey();

        const cached = this.graphCaches.get(graphKey) || this.volatileGraphCaches.get(graphKey);
        if (cached) {
            renderingConfig.MSAA = configMSAA;
            return cached;
        }

        // create new graph resolve
        const graph = new RenderGraph(screen());
        const graphContext = {
            renderingConfig,
            drivenCullingConfig,
        };
        plugins.forEach(plugin => plugin.updateRenderGraph(graph, graphContext, this.depthPyramid));
        renderingConfig.MSAA = configMSAA;
        // commit last pass.
        graph.lastValidPass()?.resolveToScreen();
        if (drivenEnabled && occlusionCullingEnabled) {
            this.genHZBMaterial.depth = null;
            const genHZB = pass('gen_hzb_pass')
                .disableClear()
                .useDriven(this.genHZBMaterial)
                .before(() => {
                    this.genHZBMaterial.depth = null;
                })
                .draw(this.adaptor.default)
                .after(() => this.adaptor.camera.updatePrev());
            if (graph.depthTarget) {
                genHZB.input('depth', graph.depthTarget, 'depth');
            }
            genHZB.input('depthPyramid', this.depthPyramid);
            graph.addPass(genHZB);
        }

        // TODO: opt, use LRU, or simply we just use one lru map
        if (this.adaptor.scene.scene.shaderComponentRegistry.light.hasAnyShadow) {
            if (this.volatileGraphCaches.size > 20) {
                this.volatileGraphCaches.clear();
            }
            this.volatileGraphCaches.set(graphKey, graph);
        } else {
            this.graphCaches.set(graphKey, graph);
        }

        return graph;
    }

    destroy() {
        this.resetContentCache();
        this.graphCaches.clear();
        this.volatileGraphCaches.clear();
        this.effectComposer = null!;
        this.mapPlugins(plugin => plugin.destroy());
        this.rendererAdaptor = null!;
    }
}
