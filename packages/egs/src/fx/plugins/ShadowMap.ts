import { MeshDepthMaterial } from '../../elements/materials/mesh/MeshDepthMaterial.js';
import { MaterialShadingWithDynamicShapeDispatcher } from '../../renderer/MaterialDispatcher.js';
import { cubePass, cubeTarget, pass, target } from '../../rendergraph/NodeMakers.js';
import { iter } from '../../utils/Utils.js';
import { DrawcallListClassifyList, type ProjectedDrawcallList } from '../../scene/tools/DrawcallList.js';
import { PipelinePlugin, type PipelineContext, type DrivenCullingConfig } from './PipelinePlugin.js';
import type { HashKeyBuilder } from '../../utils/HashKeyBuilder.js';
import type { RenderGraph } from '../../rendergraph/RenderGraph.js';
import { Shadow } from '../../scene/shadows/Shadow.js';
import type { SceneAdaptorDispatcher } from '../SceneAdaptor.js';
import type { RendererAdaptor } from '../RendererAdaptor.js';
import { DrivenCullingMaterial } from '../../elements/materials/driven/DrivenCullingMaterial.js';
import { DrivenShadingMaterial, DrivenShadingMode } from '../../elements/materials/driven/DrivenShadingMaterial.js';
import type { RenderTarget } from '../../elements/textures/RenderTarget.js';
import { PipelineFilters } from '../PipelineAPI.js';
import type { PassNode } from '../../rendergraph/nodes/PassNode.js';

export class ShadowMapPlugin extends PipelinePlugin {
    readonly PLUGIN_NAME = 'shadowMap';

    private depthDispatcher: MaterialShadingWithDynamicShapeDispatcher<MeshDepthMaterial>;

    /**
     * whether use render proxy to render shadow map
     * be careful. current some render proxy(eg. auto instance, multi merge) does not fully support cast shadow flag.
     * @default false
     */
    private useProxy = false;

    protected _enabled = true;
    get enabled(): boolean {
        return this._enabled && this.scene.scene.shaderComponentRegistry.light.hasAnyShadow;
    }
    set enabled(v: boolean) {
        this._enabled = v;
    }

    private drivenCullingMaterial = new DrivenCullingMaterial();
    private drivenShadingMaterial = new DrivenShadingMaterial();

    constructor(scene: SceneAdaptorDispatcher, renderer: RendererAdaptor) {
        super(scene, renderer);
        this.depthDispatcher = new MaterialShadingWithDynamicShapeDispatcher(new MeshDepthMaterial());
        this.drivenShadingMaterial.shadingMode = DrivenShadingMode.DepthShading;
    }

    destroy() {
        this.depthDispatcher.destroy();
    }

    updateFrameSize() {}
    updateEffect() {}

    updateGraphHash(hasher: HashKeyBuilder) {
        hasher.raw(this.scene.scene.shaderComponentRegistry.light.shadowHashKey()).bool(this.useProxy);
    }

    /**
     * notes:
     * You should not directly reference a specific scene object(like light, shadow, light system)
     * into rendergraph hooks(like render, before, after), or it will cause mem leak
     * Instead, any scene object access, should provider by scene adaptor, every graph
     * actually reference the one scene adaptor dispatcher which pipeline provides,
     * and scene adaptor is provided by scene adaptor dispatcher. That's how we avoid mem leak.
     *
     * In shadowmap updating/generation case, you can't name specific shadow/light when
     * updating, because the graph instance has no relationship with what exactly light/shadow
     * in the scene. In fact, in current implementation only the number of light decide
     * the graph structure. So for each i in scene, we do check and update i th light,
     * and the scene dispatcher must responsible for updating/access same light when given same i;
     */
    updateRenderGraph(graph: RenderGraph, context: PipelineContext) {
        const basePass = pass('shadowmap')
            .disableClear()
            .use(() => {});
        const useGpuDriven = context.renderingConfig.gpuDriven.enabled && this.useProxy;
        // only use proxy when gpu driven is disabled. otherwise will lost something.
        const shouldUseProxy = !context.renderingConfig.gpuDriven.enabled && this.useProxy;

        if (useGpuDriven) {
            this.gpuDrivenShadowPass(context.drivenCullingConfig, basePass);
        } else {
            this.shadowPass(basePass, shouldUseProxy);
        }

        graph.addPass(basePass);
    }

