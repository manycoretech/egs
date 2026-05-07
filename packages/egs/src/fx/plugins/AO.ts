import { MeshDepthMaterial, DepthPackingStrategies } from '../../elements/materials/mesh/MeshDepthMaterial';
import { Blending, BlendingFactor, BlendingEquation } from '../../utils/Constants';
import { CopyMaterial } from '../../elements/materials/quad/CopyMaterial';
import { SSAOPassMaterial } from '../../elements/materials/quad/SSAOPassMaterial';
import { SSAOBlurPassMaterial } from '../../elements/materials/quad/SSAOBlurPassMaterial';
import { pass, target } from '../../rendergraph/NodeMakers';
import { PerspectiveCamera } from '../../scene/cameras/PerspectiveCamera';
import { TypeAssert } from '../../scene/tools/TypeAssert';
import { drawQuad, RendererAdaptor } from '../RendererAdaptor';
import { MaterialShadingWithDynamicShapeDispatcher } from '../../renderer/MaterialDispatcher';
import { Matrix4 } from '../../math/Matrix4';
import { readonlyMath } from '../../math/Readonly';
import { PipelinePlugin, IEffectConfig, PipelineContext } from './PipelinePlugin';
import { HashKeyBuilder } from '../../utils/HashKeyBuilder';
import { RenderGraph } from '../../rendergraph/RenderGraph';
import { SceneAdaptor, SceneAdaptorDispatcher } from '../SceneAdaptor';
import { DrivenShadingMaterial, DrivenShadingMode } from '../../elements/materials/driven/DrivenShadingMaterial';

export class AOPlugin extends PipelinePlugin {
    readonly PLUGIN_NAME = 'AO';

    private depthMaterial = new MeshDepthMaterial({ blending: Blending.NoBlending });
    private aoPassMaterial = new SSAOPassMaterial();
    private aoBlurXMaterial = new SSAOBlurPassMaterial();
    private aoBlurYMaterial = new SSAOBlurPassMaterial();
    private aoComposeMaterial = new CopyMaterial({
        blending: Blending.CustomBlending,
        blendSrc: BlendingFactor.DstColor,
        blendDst: BlendingFactor.Zero,
        blendEquation: BlendingEquation.Add,
        blendSrcAlpha: BlendingFactor.DstAlpha,
        blendDstAlpha: BlendingFactor.Zero,
        blendEquationAlpha: BlendingEquation.Add,
    });
    private depthDispatcher: MaterialShadingWithDynamicShapeDispatcher<MeshDepthMaterial>;

    private drivenShadingMaterial = new DrivenShadingMaterial();

    private active: boolean = false;
    get enabled() {
        return this._enabled && this.active;
    }
    set enabled(v: boolean) {
        this._enabled = v;
    }

    constructor(scene: SceneAdaptorDispatcher, renderer: RendererAdaptor) {
        super(scene, renderer);
        this.depthMaterial.depthPacking = DepthPackingStrategies.RGBADepthPacking;
        this.depthDispatcher = new MaterialShadingWithDynamicShapeDispatcher(this.depthMaterial);
    }

    destroy() {
        this.depthMaterial.destroy();
        this.aoPassMaterial.destroy();
        this.aoBlurXMaterial.destroy();
        this.aoBlurYMaterial.destroy();
        this.aoComposeMaterial.destroy();
        this.depthDispatcher.destroy();
    }

    updateFrameSize(width: number, height: number) {
        this.aoPassMaterial.setTexelSize(width, height);
        this.aoBlurXMaterial.setTexelSize(width, height);
        this.aoBlurYMaterial.setTexelSize(width, height);
    }
    updateEffect(_scene: SceneAdaptor, isFrameStable: boolean, isCameraStable: boolean, effectConfig: IEffectConfig) {
        this.active = (isFrameStable && isCameraStable) || !effectConfig.isPerformanceSlow;
    }

    updateGraphHash(_hasher: HashKeyBuilder) { }

