import type { BufferGeometry } from '../../elements/geometries/containers/BufferGeometry.js';
import type { Material } from '../../elements/materials/Material.js';
import { OutlineEncodeMaterial } from '../../elements/materials/mesh/OutlineEncodeMaterial.js';
import { OutlineComputeMaterial } from '../../elements/materials/quad/OutlineComputeMaterial.js';
import type { Color } from '../../math/Color.js';
import { MaterialShadingWithDynamicShapeDispatcher } from '../../renderer/MaterialDispatcher.js';
import type { Renderer } from '../../renderer/Renderer.js';
import type { WGLProgram } from '../../renderer/webgl/WGLProgram.js';
import { pass, target, colorAttachment, depthAttachment } from '../../rendergraph/NodeMakers.js';
import type { Drawable } from '../../scene/drawables/Drawable.js';
import { filterBy } from '../../scene/tools/DrawcallList.js';
import { drawQuad, type RendererAdaptor } from '../RendererAdaptor.js';
import { PipelineFilters, PipelineContentBridge } from '../../fx/PipelineAPI.js';
import type { Nullable } from '../../utils/Utils.js';
import { DrivenCullingMaterial } from '../../elements/materials/driven/DrivenCullingMaterial.js';
import { DrivenShadingMaterial, DrivenShadingMode } from '../../elements/materials/driven/DrivenShadingMaterial.js';
import type { RenderTargetNode } from '../../rendergraph/nodes/RenderTargetNode.js';
import { Vector4 } from '../../math/Vector4.js';
import { PipelinePlugin, type PipelineContext } from './PipelinePlugin.js';
import type { HashKeyBuilder } from '../../utils/HashKeyBuilder.js';
import type { RenderGraph } from '../../rendergraph/RenderGraph.js';
import { Platform } from '../../utils/Platform.js';
import type { SceneAdaptorDispatcher } from '../SceneAdaptor.js';
import { OutlineComposeMaterial } from '../../elements/materials/quad/OutlineComposeMaterial.js';
import { TypeAssert } from '../../scene/tools/TypeAssert.js';
import { MeshBasicMaterial } from '../../elements/materials/mesh/MeshBasicMaterial.js';
import { bindRenderSize } from '../../rendergraph/nodes/utils.js';
import { Texture2D } from '../../elements/textures/Texture2D.js';
import { TextureFormat } from '../../elements/textures/types.js';
import type { ShaderComponentRegistry } from '../../scene/ShaderComponentRegistry.js';

export class EncodeDispatcher<
    T extends OutlineEncodeMaterial = OutlineEncodeMaterial,
> extends MaterialShadingWithDynamicShapeDispatcher<T> {
    private encodeId = 1;
    fixMergedPhongEncode: boolean = true;

    className() {
        return 'EncodeDispatcher';
    }

    reset() {
        this.encodeId = 1;
    }

    dispatchKey(r: ShaderComponentRegistry) {
        return super.dispatchKey(r) + (this.material.mergedCounts > 0 ? '1' : '0');
    }

    dispatch(
        renderer: Renderer,
        geometry: BufferGeometry,
        material: Material,
        drawable: Drawable,
    ): Nullable<WGLProgram> {
        this.material.encodeId = this.encodeId;
        this.material.mergedCounts = 0;
        let offset: number = 1;
        if (this.fixMergedPhongEncode && TypeAssert.isMergedMeshPhongMaterial(material)) {
            this.material.mergedCounts = offset = material.dataTexture.width;
        }
        if (TypeAssert.isInstanceMesh(drawable)) {
            offset *= drawable.geometry.instancedCount;
        }
        this.encodeId += offset;

        return super.dispatch(renderer, geometry, material, drawable);
    }
}

export class OutlinePlugin extends PipelinePlugin {
    readonly PLUGIN_NAME = 'outline';
    private OUTLINE_DEPTH_ENABLE =
        this.IS_SUPPORT_DEPTH_TEXTURE && !Platform.getInstance().mobile && !Platform.getInstance().openHarmony;

    private highQuality: boolean = true;
    private enableDepth: boolean = true;
    private outlineMaskEnabled: boolean = false;

    private encoder = new EncodeDispatcher(new OutlineEncodeMaterial());
    private computeMaterial = new OutlineComputeMaterial();
    private outlineMaskDispatcher = new MaterialShadingWithDynamicShapeDispatcher(new MeshBasicMaterial({ color: 0 }));
    private composeMaterial = new OutlineComposeMaterial();

