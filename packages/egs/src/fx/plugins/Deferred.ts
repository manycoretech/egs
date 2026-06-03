import { target, pass, disableClear, when, colorAttachment, depthAttachment } from '../../rendergraph/NodeMakers';
import { drawPoint, drawQuad, type RendererAdaptor } from '../RendererAdaptor';
import { type ShaderBuilder, ShaderInjectionTypes } from '../../renderer/shader/builders/ShaderBuilder';
import type { ShaderComponentRegistry } from '../../scene/ShaderComponentRegistry';
import type { WGLProgram } from '../../renderer/webgl/WGLProgram';
import { Side, Blending, BlendingFactor, BlendingEquation } from '../../utils/Constants';
import { DeferredDispatcher, DynamicForwardLightsDispatcher } from '../../renderer/MaterialDispatcher';
import { PassQuadMaterialBase } from '../../elements/materials/quad/PassMaterialBase';
import { WebGLShaderDataType } from '../../renderer/webgl/WGLConstants';
import { directionalLightInclude, DirectionalLight } from '../../scene/lights/DirectionalLight';
import { AreaBlinnPhong, DiskAreaBlinnPhong, MeshPhongMaterial, RectAreaBlinnPhong } from '../../elements/materials/mesh/MeshPhongMaterial';
import { ShaderBlockPool } from '../../renderer/shader/builders/ShaderBlockPool';
import { Vector4 } from '../../math/Vector4';
import { CopyMaterial, CopyDepthMaterial, CopyColorAndDepthMaterial } from '../../elements/materials/quad/CopyMaterial';
import type { AmbientLight } from '../../scene/lights/AmbientLight';
import { SpotLight, spotLightInclude } from '../../scene/lights/SpotLight';
import { PointLight, punctualLightIntensityToIrradianceFactor } from '../../scene/lights/PointLight';
import { RectAreaLight } from '../../scene/lights/RectAreaLight';
import type { RenderTarget } from '../../elements/textures/RenderTarget';
import { DiskAreaLight } from '../../scene/lights/DiskAreaLight';
import type { Matrix4, ReadonlyMatrix4 } from '../../math/Matrix4';
import {
    DialuxLuminanceMaterial, DialuxWhiteBalanceExposureMaterial, ExposedCopyMaterial, ExposedToneMappingMaterial,
    HistogramComputeMaterial, AvgLuminanceMaterial
} from '../../elements/materials/quad/ExposedCopyMaterial';
import { createShaderBlock } from '../../renderer/shader/builders/ShaderBlock';
import { PipelineFilters } from '../PipelineAPI';
import { materialProperty } from '../../ContentAPI';
import { readonlyMath } from '../../math/Readonly';
import { Quad } from '../../scene/renderables/Quad';
import { PseudoColorMaterial } from '../../elements/materials/quad/PseudoColorMaterial';
import { Capabilities } from '../../renderer/Capabilities';
import { PipelinePlugin, type PipelineContext } from './PipelinePlugin';
import type { HashKeyBuilder } from '../../utils/HashKeyBuilder';
import type { RenderGraph } from '../../rendergraph/RenderGraph';
import { filterBy, RenderObjectsType } from '../../scene/tools/DrawcallList';
import type { SceneAdaptorDispatcher } from '../SceneAdaptor';
import { DrivenCullingMaterial } from '../../elements/materials/driven/DrivenCullingMaterial';
import { DrivenShadingMaterial, DrivenShadingMode } from '../../elements/materials/driven/DrivenShadingMaterial';
import type { PassNode } from '../../rendergraph/nodes/PassNode';
import { MixOITMaterial } from '../../elements/materials/quad/MixOITMaterial';
import { BACKGROUND_SHADING_PASS_NAME } from './Background';
import { ForwardDispatcher } from './Forward';
import type { RenderTargetNode } from '../../rendergraph/nodes/RenderTargetNode';
import { RendererBackend } from '../../renderer/IRenderer';
import { PipelineContentBridge } from '../PipelineAPI.impl';
import type { Camera3D } from '../../scene/cameras/Camera3D';
import { Vector3, type ReadonlyVector3 } from '../../math/Vector3';
import { TypeAssert } from '../../scene/tools/TypeAssert';
import { logger } from '../../utils/Logger';
import type { Texture } from '../../elements/textures/Texture';
import { TextureFormat } from '../../elements/textures/types';

interface DeferredCameraUniforms {
    position?: ReadonlyVector3;
    rotationMatrix?: ReadonlyMatrix4;
    projectionInverseMatrix?: ReadonlyMatrix4;
    far?: number;
    near?: number;
    isCubeView?: boolean,
}

function updateDeferredCameraUniforms(material: DeferredCameraUniforms, camera: Camera3D, isCubeView: boolean = false) {
    material.isCubeView = isCubeView;
    if (material.rotationMatrix) {
        material.rotationMatrix = camera.worldRotation.cloneReadonly();
    }
    if (material.projectionInverseMatrix) {
        material.projectionInverseMatrix = camera.projectionMatrixInverse.cloneReadonly();
    }
    if (material.position) {
        material.position = camera.getWorldPosition(new Vector3()).cloneReadonly();
    }
    if (TypeAssert.isPerspectiveCamera(camera)) {
        if (material.far) {
            material.far = camera.far;
        }
        if (material.near) {
            material.near = camera.near;
        }
    } else {
        logger.warn('DeferredRender: only support perspective camera.');
    }
}

const RESOLUTION_NUMBER = 128;
export class DeferredPlugin extends PipelinePlugin {
    readonly PLUGIN_NAME = 'deferred';

    private mixOITMaterial = new MixOITMaterial();