    private shadowPass(basePass: PassNode, shouldUseProxy: boolean) {
        const scene = this.scene;
        const info = scene.scene.shaderComponentRegistry.light.createShadowMetaInfo();

        iter(info.directionalShadowCount, i => {
            const shadowTarget = target(`dir_${i}_shadowmap`)
                .keepContent()
                .resize(scene.getDirectionalShadowMapSize(i))
                .from([
                    pass(`dir_${i}_shadowmap_pass`)
                        .useDispatcher(this.depthDispatcher)
                        .before(scene.syncDirectionalShadowLayers(i))
                        .useIfAndDisableClear(
                            scene.isDirectionalShadowRequireUpdate(i),
                            scene.renderDirectionalShadow(i, shouldUseProxy),
                        )
                        .after(scene.returnDirectionalShadowResult(i)),
                ]);
            basePass.depend(shadowTarget);
        });

        iter(info.spotShadowCount, i => {
            const shadowTarget = target(`spot_${i}_shadowmap`)
                .keepContent()
                .resize(scene.getSpotShadowMapSize(i))
                .from([
                    pass(`spot_${i}_shadowmap_pass`)
                        .useDispatcher(this.depthDispatcher)
                        .before(scene.syncSpotShadowLayers(i))
                        .useIfAndDisableClear(
                            scene.isSpotShadowRequireUpdate(i),
                            scene.renderSpotShadow(i, shouldUseProxy),
                        )
                        .after(scene.returnSpotShadowResult(i)),
                ]);
            basePass.depend(shadowTarget);
        });

        iter(info.pointShadowCount, i => {
            const shadowTarget = cubeTarget(`point_${i}_shadow_target`)
                .keepContent()
                .resize(scene.getPointShadowMapSize(i))
                .from(
                    cubePass(`point_${i}_shadow_pass`)
                        .useDispatcher(this.depthDispatcher)
                        .before(scene.syncPointShadowLayers(i))
                        .useIfAndDisableClear(
                            scene.isPointShadowRequireUpdate(i),
                            scene.getPointShadowPassContent(shouldUseProxy),
                            scene.getAndUpdatePointCamera(i),
                            DrawcallListClassifyList.opaque,
                        )
                        .after(scene.returnPointShadowResult(i)),
                );
            shadowTarget.connect(basePass);
        });
    }

    private updateCullingConfig(config: DrivenCullingConfig) {
        // disable occlusion culling for shadow map culling pass.
        const origin = config.occlusionCullingEnabled;
        config.occlusionCullingEnabled = false;
        this.drivenCullingMaterial.update(config);
        config.occlusionCullingEnabled = origin;
    }