    constructor(scene: SceneAdaptorDispatcher, renderer: RendererAdaptor) {
        super(scene, renderer);
        this.computeMaterial.enableDepth = this.OUTLINE_DEPTH_ENABLE;
    }

    destroy() {
        this.computeMaterial.destroy();
        this.composeMaterial.destroy();
        this.encoder.destroy();
    }

    private width: number;
    private height: number;
    updateFrameSize(width: number, height: number) {
        this.width = width;
        this.height = height;
        const ratio = this.highQuality ? 2 : 1;
        this.computeMaterial.setTexelSize(width * ratio, height * ratio);
        this.composeMaterial.setTexelSize(width * ratio, height * ratio);
    }
    updateEffect() {}

    updateGraphHash(hasher: HashKeyBuilder) {
        hasher.bool(this.highQuality).bool(this.computeMaterial.enableDepth);
    }

    notifyChanged() {
        this.computeMaterial.depthMap = null;
        this.computeMaterial.indexNormalMap = Texture2D.default;
        this.composeMaterial.tDiffuse = Texture2D.default;
    }

    private drivenCullingMaterial = new DrivenCullingMaterial();
    private drivenShadingMaterial = new DrivenShadingMaterial();
    updateRenderGraph(graph: RenderGraph, context: PipelineContext, depthPyramid: RenderTargetNode) {
        const scene = this.scene;

        const resizeRender = bindRenderSize(this.highQuality ? 2 : 1);
        const encodeTargetDepthAttachment = depthAttachment('outline_encode_target_depth');
        const encodeTarget = target('outline_encode_target', true, false)
            .modify(node => node.attach(encodeTargetDepthAttachment))
            .resize(resizeRender)
            .from([
                pass('clear').use(() => {}),
                context.renderingConfig.gpuDriven.enabled
                    ? pass('outline_encode_culling_pass')
                          .disableClear()
                          .before(() => this.drivenCullingMaterial.update(context.drivenCullingConfig))
                          .useDriven(this.drivenCullingMaterial)
                          .input('depthPyramid', depthPyramid)
                          .draw(filterBy(scene.default, PipelineFilters.isOutlineEncode))
                    : undefined,
                pass('outline_encode_pass')
                    .disableClear()
                    .useDispatcher(this.encoder)
                    .useDriven(this.drivenShadingMaterial)
                    .before(() => {
                        this.drivenShadingMaterial.shadingMode = DrivenShadingMode.OutlineEncode;
                        this.encoder.reset();
                    })
                    .draw(filterBy(scene.default, PipelineFilters.isOutlineEncode)),
            ]);

        const outlineCompute = pass('outline_compute_pass')
            .before(() => this.computeMaterial.cameraInverseProjectionMatrix.copy(scene.camera.projectionMatrixInverse))
            .input('indexNormalMap', encodeTarget)
            .use(drawQuad(this.computeMaterial));
        const outlineComputeTargetColor = colorAttachment('outline_compute_target_color');
        outlineComputeTargetColor.format = this.IS_WEBGL2 ? TextureFormat.R8Unorm : TextureFormat.Rgba8Unorm;
        const outlineComputeTarget = target('outline_compute_target', false, false)
            .modify(node => node.attach(outlineComputeTargetColor))
            .resize(resizeRender)
            .from(outlineCompute);
        if (this.computeMaterial.enableDepth) {
            outlineCompute.input('depthMap', encodeTarget, 'depth');
        }

        let outlineComposePass = pass('outline_compose_pass')
            .disableClear()
            .use(drawQuad(this.composeMaterial))
            .input('tDiffuse', outlineComputeTarget);
        if (this.outlineMaskEnabled) {
            const outlineMaskTarget = target('outline_mask_target', false, false)
                .modify(node => {
                    node.attach(outlineComputeTargetColor);
                    node.attach(encodeTargetDepthAttachment);
                })
                .from([
                    context.renderingConfig.gpuDriven.enabled
                        ? pass('outline_mask_culling_pass')
                              .depend(outlineComputeTarget)
                              .disableClear()
                              .before(() => this.drivenCullingMaterial.update(context.drivenCullingConfig))
                              .useDriven(this.drivenCullingMaterial)
                              .draw(filterBy(scene.default, PipelineFilters.isOutlineDisable))
                        : undefined,
                    pass('outline_mask_pass')
                        .depend(outlineComputeTarget)
                        .disableClear()
                        .before(() => {
                            this.drivenShadingMaterial.shadingMode = DrivenShadingMode.OutlineMaskShading;
                        })
                        .useDriven(this.drivenShadingMaterial)
                        .useDispatcher(this.outlineMaskDispatcher)
                        .draw(filterBy(scene.default, PipelineFilters.isOutlineDisable)),
                ]);
            outlineComposePass = pass('outline_compose_pass')
                .disableClear()
                .use(drawQuad(this.composeMaterial))
                .input('tDiffuse', outlineMaskTarget);
        }

        graph.addPass(outlineComposePass);
    }