    isAutoExposedEnabled: boolean = false;
    private keyMinuend: number = 1.3;
    private result = new DeferredResult();
    private dispatcher = new DeferredDispatcher();
    private forwardDispatcher = new ForwardDispatcher(undefined, undefined, undefined, true);
    private dynamicLightsDispatcher = new DynamicForwardLightsDispatcher();
    private copier = new CopyMaterial();
    private copyMaterial = new CopyColorAndDepthMaterial();

    private enableWhiteBalance = false;
    private dialuxLuminance = new DialuxLuminanceMaterial();
    private dialuxWhiteBalanceExposure = new DialuxWhiteBalanceExposureMaterial();

    private drivenEnabled = false;

    private _enablePseudoColor = false;
    private get enablePseudoColor() {
        return this._enablePseudoColor;
    }
    private set enablePseudoColor(v) {
        this._enablePseudoColor = v;
        this.dispatcher.forceOpaque = v;
        PipelineContentBridge.materialDispatcherCreate(this.dispatcher);
    }

    private _decodeSrgb = false;
    private get decodeSrgb() {
        return this._decodeSrgb;
    }
    private set decodeSrgb(v) {
        this._decodeSrgb = v;
        this.dispatcher.decodeSrgb = v;
        PipelineContentBridge.materialDispatcherCreate(this.dispatcher);
    }

    private pseudoColorMaterial = new PseudoColorMaterial();

    private exposedCopier = new ExposedCopyMaterial();
    private exposedToneMappingCopier = new ExposedToneMappingMaterial();
    private histogramComputeMaterial = new HistogramComputeMaterial();
    private avgLuminanceMaterial = new AvgLuminanceMaterial();
    private depthCopier = new CopyDepthMaterial();

    private deferredDirectionalLightMaterial = new DeferredDrawDirectionalLightMaterial();
    private deferredSpotLightMaterial = new DeferredDrawSpotLightMaterial();
    private deferredPointLightMaterial = new DeferredDrawPointLightMaterial();
    private deferredAmbientLightMaterial = new DeferredDrawAmbientLightMaterial();
    private deferredRectAreaLightMaterial = new DeferredDrawRectAreaLightMaterial();
    private deferredDiskAreaLightMaterial = new DeferredDrawDiskAreaLightMaterial();
    private drivenCullingMaterial = new DrivenCullingMaterial();
    private drivenShadingMaterial = new DrivenShadingMaterial();

    private deferredQuad = new Quad();

    constructor(scene: SceneAdaptorDispatcher, renderer: RendererAdaptor) {
        super(scene, renderer);
        this.histogramComputeMaterial.configBlend();
        this.avgLuminanceMaterial.configBlend();
        this.dialuxLuminance.configBlend();
        this.histogramComputeMaterial.sampleResolution = RESOLUTION_NUMBER;
        this.histogramComputeMaterial.textureResolutionX = RESOLUTION_NUMBER;
        this.deferredDirectionalLightMaterial.result = this.result;
        this.deferredSpotLightMaterial.result = this.result;
        this.deferredPointLightMaterial.result = this.result;
        this.deferredAmbientLightMaterial.result = this.result;
        this.deferredRectAreaLightMaterial.result = this.result;
        this.deferredDiskAreaLightMaterial.result = this.result;
        this.enablePseudoColor = false; // trigger necessary setter
    }

    get envSupported() {
        return this.renderer.renderer.backend !== RendererBackend.WEBGL_JS;
    }

    destroy() {
        this.deferredQuad.destroy();
        this.copier.destroy();
        this.depthCopier.destroy();
        this.deferredDirectionalLightMaterial.destroy();
        this.deferredSpotLightMaterial.destroy();
        this.deferredPointLightMaterial.destroy();
        this.deferredAmbientLightMaterial.destroy();
        this.deferredRectAreaLightMaterial.destroy();
        this.deferredDiskAreaLightMaterial.destroy();
        this.dispatcher.destroy();
    }

    updateFrameSize() { }
    updateEffect() { }

    updateGraphHash(hasher: HashKeyBuilder) {
        hasher
            .bool(this.isAutoExposedEnabled)
            .bool(this.enableWhiteBalance)
            .bool(this.enablePseudoColor)
            .bool(this.drivenEnabled);
    }