    updateRenderGraph(graph: RenderGraph, context: PipelineContext) {
        const scene = this.scene;

        this.aoBlurXMaterial.axis = readonlyMath.vec2(1, 0);
        this.aoBlurXMaterial.cameraNear = (scene.camera as PerspectiveCamera).near;
        this.aoBlurXMaterial.cameraFar = (scene.camera as PerspectiveCamera).far;

        this.aoBlurYMaterial.axis = readonlyMath.vec2(0, 1);
        this.aoBlurYMaterial.cameraNear = (scene.camera as PerspectiveCamera).near;
        this.aoBlurYMaterial.cameraFar = (scene.camera as PerspectiveCamera).far;
        const depthPass = pass('depth_pass')
            .useDispatcher(this.depthDispatcher)
            .draw(scene.default);

        const depthResult = target('depth_result_target')
            .from([
                depthPass
            ]);

        if (context.renderingConfig.gpuDriven.enabled && graph.sceneCullingPass) {
            // reuse culling results in forward when driven enabled
            depthPass
                .before(() => {
                    this.drivenShadingMaterial.shadingMode = DrivenShadingMode.DepthShading;
                    this.drivenShadingMaterial.depthPackMode = DepthPackingStrategies.RGBADepthPacking;
                })
                .useDriven(this.drivenShadingMaterial)
                .depend(graph.sceneCullingPass);
        }

        const aoComputeResult = target('ao_compute_target', true, false)
            .from([
                pass('ao_compute_pass')
                    .input('depthMap', depthResult)
                    .before(renderer => {
                        this.aoPassMaterial.cameraInverseProjectionMatrix = new Matrix4().getInverse(scene.camera.projectionMatrix).cloneReadonly();
                        if (TypeAssert.isPerspectiveCamera(scene.camera)) {
                            this.aoPassMaterial.projectionScale = renderer.renderer.renderer.getDrawingBufferSize().height / scene.camera.getPixelsOfDistOne(); // todo
                        } else {
                            this.aoPassMaterial.projectionScale = renderer.renderer.renderer.getDrawingBufferSize().height;
                        }
                    })
                    .use(drawQuad(this.aoPassMaterial)),
            ]);

        const blurredX = target('blurred_x_target', true, false)
            .from([
                pass('blur_x_pass')
                    .input('map', aoComputeResult)
                    .input('depthMap', depthResult)
                    .use(drawQuad(this.aoBlurXMaterial)),
            ]);
        const blurredY = target('blurred_y_target', true, false)
            .from([
                pass('blur_y_pass')
                    .input('map', blurredX)
                    .input('depthMap', depthResult)
                    .use(drawQuad(this.aoBlurYMaterial)),
            ]);

        graph.addPass([
            pass('ao_compose_pass')
                .disableClear()
                .input('tDiffuse', blurredY)
                .use(drawQuad(this.aoComposeMaterial)),
        ]);
    }

    createConfig() {
        return {
            enabled: {
                get: () => this._enabled,
                set: (v: boolean) => {
                    this._enabled = v;
                },
            },
            aoBias: {
                get: () => this.aoPassMaterial.bias,
                set: (v: number) => { this.aoPassMaterial.bias = v; },
            },
            aoRadius: {
                get: () => this.aoPassMaterial.radius,
                set: (v: number) => { this.aoPassMaterial.radius = v; },
            },
            blurKernelRadius: {
                get: () => this.aoBlurXMaterial.radius,
                set: (v: number) => {
                    this.aoBlurXMaterial.radius = v;
                    this.aoBlurYMaterial.radius = v;
                },
            },
            blurEdgeSharpness: {
                get: () => this.aoBlurXMaterial.edgeSharpness,
                set: (v: number) => {
                    this.aoBlurXMaterial.edgeSharpness = v;
                    this.aoBlurYMaterial.edgeSharpness = v;
                },
            },
            aoIntensity: {
                get: () => this.aoPassMaterial.intensity,
                set: (v: number) => { this.aoPassMaterial.intensity = v; },
            },
        };
    }
}