    /**
     * in gpu driven, shadow drawable list will be unfiltered, will use drawcall filter instead of drawable filter.
     * additional the projected drawcall list will disable light manually to prevent issue.
     */
    private gpuDrivenShadowPass(config: DrivenCullingConfig, bassPass: PassNode) {
        const scene = this.scene;
        const info = scene.scene.shaderComponentRegistry.light.createShadowMetaInfo();

        iter(info.directionalShadowCount, i => {
            let drawcallList: ProjectedDrawcallList | undefined;

            const shadowTarget = target(`dir_${i}_shadowmap`)
                .keepContent()
                .resize(scene.getDirectionalShadowMapSize(i));

            const cullingPass = pass(`dir_${i}_shadowmap_cull_pass`)
                .before(() => {
                    this.updateCullingConfig(config);
                    scene.syncDirectionalShadowLayers(i);
                })
                .useDriven(this.drivenCullingMaterial)
                .useIfAndDisableClear(scene.isDirectionalShadowRequireUpdate(i), r => {
                    const l = scene.adaptor.scene.shaderComponentRegistry.light.getNthShadowDirectionalLight(i);
                    drawcallList = scene.adaptor.getDirectionalShadowMapCasterUnfiltered(l);
                    drawcallList.useOnce = false;
                    drawcallList.render(r.renderer, undefined, PipelineFilters.isDrawCallShadowMapCaster());
                });
            const shadingPass = pass(`dir_${i}_shadowmap_shading_pass`)
                .useDriven(this.drivenShadingMaterial)
                .useDispatcher(this.depthDispatcher)
                .useIfAndDisableClear(scene.isDirectionalShadowRequireUpdate(i), r => {
                    drawcallList?.render(r.renderer, undefined, PipelineFilters.isDrawCallShadowMapCaster());
                    drawcallList?.destroy();
                    drawcallList = undefined;
                })
                .after(scene.returnDirectionalShadowResult(i));
            shadingPass.depend(cullingPass);
            shadowTarget.from([cullingPass, shadingPass]);
            bassPass.depend(shadowTarget);
        });

        // spot cone culling disabled. for better gpu driven compatibility.
        iter(info.spotShadowCount, i => {
            let drawcallList: ProjectedDrawcallList | undefined;

            const shadowTarget = target(`spot_${i}_shadowmap`).keepContent().resize(scene.getSpotShadowMapSize(i));

            const cullingPass = pass(`spot_${i}_shadowmap_cull_pass`)
                .before(() => {
                    this.updateCullingConfig(config);
                    scene.syncSpotShadowLayers(i);
                })
                .useDriven(this.drivenCullingMaterial)
                .useIfAndDisableClear(scene.isSpotShadowRequireUpdate(i), r => {
                    const l = scene.adaptor.scene.shaderComponentRegistry.light.getNthShadowSpotLight(i);
                    drawcallList = scene.adaptor.getSpotShadowMapCasterUnfiltered(l);
                    drawcallList.useOnce = false;
                    drawcallList.render(r.renderer, undefined, PipelineFilters.isDrawCallShadowMapCaster());
                });
            const shadingPass = pass(`spot_${i}_shadowmap_shading_pass`)
                .useDriven(this.drivenShadingMaterial)
                .useDispatcher(this.depthDispatcher)
                .useIfAndDisableClear(scene.isSpotShadowRequireUpdate(i), r => {
                    drawcallList!.render(r.renderer, undefined, PipelineFilters.isDrawCallShadowMapCaster());
                    drawcallList!.destroy();
                    drawcallList = undefined;
                })
                .after(scene.returnSpotShadowResult(i));
            shadingPass.depend(cullingPass);
            shadowTarget.from([cullingPass, shadingPass]);
            bassPass.depend(shadowTarget);
        });

        // create cube pass manually. we need an additional cull pass for each cube face.
        iter(info.pointShadowCount, i => {
            const shadowTarget = cubeTarget(`point_${i}_shadow_target`)
                .keepContent()
                .resize(scene.getPointShadowMapSize(i));
            const shouldRender = scene.isPointShadowRequireUpdate(i);
            const camera = scene.getAndUpdatePointCamera(i);
            const content = scene.getPointShadowPassContentUnfiltered();
            const passes = [];
            for (let j = 0; j < 6; j++) {
                let drawcallList: ProjectedDrawcallList | undefined;
                const cullingPass = pass(`point_${i}_shadowmap_cull_pass_${j}`)
                    .before(ctx => ((ctx.target as RenderTarget).layer = j))
                    .useDriven(this.drivenCullingMaterial)
                    .useIfAndDisableClear(shouldRender, r => {
                        drawcallList = content().project(camera().cameras[j], undefined, undefined, undefined, false);
                        drawcallList.useOnce = false;
                        drawcallList.render(r.renderer, undefined, PipelineFilters.isDrawCallShadowMapCaster());
                    });
                const shadingPass = pass(`point_${i}_shadowmap_shading_pass_${j}`)
                    .useDriven(this.drivenShadingMaterial)
                    .useDispatcher(this.depthDispatcher)
                    .useIfAndDisableClear(shouldRender, r => {
                        drawcallList!.render(r.renderer, undefined, PipelineFilters.isDrawCallShadowMapCaster());
                        drawcallList!.destroy();
                        drawcallList = undefined;
                    });
                passes.push(cullingPass, shadingPass);
            }
            passes[0].before(() => {
                this.updateCullingConfig(config);
                scene.syncPointShadowLayers(i);
            });
            passes[passes.length - 1].after(scene.returnPointShadowResult(i));
            // chain all cube passes.
            for (let j = 1; j < passes.length; j++) {
                passes[j].depend(passes[j - 1]);
            }
            shadowTarget.target.from(passes);
            shadowTarget.connect(bassPass);
        });
    }

    createConfig() {
        return {
            useProxy: {
                get: () => this.useProxy,
                set: (v: boolean) => {
                    this.useProxy = v;
                },
            },
            enableTemporal: {
                get: () => Shadow.ENABLE_TEMPORAL_EFFECT,
                set: (v: boolean) => {
                    Shadow.ENABLE_TEMPORAL_EFFECT = v;
                },
            },
            targetJitterSize: {
                get: () => Shadow.JITTER_SIZE,
                set: (v: number) => {
                    Shadow.JITTER_SIZE = v;
                },
            },
        };
    }
}