    private createOitPass(
        graph: RenderGraph,
        opaquePassList: PassNode[],
        drivenPass: PassNode,
    ): PassNode[] {
        const scene = this.scene;
        const background = graph.removePass(BACKGROUND_SHADING_PASS_NAME);
        opaquePassList = [...(background ? [background] : []), ...opaquePassList];

        const opaqueTargetDepthAttachment = depthAttachment('opaque_target_depth');
        opaqueTargetDepthAttachment.enableStencil = false;
        const opaqueTarget = target('opaque_target', true, false)
            .modify(node => node.attach(opaqueTargetDepthAttachment))
            .from(opaquePassList);

        graph.depthTarget = opaqueTarget;
        const oitPass = pass('accum_oit_pass')
            .enableClear(true, false)
            .depend(opaqueTarget)
            .depend(drivenPass)
            .setClearColor(new Vector4(0, 0, 0, 1))
            .useDispatcher(this.forwardDispatcher)
            .useDriven(this.drivenShadingMaterial)
            .useIf(() => !this.enablePseudoColor, renderer => scene.OIT().render(renderer.renderer, RenderObjectsType.OIT, PipelineFilters.isDeferTransparent(this.enablePseudoColor)))
            .before(() => {
                this.drivenShadingMaterial.oitEncode = true;
                this.drivenShadingMaterial.shadingMode = DrivenShadingMode.PhongShading;
                this.forwardDispatcher.oitEnabled = true;
                this.forwardDispatcher.update();
            })
            .after(() => {
                this.drivenShadingMaterial.oitEncode = false;
                this.forwardDispatcher.oitEnabled = false;
                this.forwardDispatcher.update();
            });

        const oitTarget = target('oit_target', false, false)
            .modify(node => {
                const color0 = colorAttachment('oit_target-color0');
                color0.format = TextureFormat.Rgba16Float;
                node.attach(color0);
                const color1 = colorAttachment('oit_target-color1');
                color1.format = TextureFormat.R16Float;
                node.attach(color1);
                node.attach(opaqueTargetDepthAttachment);
            })
            .from(oitPass);

        return [
            pass('copy_opaque_pass')
                .enableClear(false, true)
                .input('tDiffuse', opaqueTarget)
                .input('depth', opaqueTarget, 'depth')
                .use(drawQuad(this.copyMaterial)),
            pass('before_oit_pass')
                .disableClear()
                .useDispatcher(this.dynamicLightsDispatcher)
                .draw(scene.OIT),
            pass('mix_oit_pass')
                .disableClear()
                .input('accumColor', oitTarget, 0)
                .input('accumAlpha', oitTarget, 1)
                .use(drawQuad(this.mixOITMaterial)),
            pass('after_oit_pass')
                .disableClear()
                .useDispatcher(this.dynamicLightsDispatcher)
                .use(renderer => scene.OIT().render(renderer.renderer, RenderObjectsType.AfterOIT)),
        ];
    }