    createConfig() {
        return {
            enabled: {
                get: () => this._enabled,
                set: (v: boolean) => {
                    this._enabled = v;
                },
            },
            useMrt: {
                get: () => false,
                set: (_: boolean) => {},
            },
            fixMergedPhongEncode: {
                get: () => this.encoder.fixMergedPhongEncode,
                set: (v: boolean) => {
                    this.encoder.fixMergedPhongEncode = v;
                    PipelineContentBridge.materialDispatcherUpdate(this.encoder);
                },
            },
            highQuality: {
                get: () => this.highQuality,
                set: (v: boolean) => {
                    this.composeMaterial.highQuality = this.computeMaterial.highQuality = this.highQuality = v;
                    this.updateFrameSize(this.width, this.height);
                    this.computeMaterial.enableDepth = v && this.OUTLINE_DEPTH_ENABLE && this.enableDepth;
                    this.computeMaterial.depthMap = null;
                    this.computeMaterial.notifyRecompileShader();
                    this.composeMaterial.notifyRecompileShader();
                },
            },
            enableDepth: {
                get: () => this.enableDepth,
                set: (v: boolean) => {
                    this.enableDepth = v;
                    this.computeMaterial.enableDepth = v && this.OUTLINE_DEPTH_ENABLE && this.highQuality;
                    this.computeMaterial.depthMap = null;
                    this.computeMaterial.notifyRecompileShader();
                },
            },
            outlineMaskEnabled: {
                get: () => this.outlineMaskEnabled,
                set: (v: boolean) => {
                    this.outlineMaskEnabled = v;
                },
            },
            outlineColor: {
                get: () => this.composeMaterial.color.clone(),
                set: (v: Color) => {
                    this.composeMaterial.color = v.cloneReadonly();
                },
            },
            edgeThickness: {
                get: () => this.computeMaterial.edgeThickness.w,
                set: (v: number) => {
                    this.computeMaterial.edgeThickness = new Vector4(v, v, v, v).round();
                    this.computeMaterial.notifyRecompileShader();
                },
            },
            indexEdgeThickness: {
                get: () => this.computeMaterial.edgeThickness.x,
                set: (v: number) => {
                    this.computeMaterial.edgeThickness = this.computeMaterial.edgeThickness.clone().setX(v).round();
                    this.computeMaterial.notifyRecompileShader();
                },
            },
            normalEdgeThickness: {
                get: () => this.computeMaterial.edgeThickness.y,
                set: (v: number) => {
                    this.computeMaterial.edgeThickness = this.computeMaterial.edgeThickness.clone().setY(v).round();
                    this.computeMaterial.notifyRecompileShader();
                },
            },
            depthEdgeThickness: {
                get: () => this.computeMaterial.edgeThickness.z,
                set: (v: number) => {
                    this.computeMaterial.edgeThickness = this.computeMaterial.edgeThickness.clone().setZ(v).round();
                    this.computeMaterial.notifyRecompileShader();
                },
            },
            coefficient: {
                get: () => this.computeMaterial.coefficient.w,
                set: (v: number) => {
                    this.computeMaterial.coefficient = new Vector4(v, v, v, v);
                },
            },
            indexCoefficient: {
                get: () => this.computeMaterial.coefficient.x,
                set: (v: number) => {
                    this.computeMaterial.coefficient = this.computeMaterial.coefficient.clone().setX(v);
                },
            },
            normalCoefficient: {
                get: () => this.computeMaterial.coefficient.y,
                set: (v: number) => {
                    this.computeMaterial.coefficient = this.computeMaterial.coefficient.clone().setY(v);
                },
            },
            depthCoefficient: {
                get: () => this.computeMaterial.coefficient.z,
                set: (v: number) => {
                    this.computeMaterial.coefficient = this.computeMaterial.coefficient.clone().setZ(v);
                },
            },
        };
    }
}