    updateRenderGraph(graph: RenderGraph, context: PipelineContext, depthPyramid: RenderTargetNode) {
        const scene = this.scene;
        const { enabled: drivenEnabled } = context.renderingConfig.gpuDriven;
        this.drivenEnabled = drivenEnabled;

        const drivenPass = pass('deferred-culling')
            .disableClear()
            .before(() => {
                this.drivenCullingMaterial.update(context.drivenCullingConfig);
            })
            .useDriven(this.drivenCullingMaterial)
            .input('depthPyramid', depthPyramid)
            .draw(scene.default);
        graph.sceneCullingPass = drivenPass;

        const renderObjectsType = this.enablePseudoColor ? RenderObjectsType.Default : RenderObjectsType.Opaque;
        // opaque pass
        const defer_scene_pass = pass('mrt-opaque-pass')
            .useDispatcher(this.dispatcher)
            .use((renderer, target: RenderTarget) => {
                scene.default().render(renderer.renderer, renderObjectsType, PipelineFilters.isDeferPhong(this.enablePseudoColor));
                this.result.normal = target.colors[0];
                this.result.color = target.colors[1];
                this.result.other = target.colors[2];
                this.result.depth = target.depth!;
            });

        if (drivenEnabled) {
            defer_scene_pass.useDriven(this.drivenShadingMaterial)
                .before(() => {
                    this.drivenShadingMaterial.shadingMode = DrivenShadingMode.DeferredEncode;
                    this.drivenShadingMaterial.decodeSrgb = this._decodeSrgb;
                })
                .after(() => this.drivenShadingMaterial.shadingMode = DrivenShadingMode.PhongShading);
        }

        const mrt = target('deferred-mrt', false)
            .modify(node => {
                const color0 = colorAttachment('deferred-mrt-color-0');
                color0.format = TextureFormat.Rgb10a2Unorm;
                node.attach(color0);
                const color1 = colorAttachment('deferred-mrt-color-1');
                node.attach(color1);
                const color2 = colorAttachment('deferred-mrt-color-2');
                node.attach(color2);
            })
            .keepContent()
            .from([
                pass('clear')
                    .setClearColor(new Vector4(0, 0, 0, 0))
                    .use(() => { }),
                when(drivenEnabled, drivenPass),
                defer_scene_pass,
            ]);

        const lightCompute = pass('mrt-light-pass')
            .depend(mrt)
            .setClearColor(new Vector4(0, 0, 0, 0))
            .use({
                config: adp => this.deferredQuad.config(adp.renderer),
                render: adp => {
                    const lights = scene.scene.shaderComponentRegistry.light;
                    lights.attachMaterial(this.deferredAmbientLightMaterial);
                    lights.attachMaterial(this.deferredDirectionalLightMaterial);
                    lights.attachMaterial(this.deferredPointLightMaterial);
                    lights.attachMaterial(this.deferredSpotLightMaterial);
                    lights.attachMaterial(this.deferredDiskAreaLightMaterial);
                    lights.attachMaterial(this.deferredRectAreaLightMaterial);

                    const camera = adp.renderer.getCurrentCamera();
                    const matrixViewInverse = camera.matrixWorld;
                    const matrixWorldInverse = camera.matrixWorldInverse;
                    const matrixProjInverse = camera.projectionMatrixInverse;

                    if (lights.directionalLights.length) {
                        this.deferredDirectionalLightMaterial.setProjInverse(matrixProjInverse);
                        updateDeferredCameraUniforms(this.deferredDirectionalLightMaterial, camera);
                        this.deferredQuad.renderDeferredWithMaterial(adp.renderer, scene.scene, lights.directionalLights, this.deferredDirectionalLightMaterial, (l: DirectionalLight) => {
                            l.viewMatrix.copy(matrixWorldInverse);
                            l.invViewMatrix.copy(matrixViewInverse);
                            if (this.deferredDirectionalLightMaterial.light && this.deferredDirectionalLightMaterial.light.shadow.enabled !== l.shadow.enabled) {
                                this.deferredDirectionalLightMaterial.notifyRecompileShader();
                            }
                            this.deferredDirectionalLightMaterial.light = l;
                        });
                    }

                    if (lights.spotLights.length) {
                        this.deferredSpotLightMaterial.setProjInverse(matrixProjInverse);
                        updateDeferredCameraUniforms(this.deferredSpotLightMaterial, camera);
                        this.deferredQuad.renderDeferredWithMaterial(adp.renderer, scene.scene, lights.spotLights, this.deferredSpotLightMaterial, (l: SpotLight) => {
                            l.viewMatrix.copy(matrixWorldInverse);
                            l.invViewMatrix.copy(matrixViewInverse);
                            if (this.deferredSpotLightMaterial.light && this.deferredSpotLightMaterial.light.shadow.enabled !== l.shadow.enabled) {
                                this.deferredSpotLightMaterial.notifyRecompileShader();
                            }
                            this.deferredSpotLightMaterial.light = l;
                        });
                    }

                    if (lights.pointLights.length) {
                        this.deferredPointLightMaterial.setProjInverse(matrixProjInverse);
                        updateDeferredCameraUniforms(this.deferredPointLightMaterial, camera);
                        this.deferredQuad.renderDeferredWithMaterial(adp.renderer, scene.scene, lights.pointLights, this.deferredPointLightMaterial, (l: PointLight) => {
                            l.viewMatrix.copy(matrixWorldInverse);
                            l.invViewMatrix.copy(matrixViewInverse);
                            if (this.deferredPointLightMaterial.light && this.deferredPointLightMaterial.light.shadow.enabled !== l.shadow.enabled) {
                                this.deferredPointLightMaterial.notifyRecompileShader();
                            }
                            this.deferredPointLightMaterial.light = l;
                        });
                    }

                    if (lights.rectAreaLights.length) {
                        this.deferredRectAreaLightMaterial.setProjInverse(matrixProjInverse);
                        updateDeferredCameraUniforms(this.deferredRectAreaLightMaterial, camera);
                        this.deferredQuad.renderDeferredWithMaterial(adp.renderer, scene.scene, lights.rectAreaLights, this.deferredRectAreaLightMaterial, (l: RectAreaLight) => {
                            this.deferredRectAreaLightMaterial.light = l;
                        });
                    }

                    if (lights.diskAreaLights.length) {
                        this.deferredDiskAreaLightMaterial.setProjInverse(matrixProjInverse);
                        updateDeferredCameraUniforms(this.deferredDiskAreaLightMaterial, camera);
                        this.deferredQuad.renderDeferredWithMaterial(adp.renderer, scene.scene, lights.diskAreaLights, this.deferredDiskAreaLightMaterial, (l: DiskAreaLight) => {
                            this.deferredDiskAreaLightMaterial.light = l;
                        });
                    }

                    if (lights.ambientLight) {
                        this.deferredAmbientLightMaterial.setProjInverse(matrixProjInverse);
                        updateDeferredCameraUniforms(this.deferredAmbientLightMaterial, camera);
                        this.deferredAmbientLightMaterial.light = lights.ambientLight;
                        this.deferredQuad.renderDeferredWithMaterial(adp.renderer, scene.scene, [lights.ambientLight], this.deferredAmbientLightMaterial);
                    }
                }
            });

        const lights = target('deferred-lights', false, false)
            .modify(node => {
                const color = colorAttachment('deferred-lights-color');
                color.format = TextureFormat.Rgba16Float;
                node.attach(color);
            })
            .from(lightCompute);

        let result: RenderTargetNode;
        if (this.enablePseudoColor) {
            result = target('deferred-result', true, false)
                .from([
                    pass('pseudo_color_compute')
                        .setClearColor(new Vector4(0, 0, 0, 0))
                        .input('hdr', lights)
                        .use(drawQuad(this.pseudoColorMaterial)),
                ]);
        } else if (this.enableWhiteBalance) {
            result = target('deferred-result', true, false)
                .from([
                    pass('deferred-result-pass')
                        .setClearColor(new Vector4(0, 0, 0, 0))
                        .input('hdr', lights)
                        .use(drawQuad(this.dialuxWhiteBalanceExposure)),
                ]);
        } else {
            const avgLuminanceTarget = target('deferred-luminance-target', false, false)
                .modify(node => {
                    const color = colorAttachment('deferred-luminance-target-color');
                    color.format = TextureFormat.Rgba16Float;
                    node.attach(color);
                })
                .resize(() => ({ width: 1, height: 1 }))
                .from([
                    pass('pre-create-target-pass')
                        .disableClear()
                        .use(() => { }),
                ]);;

            if (this.isAutoExposedEnabled) {
                // pass1: compute luminance texture
                const illumination = target('deferred-illumination', false, false)
                    .modify(node => {
                        const color = colorAttachment('deferred-illumination-color');
                        color.format = TextureFormat.Rgba16Float;
                        node.attach(color);
                    })
                    .from([
                        pass('deferred-copy-exposed')
                            .input('tDiffuse', lights)
                            .use(drawQuad(this.exposedCopier)),
                    ]);

                // pass2: generate histogram
                const histogramTarget = target('deferred-histogram', false, false)
                    .modify(node => {
                        const color = colorAttachment('deferred-histogram-color');
                        color.format = TextureFormat.Rgba16Float;
                        node.attach(color);
                    })
                    .resize(() => ({ width: RESOLUTION_NUMBER, height: 1 }))
                    .from([
                        pass('deferred-histogram-compute')
                            .setClearColor(new Vector4(0, 0, 0, 1))
                            .input('tDiffuse', illumination)
                            .use(drawPoint(this.histogramComputeMaterial, RESOLUTION_NUMBER)),
                    ]);

                // pass3: accumulate exposure
                avgLuminanceTarget
                    .from([
                        pass('deferred-average-luminance')
                            .setClearColor(new Vector4(1, 1, 1, 1))
                            .input('tDiffuse', histogramTarget)
                            .use(drawQuad(this.avgLuminanceMaterial)),
                    ]);
            }

            // pass4: compute exposed ldr color
            result = target('deferred-result', true, false)
                .from([
                    pass('deferred-result-pass')
                        .setClearColor(new Vector4(0, 0, 0, 0))
                        .before(() => {
                            this.exposedToneMappingCopier.keyMinuend = this.keyMinuend;
                            this.exposedToneMappingCopier.enableAutoExposure = this.isAutoExposedEnabled;
                        })
                        .input('luminanceTexture', avgLuminanceTarget)
                        .input('tDiffuse', lights)
                        .use(drawQuad(this.exposedToneMappingCopier)),
                ]);
        }
        const passList: PassNode[] = [];

        let opaquePassList = disableClear([
            pass('deferred_copy')
                .input('tDiffuse', result)
                .use(drawQuad(this.copier)),
            pass('deferred_copy_depth')
                .input('depth', mrt, 'depth')
                .use(drawQuad(this.depthCopier)),
            pass('deferred_forward')
                .draw(filterBy(scene.default, PipelineFilters.isNotDeferPhong))]);
        // transparent pass
        let transparentPassList: PassNode[] = [];
        if (drivenEnabled) {
            transparentPassList = this.createOitPass(graph, opaquePassList, drivenPass);
            opaquePassList = [];
        } else {
            // never exec when gpu driven enabled.
            transparentPassList = [
                pass('default_deferred_transparency')
                    .disableClear()
                    .useDispatcher(this.dynamicLightsDispatcher)
                    .draw(filterBy(scene.default, () => PipelineFilters.isDeferTransparent(this.enablePseudoColor))),
            ];
        }

        passList.push(...opaquePassList, ...transparentPassList);
        graph.addPass(passList);
    }

    createConfig() {
        return {
            enabled: {
                get: () => this._enabled,
                set: (v: boolean) => {
                    this._enabled = v;
                }
            },
            enableWhiteBalance: {
                get: () => this.enableWhiteBalance,
                set: (v: boolean) => {
                    this.enableWhiteBalance = v;
                }
            },
            enablePseudoColor: {
                get: () => this.enablePseudoColor,
                set: (v: boolean) => {
                    this.enablePseudoColor = v;
                },
            },
            pseudoColors: {
                get: () => this.pseudoColorMaterial.colors,
                set: (v: number[]) => {
                    this.pseudoColorMaterial.colors = v;
                    this.pseudoColorMaterial.version++;
                    if (this.enablePseudoColor) {
                        this.pseudoColorMaterial.notifyRecompileShader();
                    }
                },
            },
            pseudoGradations: {
                get: () => this.pseudoColorMaterial.gradations,
                set: (v: number[]) => {
                    this.pseudoColorMaterial.gradations = v;
                    this.pseudoColorMaterial.version++;
                    if (this.enablePseudoColor) {
                        this.pseudoColorMaterial.notifyRecompileShader();
                    }
                },
            },
            temperature: {
                get: () => this.dialuxWhiteBalanceExposure.temperature,
                set: (v: number) => {
                    this.dialuxWhiteBalanceExposure.temperature = v;
                },
            },
            autoExposedEnabled: {
                get: () => this.isAutoExposedEnabled,
                set: (v: boolean) => {
                    this.isAutoExposedEnabled = v;
                },
            },
            keyMinuend: {
                get: () => this.keyMinuend,
                set: (v: number) => {
                    this.keyMinuend = v;
                },
            },
            gamma: {
                get: () => this.exposedToneMappingCopier.gamma,
                set: (v: number) => {
                    this.exposedToneMappingCopier.gamma = v;
                },
            },
            multiplier: {
                get: () => this.exposedToneMappingCopier.multiplier,
                set: (v: number) => {
                    this.exposedToneMappingCopier.multiplier = v;
                },
            },
            burnValue: {
                get: () => this.exposedToneMappingCopier.burnValue,
                set: (v: number) => {
                    this.exposedToneMappingCopier.burnValue = v;
                },
            },
            contrast: {
                get: () => this.exposedToneMappingCopier.contrast,
                set: (v: number) => {
                    this.exposedToneMappingCopier.contrast = v;
                },
            },
            decodeSrgb: {
                get: () => this.decodeSrgb,
                set: (v: boolean) => {
                    this.decodeSrgb = v;
                }
            }
        };
    }
}

export class DeferredResult {
    normal: Texture;
    color: Texture;
    other: Texture;
    depth: Texture;

    extendShaderShading(builder: ShaderBuilder) {
        builder
            .addUniform('c1', WebGLShaderDataType.Sampler2D)
            .addUniform('c2', WebGLShaderDataType.Sampler2D)
            .addUniform('c3', WebGLShaderDataType.Sampler2D)
            .addUniform('depth', WebGLShaderDataType.Sampler2D);
    }

    updateUniforms(program: WGLProgram) {
        program.setTexture2D('c1', this.normal);
        program.setTexture2D('c2', this.color);
        program.setTexture2D('c3', this.other);
        program.setTexture2D('depth', this.depth);
    }
}

export abstract class DeferredLightBase<L> extends PassQuadMaterialBase {
    side = Side.DoubleSide;
    result: DeferredResult;
    light: L;

    constructor() {
        super();
        this.blending = Blending.CustomBlending;
        this.blendEquation = BlendingEquation.Add;
        this.blendSrc = BlendingFactor.One;
        this.blendDst = BlendingFactor.One;

        this.blendEquationAlpha = BlendingEquation.Add;
        this.blendSrcAlpha = BlendingFactor.One;
        this.blendDstAlpha = BlendingFactor.One;

        // result is set in DeferredShading constructor
    }

    setResult() {
        this.normal = this.result.normal;
        this.color = this.result.color;
        this.other = this.result.other;
        this.depth = this.result.depth;
    }

    @materialProperty()
    protected normal: Texture;
    @materialProperty()
    protected color: Texture;
    @materialProperty()
    protected other: Texture;
    @materialProperty()
    protected depth: Texture;

    @materialProperty()
    rotationMatrix = readonlyMath.mat4();
    @materialProperty()
    position = readonlyMath.vec3();
    @materialProperty()
    projectionInverseMatrix = readonlyMath.mat4();
    @materialProperty()
    far: number = 2000;
    @materialProperty()
    near: number = 0.01;

    abstract buildLightComputeImpl(): string;
    abstract buildLightShadow(): string;

    private matrixProjInverse: Matrix4;
    setProjInverse(matrixProjInverse: Matrix4) {
        this.matrixProjInverse = matrixProjInverse;
    }

    buildLightCompute() {
        return `
        float depth = texture2D(depth, vUv).x;
        if (depth == 1.) {
            gl_FragColor = vec4(0.0);
            discard;
        }
        GeometricContext geometry;

        float depthReconstruct = depth * 2.0 - 1.0;
        vec4 posReconstruct = projInverse * vec4(vUv * 2.0 - 1.0, depthReconstruct, 1.0);
        vec3 vViewPosition = -posReconstruct.xyz / posReconstruct.w;

        geometry.position = -vViewPosition;
        geometry.normal = decodeNormal(texture2D(c1, vUv).xy);
        geometry.viewDir = normalize( vViewPosition );
        ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );

        ${this.buildLightShadow()}
        ${this.buildLightComputeImpl()}

        vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular;
        gl_FragColor = vec4( outgoingLight, 1.0 );
        `;
    }

    generateShaderKey(registry: ShaderComponentRegistry): string {
        return super.generateShaderKey(registry) + registry.light.onlyDirectLight;
    }

    extendShaderShading(builder: ShaderBuilder, r: ShaderComponentRegistry) {
        builder
            .addFragment(DECODE_NORMAL)
            .addFragment(ShaderBlockPool.LightTransmissionModel)
            .addUniform('projInverse', WebGLShaderDataType.Mat4);

        if (r.light.onlyDirectLight) {
            builder.addFragDefine('#define DEBUG_INCIDENT');
        }

        MeshPhongMaterial.extendDeferredLight(builder);
        this.result.extendShaderShading(builder);
    }

    updateShadingUniforms(program: WGLProgram, _: ShaderComponentRegistry) {
        program.setUniform('projInverse', this.matrixProjInverse);
        this.result.updateUniforms(program);
    }

    className() {
        return 'DeferredLightBase';
    }
}

export class DeferredDrawAmbientLightMaterial extends DeferredLightBase<AmbientLight> {
    className(): string {
        return 'DeferredDrawAmbientLightMaterial';
    }

    buildLightShadow() { return ''; }

    buildLightComputeImpl() {
        return `
        vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
        ${MeshPhongMaterial.constructMaterialFromGBufferForLight()}
        RE_IndirectDiffuse( irradiance, geometry, material, reflectedLight );
        `;
    }

    extendShaderShading(builder: ShaderBuilder, _: ShaderComponentRegistry) {
        super.extendShaderShading(builder, _);
        builder
            .addFragment(directionalLightInclude)
            .addUniform('ambientLightColor', WebGLShaderDataType.Vec3)
            .inject(ShaderInjectionTypes.gl_FragColor, this.buildLightCompute());
    }

    updateShadingUniforms(program: WGLProgram, _: ShaderComponentRegistry) {
        super.updateShadingUniforms(program, _);
        this.light.updateUniforms(program);
    }
}

export class DeferredDrawDirectionalLightMaterial extends DeferredLightBase<DirectionalLight> {
    className(): string {
        return 'DeferredDrawDirectionalLightMaterial';
    }

    generateShaderKey(registry: ShaderComponentRegistry): string {
        return super.generateShaderKey(registry) + this.light.shadow.enabled;
    }

    buildLightComputeImpl() {
        return `
        IncidentLight directLight;
        getDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );
        ${this.light.shadow.enabled ? `
        directLight.color *= getDirectionalShadow(directionalShadowMap, directionalLightShadowsInfo.shadowMapSize, directionalLightShadowsInfo.shadowBias, directionalLightShadowsInfo.shadowRadius, directionalShadowCoord, directionalLightShadowsInfo.shadowIntensity);
        `: ''}
        ${MeshPhongMaterial.constructMaterialFromGBufferForLight()}
        RE_Direct(directLight, geometry, material, reflectedLight);
        `;
    }

    buildLightShadow() {
        if (this.light.shadow.enabled) {
            return `
                // Offsetting the position used for querying occlusion along the world normal can be used to reduce shadow acne.
                vec3 directionalShadowWorldNormal = inverseTransformDirection(geometry.normal, viewMatrix);
                vec4 directionalShadowWorldPosition;
                vec4 worldPosition = invViewMatrix * vec4(-vViewPosition, 1.0);
                directionalShadowWorldPosition = worldPosition + vec4(directionalShadowWorldNormal * directionalLightShadowsInfo.shadowNormalBias, 0);
                vec4 directionalShadowCoord = directionalLightShadowsInfo.shadowMatrix * directionalShadowWorldPosition;
            `;
        } else {
            return '';
        }
    }

    extendShaderShading(builder: ShaderBuilder, _: ShaderComponentRegistry) {
        super.extendShaderShading(builder, _);
        if (this.light.shadow.enabled) {
            this.light.shadow.extendsShaderDeferred(builder);
        }
        builder
            .addFragment(directionalLightInclude)
            .addFragmentCustom(DirectionalLight.getHeader(false))
            .when(this.light.shadow.enabled, (builder) => builder.addUniform('viewMatrix', WebGLShaderDataType.Mat4))
            .when(this.light.shadow.enabled, (builder) => builder.addUniform('invViewMatrix', WebGLShaderDataType.Mat4))
            .inject(ShaderInjectionTypes.gl_FragColor, this.buildLightCompute());
    }

    updateShadingUniforms(program: WGLProgram, _: ShaderComponentRegistry) {
        super.updateShadingUniforms(program, _);
        this.light.updateUniformForDefer(program);
    }
}
export class DeferredDrawPointLightMaterial extends DeferredLightBase<PointLight> {
    className(): string {
        return 'DeferredDrawPointLightMaterial';
    }

    generateShaderKey(registry: ShaderComponentRegistry): string {
        return super.generateShaderKey(registry) + this.light.shadow.enabled;
    }

    buildLightComputeImpl() {
        return `
        IncidentLight directLight;
        vec3 iesWorldCoord = vec3(invViewMatrix * vec4(-vViewPosition, 1.0));
        getPointDirectLightIrradiance(pointLightIES, pointLight, geometry, iesWorldCoord, directLight);
        if (!directLight.visible) {
            discard;
        }
        ${this.light.shadow.enabled ? `
            float depthValue;
            vec3 origin = (pointShadowWorldCoord.xyz - pointLight.worldPosition);
            vec3 originAbs = abs(origin);
            vec3 directionAbs = normalize(originAbs);

            float c = - (pointLightShadowsInfo.shadowCameraFar + pointLightShadowsInfo.shadowCameraNear) / (pointLightShadowsInfo.shadowCameraFar - pointLightShadowsInfo.shadowCameraNear);
            float d = - 2.0 * pointLightShadowsInfo.shadowCameraFar * pointLightShadowsInfo.shadowCameraNear / (pointLightShadowsInfo.shadowCameraFar - pointLightShadowsInfo.shadowCameraNear);

            float h = step(directionAbs.y, directionAbs.x) * step(directionAbs.z, directionAbs.x);
            float j = step(directionAbs.x, directionAbs.y) * step(directionAbs.z, directionAbs.y);
            float k = step(directionAbs.x, directionAbs.z) * step(directionAbs.y, directionAbs.z);

            depthValue = h * (-abs(origin.x) * c + d) / abs(origin.x) + j * (-abs(origin.y) * c + d) / abs(origin.y) + k * (-abs(origin.z) * c + d) / abs(origin.z);
            depthValue = clamp(depthValue * 0.5 + 0.5, 0.0, 1.0);
            directLight.color *= getPointShadow(pointShadowMap,
                                pointLightShadowsInfo.shadowBias,
                                pointShadowWorldCoord - vec4(pointLight.worldPosition, 0.0),
                                depthValue,
                                pointLightShadowsInfo.shadowIntensity);
        `: ''}
         ${MeshPhongMaterial.constructMaterialFromGBufferForLight()}
        RE_Direct(directLight, geometry, material, reflectedLight);
        `;
    }

    buildLightShadow() {
        if (this.light.shadow.enabled) {
            return `
                // Offsetting the position used for querying occlusion along the world normal can be used to reduce shadow acne.
                vec3 pointShadowWorldNormal = inverseTransformDirection(geometry.normal, viewMatrix);
                vec4 pointShadowWorldPosition;

                vec4 worldPosition = invViewMatrix * vec4(-vViewPosition, 1.0);
                pointShadowWorldPosition = worldPosition + vec4(pointShadowWorldNormal * pointLightShadowsInfo.shadowNormalBias, 0);
                vec4 pointShadowWorldCoord = pointShadowWorldPosition;
            `;
        } else {
            return '';
        }
    }

    extendShaderShading(builder: ShaderBuilder, _: ShaderComponentRegistry) {
        super.extendShaderShading(builder, _);
        if (this.light.shadow.enabled) {
            this.light.shadow.extendsShaderDeferred(builder);
        }
        const IESLightEffect = Capabilities.IS_WEBGL2 ? ShaderBlockPool.IESLightEffect : ShaderBlockPool.IESLightEffectMock;
        builder
            .addFragment(punctualLightIntensityToIrradianceFactor)
            .addFragment(IESLightEffect)
            .addFragment(PointLight.getShaderInclude())
            .addFragmentCustom(PointLight.getHeader(false))
            .addUniform('invViewMatrix', WebGLShaderDataType.Mat4)
            .when(this.light.shadow.enabled, (builder) => builder.addUniform('viewMatrix', WebGLShaderDataType.Mat4))
            .inject(ShaderInjectionTypes.gl_FragColor, this.buildLightCompute());
    }

    updateShadingUniforms(program: WGLProgram, _: ShaderComponentRegistry) {
        super.updateShadingUniforms(program, _);
        this.light.updateUniformForDefer(program);
    }
}
export class DeferredDrawSpotLightMaterial extends DeferredLightBase<SpotLight> {
    className(): string {
        return 'DeferredDrawSpotLightMaterial';
    }

    generateShaderKey(registry: ShaderComponentRegistry): string {
        return super.generateShaderKey(registry) + this.light.shadow.enabled;
    }

    buildLightComputeImpl() {
        return `
        IncidentLight directLight;
        vec3 iesWorldCoord = vec3(invViewMatrix * vec4(-vViewPosition, 1.0));

        // The function has frustum test already.
        getSpotDirectLightIrradiance(spotLightIES, spotLight, geometry, iesWorldCoord, directLight);
        if (!directLight.visible) {
            discard;
        }

        ${this.light.shadow.enabled ? `
        directLight.color *= getShadow(spotShadowMap, spotLightShadowsInfo.shadowMapSize, spotLightShadowsInfo.shadowBias, spotLightShadowsInfo.shadowRadius, spotShadowCoord, spotLightShadowsInfo.shadowIntensity);
        `: ``}

        // late material reconstruct
        ${MeshPhongMaterial.constructMaterialFromGBufferForLight()}
        RE_Direct(directLight, geometry, material, reflectedLight);
        `;
    }

    buildLightShadow() {
        if (this.light.shadow.enabled) {
            return `
                // Offsetting the position used for querying occlusion along the world normal can be used to reduce shadow acne.
                vec3 spotShadowWorldNormal = inverseTransformDirection(geometry.normal, viewMatrix);
                vec4 spotShadowWorldPosition;
                vec4 worldPosition = invViewMatrix * vec4(-vViewPosition, 1.0);
                spotShadowWorldPosition = worldPosition + vec4(spotShadowWorldNormal * spotLightShadowsInfo.shadowNormalBias, 0);
                vec4 spotShadowCoord = spotLightShadowsInfo.shadowMatrix * spotShadowWorldPosition;
            `;
        } else {
            return '';
        }

    }

    extendShaderShading(builder: ShaderBuilder, _: ShaderComponentRegistry) {
        super.extendShaderShading(builder, _);
        if (this.light.shadow.enabled) {
            this.light.shadow.extendsShaderDeferred(builder);
        }
        const IESLightEffect = Capabilities.IS_WEBGL2 ? ShaderBlockPool.IESLightEffect : ShaderBlockPool.IESLightEffectMock;
        builder
            .addFragment(punctualLightIntensityToIrradianceFactor)
            .addFragment(IESLightEffect)
            .addFragment(spotLightInclude)
            .addFragmentCustom(SpotLight.getHeader(false))
            .when(this.light.shadow.enabled, (builder) => builder.addUniform('viewMatrix', WebGLShaderDataType.Mat4))
            .addUniform('invViewMatrix', WebGLShaderDataType.Mat4)
            .inject(ShaderInjectionTypes.gl_FragColor, this.buildLightCompute());
    }

    updateShadingUniforms(program: WGLProgram, _: ShaderComponentRegistry) {
        super.updateShadingUniforms(program, _);
        this.light.updateUniformForDefer(program);
    }
}

export class DeferredDrawDiskAreaLightMaterial extends DeferredLightBase<DiskAreaLight> {
    className(): string {
        return 'DeferredDrawDiskAreaLightMaterial';
    }

    buildLightComputeImpl() {
        return `
         ${MeshPhongMaterial.constructMaterialFromGBufferForLight()}
        RE_Direct_DiskArea( diskAreaLight, geometry, material, reflectedLight );
        `;
    }

    buildLightShadow() { return ''; }

    extendShaderShading(builder: ShaderBuilder, r: ShaderComponentRegistry) {
        super.extendShaderShading(builder, r);
        builder
            .addUniform('ltc_1', WebGLShaderDataType.Sampler2D)
            .addUniform('ltc_2', WebGLShaderDataType.Sampler2D)
            .addFragment(DiskAreaLight.getShaderInclude())
            .addFragmentCustom(DiskAreaLight.getHeader(false))
            .inject(ShaderInjectionTypes.gl_FragColor, this.buildLightCompute())
            .when(r.light.diskAreaLights.length > 0, b =>
                b.addFragment(AreaBlinnPhong).addFragment(DiskAreaBlinnPhong));
    }

    updateShadingUniforms(program: WGLProgram, _: ShaderComponentRegistry) {
        super.updateShadingUniforms(program, _);
        this.light.updateUniformForDefer(program);
    }
}
export class DeferredDrawRectAreaLightMaterial extends DeferredLightBase<RectAreaLight> {
    className(): string {
        return 'DeferredDrawRectAreaLightMaterial';
    }

    buildLightComputeImpl() {
        return `
         ${MeshPhongMaterial.constructMaterialFromGBufferForLight()}
        RE_Direct_RectArea( rectAreaLight, geometry, material, reflectedLight );
        `;
    }

    buildLightShadow() { return ''; }

    extendShaderShading(builder: ShaderBuilder, r: ShaderComponentRegistry) {
        super.extendShaderShading(builder, r);
        builder
            .addUniform('ltc_1', WebGLShaderDataType.Sampler2D)
            .addUniform('ltc_2', WebGLShaderDataType.Sampler2D)
            .addFragment(RectAreaLight.getShaderInclude())
            .addFragmentCustom(RectAreaLight.getHeader(false))
            .inject(ShaderInjectionTypes.gl_FragColor, this.buildLightCompute())
            .when(r.light.rectAreaLights.length > 0, b =>
                b.addFragment(AreaBlinnPhong).addFragment(RectAreaBlinnPhong));
    }

    updateShadingUniforms(program: WGLProgram, _: ShaderComponentRegistry) {
        super.updateShadingUniforms(program, _);
        this.light.updateUniformForDefer(program);
    }
}

export const DECODE_NORMAL = createShaderBlock(`
vec3 decodeNormal(vec2 enc) {
    vec2 fenc = enc*4.-2.;
    float f = dot(fenc,fenc);
    float g = sqrt(1.-f/4.);
    vec3 n;
    n.xy = fenc*g;
    n.z = 1.-f/2.;
    return n;
}
`);
