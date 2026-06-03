import { pass, target, colorAttachment, depthAttachment } from '../../rendergraph/NodeMakers';
import { PipelinePlugin, type IEffectConfig, type RenderingConfig, type PipelineContext, type DrivenCullingConfig } from './PipelinePlugin';
import type { HashKeyBuilder } from '../../utils/HashKeyBuilder';
import type { RenderGraph } from '../../rendergraph/RenderGraph';
import { MeshBasicMaterial } from '../../elements/materials/mesh/MeshBasicMaterial';
import { MixOITMaterial } from '../../elements/materials/quad/MixOITMaterial';
import { CopyColorAndDepthMaterial, CopyMaterial } from '../../elements/materials/quad/CopyMaterial';
import type { SceneAdaptor, SceneAdaptorDispatcher } from '../SceneAdaptor';
import type { PassNode } from '../../rendergraph/nodes/PassNode';
import { Color } from '../../math/Color';
import { WebGLShaderDataType } from '../../renderer/webgl/WGLConstants';
import { Blending, BlendingFactor, BlendingEquation } from '../../utils/Constants';
import { Vector4 } from '../../math/Vector4';
import { RenderObjectsType, filterBy } from '../../scene/tools/DrawcallList';
import { drawQuad, type RendererAdaptor } from '../RendererAdaptor';
import { BACKGROUND_SHADING_PASS_NAME } from './Background';
import { MaterialDispatcher, checkInstance, MaterialShadingWithDynamicShapeDispatcher } from '../../renderer/MaterialDispatcher';
import { OutlineShadingMode, type Drawable, OutlineRenderMode } from '../../scene/drawables/Drawable';
import { TypeAssert } from '../../scene/tools/TypeAssert';
import type { Material } from '../../elements/materials/Material';
import type { Nullable } from '../../utils/Utils';
import { WGLProgram } from '../../renderer/webgl/WGLProgram';
import type { BufferGeometryBase } from '../../elements/geometries/containers/BufferGeometry';
import type { Renderer } from '../../renderer/Renderer';
import { ShaderBuilder, ShaderInjectionTypes, FragOutType } from '../../renderer/shader/builders/ShaderBuilder';
import { OITMaterial } from '../../elements/materials/mesh/OITMaterial';
import { PipelineContentBridge, PipelineFilters } from '../PipelineAPI';
import { EventType, EventDispatcher } from '../../utils/EventDispatcher';
import { ToonMaterial } from '../../elements/materials/mesh/ToonMaterial';
import { DrivenCullingMaterial } from '../../elements/materials/driven/DrivenCullingMaterial';
import { DrivenShadingMaterial, DrivenShadingMode } from '../../elements/materials/driven/DrivenShadingMaterial';
import { MeshPhongMaterial } from '../../elements/materials/mesh/MeshPhongMaterial';
import { Vector3 } from '../../math/Vector3';
import { PlanarShadowMaterial } from '../../elements/materials/mesh/PlanarShadowMaterial';
import { Plane } from '../../math/Plane';
import { Matrix4 } from '../../math/Matrix4';
import type { ShaderComponentRegistry } from '../../scene/ShaderComponentRegistry';
import { BuiltInUniformTypes } from '../../renderer/RenderState/BuiltInUniforms';
import { BlurPassMaterial } from '../../elements/materials/quad/BlurPassMaterial';
import { readonlyMath } from '../../math/Readonly';
import { MixPlanarShadowMaterial } from '../../elements/materials/quad/MixPlanarShadowMaterial';
import type { RenderTargetNode } from '../../rendergraph/nodes/RenderTargetNode';
import { RendererBackend } from '../../renderer/IRenderer';
import { TextureFormat } from '../../elements/textures/types';
import { Texture2D } from '../../elements/textures/Texture2D';

const tmpVec3 = new Vector3();

// only use debug
export const BeforeScenePassEvent = new EventType<PassNode>();
export const AfterScenePassEvent = new EventType<PassNode>();

export class ForwardDispatcher extends MaterialDispatcher {
    solidEnabled = false;
    solidLightMaterialEnabled = false;
    solidMaterial: Material;

    oitEnabled = false;
    oitMaterial: OITMaterial;

    toonEnabled = false;
    toonMaterial: ToonMaterial;

    planarShadowEnabled = false;
    planarShadowMaxGroundHeight = 0;
    planarShadowMaxGroundThickness = 0;
    enableDynamicLights = false;

    constructor(solidMaterial?: MeshBasicMaterial, oitMaterial?: OITMaterial, toonMaterial?: ToonMaterial, enableDynamicLights = false) {
        super(true);
        this.solidMaterial = solidMaterial ?? new MeshBasicMaterial();
        this.oitMaterial = oitMaterial ?? new OITMaterial();
        this.toonMaterial = toonMaterial ?? new ToonMaterial();
        this.enableDynamicLights = enableDynamicLights;
        PipelineContentBridge.materialDispatcherCreate(this);
    }

    className() {
        return 'ForwardDispatcher';
    }

    private isPlanarShadowReceiver(drawable: Drawable) {
        if (drawable.castPlanarShadow || !TypeAssert.isMesh(drawable)) {
            return false;
        }
        const box = drawable.worldBoundingBox;
        if (box.max.z > this.planarShadowMaxGroundHeight) {
            return false;
        }
        return box.getSize(tmpVec3).z <= this.planarShadowMaxGroundThickness;
    }

    dispatch(renderer: Renderer, geometry: BufferGeometryBase, material: Material, drawable: Drawable): Nullable<WGLProgram> {
        const registry = renderer.renderState.activeShaderComponentRegistry;

        // enable dynamic forward lights when too many lights.
        if ((this.enableDynamicLights || registry.tooManyLightsForForward()) && registry.dynamicForwardLight.lights.size) {
            registry.dynamicForwardLight.dirtyKey = Math.random();
            registry.dynamicForwardLight.collectDynamicForwardLightsByDrawable(drawable);
        }

        const isInstance = checkInstance(drawable, geometry);
        material.refreshInstanceInBuilding(isInstance);

        const solidEnabled = this.solidEnabled &&
            drawable.outlineRenderMode !== OutlineRenderMode.Overlay &&
            drawable.outlineShadingMode !== OutlineShadingMode.Normal;
        const toonEnabled = this.toonEnabled && !solidEnabled && TypeAssert.isMeshPhongMaterial(material);
        const oitEnabled = this.oitEnabled;
        const planarShadowEnabled = this.planarShadowEnabled;
        const isPlanarShadowReceiver = planarShadowEnabled && this.isPlanarShadowReceiver(drawable);

        const overrideMaterialState = oitEnabled ? this.oitMaterial : solidEnabled ? this.solidMaterial : undefined;
        // always sync origin material's side
        if (overrideMaterialState) {
            overrideMaterialState.side = material.side;
            overrideMaterialState.polygonOffset = material.polygonOffset;
            overrideMaterialState.polygonOffsetFactor = material.polygonOffsetFactor;
            overrideMaterialState.polygonOffsetUnits = material.polygonOffsetUnits;
        }
        renderer.wglState.setMaterial(overrideMaterialState ?? material, drawable.frontFaceCW);
        renderer.wglState.resetTextureSlotIndex();

        let program: WGLProgram | undefined;
        // simple path
        if (!solidEnabled && !toonEnabled && !oitEnabled && !planarShadowEnabled) {
            program = renderer.resourceManager.setupWGLProgram(material, isInstance);
        }

        if (!program) {
            const programCache = renderer.resourceManager.dynamicPrograms;
            const registry = renderer.renderState.activeShaderComponentRegistry;
            const shaderKey: string = material.getShaderKey(registry) + (isInstance ? '0' : '1') +
                this.className() + solidEnabled + this.solidLightMaterialEnabled + toonEnabled + oitEnabled + planarShadowEnabled + isPlanarShadowReceiver;
            program = programCache.get(shaderKey);
            if (program === undefined) {
                const builder = new ShaderBuilder();
                material.extendShaderShape(builder, registry);
                if (!solidEnabled) {
                    material.extendShaderShading(builder, registry);
                }
                material.getComponents().forEach(c => {
                    c.extendShaderShape(builder);
                    if (!solidEnabled) {
                        c.extendShaderShading(builder);
                    }
                });
                if (solidEnabled) {
                    this.solidMaterial.extendShaderShading(builder, registry);
                }
                if (toonEnabled) {
                    this.toonMaterial.extendShaderShading(builder);
                }
                if (oitEnabled) {
                    this.oitMaterial.extendShaderShading(builder);
                }
                if (planarShadowEnabled) {
                    builder
                        .addNewFragOutputChannel('occlusion', FragOutType.Float)
                        .inject(ShaderInjectionTypes.frag_any, `occlusion = ${isPlanarShadowReceiver ? '0.0' : '1.0'};`);
                }
                program = new WGLProgram(renderer.renderState, builder.build(), null, shaderKey);
                programCache.set(shaderKey, program.program ? program : null!);
            }
        }

        if (!program) {
            return null;
        }

        const programChanged = renderer.wglState.useProgram(program);
        if (programChanged) {
            renderer.currentWGLProgram = program;
            renderer.renderInfo.refreshProgramCount++;
            renderer.renderState.markAllDirty();
        }

        if (material.onBeforeRender) {
            material.onBeforeRender(renderer);
        }

        renderer.renderState.updateGlobalUniforms(program);
        const materialChanged = renderer.lastUsedMaterial !== material;
        if (programChanged || materialChanged) {
            const registry = renderer.renderState.activeShaderComponentRegistry;
            material.updateShapeUniforms(program, registry);
            if (!solidEnabled) {
                material.updateShadingUniforms(program, registry);
            }
            material.getComponents().forEach(c => {
                c.updateShapeUniforms?.(program!);
                if (!solidEnabled) {
                    c.updateShadingUniforms?.(program!);
                }
            });
            if (solidEnabled) {
                this.solidMaterial.updateShadingUniforms(program, registry);
            }
            if (toonEnabled) {
                this.toonMaterial.updateShadingUniforms(program);
            }
            if (oitEnabled) {
                this.oitMaterial.updateShadingUniforms(program);
            }
            renderer.lastUsedMaterial = material;
        }

        return program;
    }
}

export class PlanarShadowDispatcher extends MaterialShadingWithDynamicShapeDispatcher<PlanarShadowMaterial> {
    private shadowPlane = new Plane(new Vector3(0, 0, 1), 0);
    private lightDirection = new Vector3(0, 0, 1);
    /**
     * @internal
     */
    shadowMatrix = new Matrix4();

    constructor(m: PlanarShadowMaterial) {
        super(m);
        this.updateShadowMatrix();
    }

    className() {
        return 'PlanarShadowDispatcher';
    }

    createBuilder(): ShaderBuilder {
        const builder = new ShaderBuilder();
        builder.useCamera = useCameraOverride;
        return builder;
    }

    updateUniforms(p: WGLProgram, reg: ShaderComponentRegistry, origin: Material) {
        super.updateUniforms(p, reg, origin);
        p.setUniform('shadowMatrix', this.shadowMatrix);
    }

    updateShadowMatrix() {
        const dot = this.shadowPlane.normal.dot(this.lightDirection);
        const a = this.shadowPlane.normal.x;
        const b = this.shadowPlane.normal.y;
        const c = this.shadowPlane.normal.z;
        const d = this.shadowPlane.constant;
        const x = this.lightDirection.x;
        const y = this.lightDirection.y;
        const z = this.lightDirection.z;
        this.shadowMatrix.set(
            dot - a * x, -b * x, -c * x, -d * x,
            -a * y, dot - b * y, -c * y, -d * y,
            -a * z, -b * z, dot - c * z, -d * z,
            0, 0, 0, dot
        );
    }
}

function useCameraOverride(this: ShaderBuilder, useInstance: boolean = false): ShaderBuilder {
    (this as any).isInstanceMeshEnabled = useInstance;

    this.addUniform('shadowMatrix', WebGLShaderDataType.Mat4)
        .addGlobalUniform(BuiltInUniformTypes.projectionMatrix)
        .addGlobalUniform(BuiltInUniformTypes.viewMatrix);

    if (useInstance) {
        this
            .addInstanceAttribute('mcol0', WebGLShaderDataType.Vec3)
            .addInstanceAttribute('mcol1', WebGLShaderDataType.Vec3)
            .addInstanceAttribute('mcol2', WebGLShaderDataType.Vec3)
            .addInstanceAttribute('mcol3', WebGLShaderDataType.Vec3)
            .inject(ShaderInjectionTypes.gl_Position, `
                mat4 instanceMatrix = mat4(
                    vec4(mcol0, 0),
                    vec4(mcol1, 0),
                    vec4(mcol2, 0),
                    vec4(mcol3, 1)
                );
                vec4 transform = instanceMatrix * vec4(position, 1.0);
                mvPosition = viewMatrix * transform; // wired point: support correct clipping
                gl_Position = projectionMatrix * viewMatrix * shadowMatrix * transform;
            `);
    } else {
        this
            .addGlobalUniform(BuiltInUniformTypes.modelMatrix)
            .inject(ShaderInjectionTypes.gl_Position, `
                vec4 transform = modelMatrix * vec4(position, 1.0);
                mvPosition = viewMatrix * transform; // ditto
                gl_Position = projectionMatrix * viewMatrix * shadowMatrix * transform;
            `);
    }

    return this;
}

export class ForwardPlugin extends PipelinePlugin {
    eventDispatcher = new EventDispatcher();

    readonly PLUGIN_NAME = 'forward';

    protected _enabled = true;

    private solidEnabled = false;
    private solidColor: Color = new Color();
    private solidLightMaterialEnabled = false;
    private solidBasicMaterial = new MeshBasicMaterial();
    private solidPhongMaterial = new MeshPhongMaterial();

    private toonEnabled = false;
    private toonMaterial = new ToonMaterial();

    private _oitEnabled = false;
    private get oitEnabled() {
        return this._oitEnabled && !this.solidEnabled && this.IS_ADVANCED_BACKEND;
    }
    private oitMaterial = new OITMaterial();
    private mixOITMaterial = new MixOITMaterial();

    private _staticFrameCacheEnabled = false;
    private staticFrameCacheActive = false;
    private get staticFrameCacheEnabled() {
        return this._staticFrameCacheEnabled && this.IS_ADVANCED_BACKEND && this.staticFrameCacheActive;
    }
    // check scene is changed
    private sceneId = -1;
    private frameSyncId = -1;

    private get hasStaticCacheFrame() {
        const scene = this.scene;
        const currentSceneId = scene.scene.sceneId;
        const staticFrameDirtyId = scene.scene.renderProxyManager.staticFrameDirtyId;
        return currentSceneId === this.sceneId && staticFrameDirtyId === this.frameSyncId;
    };
    private copyMaterial = new CopyColorAndDepthMaterial();

    private _planarShadowEnabled = false;
    private _planarShadowActive: boolean = false;
    private _planarShadowDelay: boolean = false;
    private get planarShadowEnabled() {
        return this._planarShadowEnabled && this.IS_ADVANCED_BACKEND && this._planarShadowActive && this._planarShadowDelay;
    }
    private set planarShadowEnabled(v: boolean) {
        this._planarShadowEnabled = v;
    }
    private planarShadowLastActiveTime = -1;
    private planarShadowIntensity = 0.4;
    private get planarShadowReady() {
        return this.planarShadowMaterial.intensity >= this.planarShadowIntensity;
    }
    private planarShadowOrderIndependent = false;
    private planarShadowMaxGroundHeight = 50;
    private planarShadowMaxGroundThickness = 50;
    private planarShadowMaterial = new PlanarShadowMaterial();
    private planarShadowDispatcher = new PlanarShadowDispatcher(this.planarShadowMaterial);
    private planarShadowMixMaterial = new MixPlanarShadowMaterial();
    private blurXMaterial = new BlurPassMaterial();
    private blurYMaterial = new BlurPassMaterial();
    private planarShadowCopyMaterial = new CopyMaterial({
        blending: Blending.CustomBlending,
        blendSrc: BlendingFactor.DstColor,
        blendDst: BlendingFactor.Zero,
        blendEquation: BlendingEquation.Add,
        blendSrcAlpha: BlendingFactor.DstAlpha,
        blendDstAlpha: BlendingFactor.Zero,
        blendEquationAlpha: BlendingEquation.Add,
    });

    private dispatcher = new ForwardDispatcher(this.solidBasicMaterial, this.oitMaterial, this.toonMaterial);

    private drivenCullingMaterial: DrivenCullingMaterial = new DrivenCullingMaterial();
    private drivenShadingMaterial: DrivenShadingMaterial = new DrivenShadingMaterial();

    get shouldRender() {
        return this.planarShadowEnabled && !this.planarShadowReady;
    }

    constructor(scene: SceneAdaptorDispatcher, renderer: RendererAdaptor) {
        super(scene, renderer);
        this.copyMaterial.transparent = false;
        this.blurXMaterial.direction = readonlyMath.vec2(1, 0);
        this.blurYMaterial.direction = readonlyMath.vec2(0, 1);
    }

    destroy() {
        this.copyMaterial.destroy();
        this.solidBasicMaterial.destroy();
        this.solidPhongMaterial.destroy();
        this.oitMaterial.destroy();
        this.mixOITMaterial.destroy();
        this.dispatcher.destroy();
    }

    updateFrameSize(width: number, height: number) {
        this.notifyChanged();
        this.blurXMaterial.setTexelSize(width, height);
        this.blurYMaterial.setTexelSize(width, height);
    }

    updateEffect(scene: SceneAdaptor, isFrameStable: boolean, isCameraStable: boolean, effectConfig: IEffectConfig) {
        if (!isCameraStable) {
            this.notifyChanged();
        }
        this.staticFrameCacheActive = scene.scene && isCameraStable;

        /**
         * 1. user enabled and static frame is disabled.
         * 2. frame and camera is stable or fps > 30.
         * 3. camera position z > 0.
         */
        const planarShadowActive = this._planarShadowEnabled && !this.staticFrameCacheEnabled &&
            ((isFrameStable && isCameraStable) || !effectConfig.isPerformanceSlow) &&
            this.scene.adaptor.camera.getWorldPosition(tmpVec3).z > 0;
        // delay 500ms after active.
        this._planarShadowDelay = planarShadowActive && (performance.now() - this.planarShadowLastActiveTime > 500);
        if (this._planarShadowEnabled && !this._planarShadowActive && planarShadowActive) {
            this.planarShadowMaterial.intensity = 0;
            this.planarShadowLastActiveTime = performance.now();
        }
        this._planarShadowActive = planarShadowActive;
        effectConfig.planarShadowEnabled = this.planarShadowEnabled;
        effectConfig.planarShadowReady = this.planarShadowReady;
    }

    updateGraphHash(hasher: HashKeyBuilder) {
        hasher
            .bool(this.solidEnabled)
            .bool(this.toonEnabled)
            .bool(this.oitEnabled)
            .bool(this.staticFrameCacheEnabled)
            .bool(this.hasStaticCacheFrame)
            .bool(this.planarShadowEnabled)
            .bool(this.planarShadowOrderIndependent);
    }

    private createStaticFrameCachePass(
        graph: RenderGraph,
        dispatcher: ForwardDispatcher | undefined,
        config: RenderingConfig,
    ): PassNode[] {
        const scene = this.scene;

        const background = graph.removePass(BACKGROUND_SHADING_PASS_NAME);
        const staticContentTarget = target('static_content_target')
            .keepContent();

        const shadingPass = pass('static_opaque_shading_pass')
            .disableClear()
            .draw(scene.static)
            .after(() => {
                this.sceneId = scene.scene.sceneId;
                this.frameSyncId = scene.scene.renderProxyManager.staticFrameDirtyId;
            })
            .useDispatcher(dispatcher);
        let output = staticContentTarget;

        if (config.MSAA) {
            staticContentTarget.disableStencil();
            output = target('static_content_target_multisampled')
                .disableStencil()
                .enableMultiSample();
        }

        if (!this.hasStaticCacheFrame) {
            output.from([
                background,
                shadingPass,
            ]);
            if (config.MSAA) {
                shadingPass.resolveTo(staticContentTarget, true, false);
            }
        }

        return [
            pass('static_content_copy')
                .enableClear(false, true)
                .input('tDiffuse', staticContentTarget)
                .input('depth', staticContentTarget, 'depth')
                .use(drawQuad(this.copyMaterial)),
            pass('dynamic_opaque_shading_pass')
                .disableClear()
                .useDispatcher(dispatcher)
                .draw(scene.dynamic),
        ];
    }

    private createPlanarShadowTarget(shadowPass: PassNode[]): RenderTargetNode {
        let shadowPassResult = target('planar_shadow_origin_target', true, false)
            .from(shadowPass);
        shadowPassResult = target('planar_shadow_blurred_x_target', true, false)
            .from([
                pass('blur_x_pass')
                    .input('tDiffuse', shadowPassResult)
                    .use(drawQuad(this.blurXMaterial)),
            ]);
        shadowPassResult = target('planar_shadow_blurred_target', true, false)
            .from([
                pass('blur_y_pass')
                    .input('tDiffuse', shadowPassResult)
                    .use(drawQuad(this.blurYMaterial)),
            ]);
        return shadowPassResult;
    }

    // order dependent planar shadow pass
    private createPlanarShadowPass(_graph: RenderGraph, dispatcher: ForwardDispatcher | undefined): PassNode[] {
        const scene = this.scene;

        const shadowReceiver = pass('planar_shadow_receiver_pass')
            .disableClear()
            .useDispatcher(dispatcher)
            .use(renderer => scene.default().render(renderer.renderer, RenderObjectsType.Opaque, PipelineFilters.planarShadowReceiver(this.planarShadowMaxGroundHeight, this.planarShadowMaxGroundThickness)));

        const shadowTarget = this.createPlanarShadowTarget([
            pass('planar_shadow_pass')
                .setClearColor(new Vector4(1, 1, 1, 1))
                .useDispatcher(this.planarShadowDispatcher)
                .before(() => {
                    this.planarShadowMaterial.intensity = Math.min(this.planarShadowMaterial.intensity + 0.02, this.planarShadowIntensity);
                })
                .draw(filterBy(scene.default, () => PipelineFilters.planarShadowCaster(this.planarShadowMaxGroundHeight))),
        ]);
        const shadowComposePass = pass('planar_shadow_compose_pass')
            .disableClear()
            .input('tDiffuse', shadowTarget)
            .use(drawQuad(this.planarShadowCopyMaterial));

        const shadowExclude = pass('planar_shadow_exclude_pass')
            .disableClear()
            .useDispatcher(dispatcher)
            .use(renderer => scene.default().render(renderer.renderer, RenderObjectsType.Opaque, PipelineFilters.planarShadowExclude(this.planarShadowMaxGroundHeight, this.planarShadowMaxGroundThickness)));

        return [shadowReceiver, shadowComposePass, shadowExclude];
    }

    // order independent planar shadow pass
    private createPlanarShadowPassV2(graph: RenderGraph,
        drivenPass: PassNode, dispatcher: ForwardDispatcher | undefined, context: PipelineContext, depthPyramid: RenderTargetNode): PassNode[] {
        const scene = this.scene;
        const { MSAA, gpuDriven: { enabled: drivenEnabled } } = context.renderingConfig;

        const background = graph.removePass(BACKGROUND_SHADING_PASS_NAME);
        const opaque = pass('default_opaque_shading_pass')
            .disableClear()
            .useDispatcher(dispatcher)
            .before(() => {
                this.dispatcher.planarShadowEnabled = true;
                this.dispatcher.planarShadowMaxGroundHeight = this.planarShadowMaxGroundHeight;
                this.dispatcher.planarShadowMaxGroundThickness = this.planarShadowMaxGroundThickness;
                this.dispatcher.update();
            })
            .use(renderer => scene.default().render(renderer.renderer, RenderObjectsType.Opaque))
            .after(() => {
                this.dispatcher.planarShadowEnabled = false;
                this.dispatcher.update();
            });
        const opaquePasses = drivenEnabled ? [drivenPass, opaque] : [opaque];
        if (drivenEnabled) {
            opaque
                .depend(drivenPass)
                .useDriven(this.drivenShadingMaterial)
                .before(() => {
                    this.drivenShadingMaterial.planarShadowOcclusion = true;
                    if (this.solidEnabled) {
                        this.drivenShadingMaterial.shadingMode =
                            this.solidLightMaterialEnabled ? DrivenShadingMode.OutlineSolidPhongShading : DrivenShadingMode.OutlineSolidShading;
                    } else if (this.toonEnabled) {
                        this.drivenShadingMaterial.shadingMode = DrivenShadingMode.ToonShading;
                    }
                })
                .after(() => {
                    this.drivenShadingMaterial.planarShadowOcclusion = false;
                    this.drivenShadingMaterial.shadingMode = DrivenShadingMode.PhongShading;
                });
        }
        const opaqueTarget = target('opaque_and_oc_target', false)
            .modify(node => {
                const color0 = colorAttachment('opaque_and_oc_target_color_0');
                node.attach(color0, 0);
                const color1 = colorAttachment('opaque_and_oc_target_color_1');
                color1.format = TextureFormat.R8Unorm;
                node.attach(color1, 1);
            });

        let opaqueOutputTarget = opaqueTarget;

        if (MSAA) {
            opaqueTarget.disableStencil();
            opaqueOutputTarget = target('opaque_and_oc_target_multisampled', false)
                .modify(node => {
                    const color0 = colorAttachment('opaque_and_oc_target_multisampled_color_0');
                    node.attach(color0, 0);
                    const color1 = colorAttachment('opaque_and_oc_target_multisampled_color_1');
                    color1.format = TextureFormat.R8Unorm;
                    node.attach(color1, 1);
                })
                .disableStencil()
                .enableMultiSample();
            opaque.resolveTo(opaqueTarget, true, true);
        }

        opaqueOutputTarget.from([
            background?.writeBuffers([0]),
            pass('clear_planar_shadow_oc_pass')
                .setClearColor(new Vector4(0, 0, 0, 0))
                .enableClear(true, false)
                .writeBuffers([1])
                .use(() => { }),
            ...opaquePasses,
        ]);
        const planarShadowCaster = filterBy(scene.default, () => PipelineFilters.planarShadowCaster(this.planarShadowMaxGroundHeight));
        const shadowPass = pass('planar_shadow_pass')
            .setClearColor(new Vector4(1, 1, 1, 1))
            .useDispatcher(this.planarShadowDispatcher)
            .before(() => {
                this.planarShadowMaterial.intensity = Math.min(this.planarShadowMaterial.intensity + 0.02, this.planarShadowIntensity);
            })
            .draw(planarShadowCaster);
        const shadowCullingPass = pass('planar_shadow_culling_pass')
            .disableClear()
            .before(() => {
                this.updateDrivenCullingMaterial(context.drivenCullingConfig);
            })
            .useDriven(this.drivenCullingMaterial)
            .input('depthPyramid', depthPyramid)
            .draw(planarShadowCaster);
        if (drivenEnabled) {
            shadowPass
                .depend(shadowCullingPass)
                .useDriven(this.drivenShadingMaterial)
                .before(() => {
                    this.drivenShadingMaterial.shadowIntensity = this.planarShadowMaterial.intensity;
                    this.drivenShadingMaterial.shadingMode = DrivenShadingMode.PlanarShadow;
                })
                .after(() => {
                    this.drivenShadingMaterial.shadingMode = DrivenShadingMode.PhongShading;
                });
        }
        const shadowPassList = [...(drivenEnabled ? [shadowCullingPass] : []), shadowPass];

        const shadowTarget = this.createPlanarShadowTarget(shadowPassList);

        return [
            pass('copy_opaque_pass')
                .enableClear(false, true)
                .input('tDiffuse', opaqueTarget)
                .input('depth', opaqueTarget, 'depth')
                .use(drawQuad(this.copyMaterial)),
            pass('mix_planar_shadow_pass')
                .disableClear()
                .input('tDiffuse', shadowTarget)
                .input('occlusionMap', opaqueTarget, 1)
                .use(drawQuad(this.planarShadowMixMaterial)),
        ];
    }

    private createOitPass(
        graph: RenderGraph,
        opaquePassList: PassNode[],
        drivenPass: PassNode,
        dispatcher: ForwardDispatcher | undefined,
        config: RenderingConfig,
    ): PassNode[] {
        const scene = this.scene;
        const { MSAA, gpuDriven: { enabled: drivenEnabled } } = config;
        const lastPass = opaquePassList[opaquePassList.length - 1];
        const opaqueTargetDepthAttachment = depthAttachment('opaque_target_depth');
        const opaqueTarget = target('opaque_target', true, false)
            .modify(node => {
                node.attach(opaqueTargetDepthAttachment);
            })
            .disableStencil();
        let opaqueOutputTarget = opaqueTarget;

        if (MSAA) {
            opaqueOutputTarget = target('opaque_target_msaa')
                .disableStencil()
                .enableMultiSample();
            lastPass?.resolveTo(opaqueTarget, true, true);
        }

        opaqueOutputTarget.from(opaquePassList);

        graph.depthTarget = opaqueTarget;

        const oitPass = pass('accum_oit_pass')
            .depend(opaqueTarget)
            .enableClear(true, false)
            .setClearColor(new Vector4(0, 0, 0, 1))
            .useDispatcher(this.dispatcher)
            .before(() => {
                this.dispatcher.oitEnabled = true;
                this.dispatcher.update();
            })
            .use(renderer => scene.OIT().render(renderer.renderer, RenderObjectsType.OIT))
            .after(() => {
                this.dispatcher.oitEnabled = false;
                this.dispatcher.update();
            });
        if (drivenEnabled) {
            oitPass
                .depend(drivenPass)
                .useDriven(this.drivenShadingMaterial)
                .before(() => {
                    if (this.solidEnabled) {
                        this.drivenShadingMaterial.shadingMode =
                            this.solidLightMaterialEnabled ? DrivenShadingMode.OutlineSolidPhongShading : DrivenShadingMode.OutlineSolidShading;
                    } else if (this.toonEnabled) {
                        this.drivenShadingMaterial.shadingMode = DrivenShadingMode.ToonShading;
                    }
                    this.drivenShadingMaterial.oitEncode = true;
                })
                .after(() => {
                    this.drivenShadingMaterial.shadingMode = DrivenShadingMode.PhongShading;
                    this.drivenShadingMaterial.oitEncode = false;
                });
        }

        const oitTarget = target('oit_target', false, false)
            .modify(node => {
                const color0 = colorAttachment('oit_target_color_0');
                color0.format = TextureFormat.Rgba16Float;
                node.attach(color0, 0);
                const color1 = colorAttachment('oit_target_color_1');
                color1.format = TextureFormat.R16Float;
                node.attach(color1, 1);
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
                .useDispatcher(dispatcher)
                .draw(scene.OIT),
            pass('mix_oit_pass')
                .disableClear()
                .input('accumColor', oitTarget, 0)
                .input('accumAlpha', oitTarget, 1)
                .useIf(() => drivenEnabled || scene.OIT().getRenderListLength(RenderObjectsType.OIT) > 0, drawQuad(this.mixOITMaterial)),
            pass('after_oit_pass')
                .disableClear()
                .useDispatcher(dispatcher)
                .use(renderer => scene.OIT().render(renderer.renderer, RenderObjectsType.AfterOIT)),
        ];
    }

    /**
     * WEBGPU only, enable MSAA in OIT pass.
     */
    private createMultisampledOitPass(
        graph: RenderGraph,
        opaquePassList: PassNode[],
        drivenPass: PassNode,
        dispatcher: ForwardDispatcher | undefined,
        config: RenderingConfig,
    ): PassNode[] {
        const scene = this.scene;
        const { gpuDriven: { enabled: drivenEnabled } } = config;
        const oitTargetDepthAttachment = depthAttachment('oit_target_depth_multisampled');
        oitTargetDepthAttachment.multiSample = true;
        oitTargetDepthAttachment.enableStencil = false;
        const oitTargetColorAttachment = colorAttachment('oit_target_color_multisampled');
        oitTargetColorAttachment.multiSample = true;

        const beforeOITTarget = target('before_oit_target', false, false)
            .modify(node => {
                node.attach(oitTargetDepthAttachment);
                node.attach(oitTargetColorAttachment);
                node.multiSample = true;
            });

        const oitOutputTarget = target('oit_target_resolved', true, true).disableStencil();
        graph.depthTarget = oitOutputTarget;

        beforeOITTarget.from([
            ...opaquePassList,
            pass('before_oit_pass')
                .disableClear()
                .useDispatcher(dispatcher)
                .draw(scene.OIT)
        ]);

        const oitAccumPass = pass('accum_oit_pass')
            .depend(beforeOITTarget)
            .enableClear(true, false)
            .setClearColor(new Vector4(0, 0, 0, 1))
            .useDispatcher(this.dispatcher)
            .before(() => {
                this.dispatcher.oitEnabled = true;
                this.dispatcher.update();
            })
            .use(renderer => scene.OIT().render(renderer.renderer, RenderObjectsType.OIT))
            .after(() => {
                this.dispatcher.oitEnabled = false;
                this.dispatcher.update();
            });

        if (drivenEnabled) {
            oitAccumPass
                .depend(drivenPass)
                .useDriven(this.drivenShadingMaterial)
                .before(() => {
                    if (this.solidEnabled) {
                        this.drivenShadingMaterial.shadingMode =
                            this.solidLightMaterialEnabled ? DrivenShadingMode.OutlineSolidPhongShading : DrivenShadingMode.OutlineSolidShading;
                    } else if (this.toonEnabled) {
                        this.drivenShadingMaterial.shadingMode = DrivenShadingMode.ToonShading;
                    }
                    this.drivenShadingMaterial.oitEncode = true;
                })
                .after(() => {
                    this.drivenShadingMaterial.shadingMode = DrivenShadingMode.PhongShading;
                    this.drivenShadingMaterial.oitEncode = false;
                });
        }

        const oitAccumTarget = target('oit_accum_target_multisampled', false, false)
            .modify(node => {
                const color0 = colorAttachment('oit_accum_target_multisampled_color_0');
                color0.format = TextureFormat.Rgba16Float;
                color0.multiSample = true;
                node.attach(color0, 0);
                const color1 = colorAttachment('oit_accum_target_multisampled_color_1');
                color1.format = TextureFormat.R16Float;
                color1.multiSample = true;
                node.attach(color1, 1);
                node.attach(oitTargetDepthAttachment);
                node.multiSample = true;
            })
            .from(oitAccumPass);

        const afterOITTarget = target('before_oit_target', false, false)
            .modify(node => {
                node.attach(oitTargetDepthAttachment);
                node.attach(oitTargetColorAttachment);
                node.multiSample = true;
            });

        afterOITTarget.from([
            // MixOitMaterial will handle multisampled input.
            pass('mix_oit_pass')
                .disableClear()
                .input('accumColor', oitAccumTarget, 0)
                .input('accumAlpha', oitAccumTarget, 1)
                .useIf(() => drivenEnabled || scene.OIT().getRenderListLength(RenderObjectsType.OIT) > 0, drawQuad(this.mixOITMaterial)),
            pass('after_oit_pass')
                .disableClear()
                .useDispatcher(dispatcher)
                .use(renderer => scene.OIT().render(renderer.renderer, RenderObjectsType.AfterOIT))
                .resolveTo(oitOutputTarget, true, true),
        ]);

        return [
            pass('copy_oit_result_pass')
                .enableClear(false, true)
                .input('tDiffuse', oitOutputTarget)
                .input('depth', oitOutputTarget, 'depth')
                .use(drawQuad(this.copyMaterial))
        ];
    }

    updateRenderGraph(graph: RenderGraph, context: PipelineContext, depthPyramid: RenderTargetNode) {
        const scene = this.scene;
        const { enabled: drivenEnabled } = context.renderingConfig.gpuDriven;
        const { planarShadowEnabled, solidEnabled, toonEnabled } = this;
        const planarShadowOrderIndependent = this.planarShadowOrderIndependent || drivenEnabled;
        const dispatcher = (solidEnabled || toonEnabled ||
            (planarShadowEnabled && planarShadowOrderIndependent)) ? this.dispatcher : undefined;
        // force disable staticFrameCache when gpu driven enabled.
        const staticFrameCacheEnabled = this.staticFrameCacheEnabled && !drivenEnabled;
        // force enable oit when gpu driven enabled.
        const oitEnabled = (this.oitEnabled || drivenEnabled) && !this.solidEnabled;

        const drivenPass = pass('prepare_driven_pass')
            .disableClear()
            .before(() => {
                this.updateDrivenCullingMaterial(context.drivenCullingConfig);
                this.updateDrivenShadingMaterial();
            })
            .useDriven(this.drivenCullingMaterial)
            .input('depthPyramid', depthPyramid)
            .draw(scene.default);
        graph.sceneCullingPass = drivenPass;

        let opaquePassList: PassNode[] = [];
        if (staticFrameCacheEnabled) {
            opaquePassList = this.createStaticFrameCachePass(graph, dispatcher, context.renderingConfig);
        } else if (planarShadowEnabled) {
            if (planarShadowOrderIndependent) {
                opaquePassList = this.createPlanarShadowPassV2(graph, drivenPass, dispatcher, context, depthPyramid);
            } else {
                opaquePassList = this.createPlanarShadowPass(graph, dispatcher);
            }
        } else if (oitEnabled) {
            const background = graph.removePass(BACKGROUND_SHADING_PASS_NAME);
            // provide opaque shading result
            const passes: PassNode[] = [];
            const opaque = pass('default_opaque_shading_pass')
                .disableClear()
                .useDispatcher(dispatcher)
                .use(renderer => scene.default().render(renderer.renderer, RenderObjectsType.Opaque));
            if (drivenEnabled) {
                opaque
                    .depend(drivenPass)
                    .useDriven(this.drivenShadingMaterial)
                    .before(() => {
                        if (solidEnabled) {
                            this.drivenShadingMaterial.shadingMode =
                                this.solidLightMaterialEnabled ? DrivenShadingMode.OutlineSolidPhongShading : DrivenShadingMode.OutlineSolidShading;
                        } else if (toonEnabled) {
                            this.drivenShadingMaterial.shadingMode = DrivenShadingMode.ToonShading;
                        }
                    })
                    .after(() => {
                        this.drivenShadingMaterial.shadingMode = DrivenShadingMode.PhongShading;
                    });
                passes.push(drivenPass);
            }
            if (background) {
                passes.push(background);
            }
            passes.push(opaque);
            opaquePassList = passes;
        }

        let transparentPassList: PassNode[] = [];
        if (oitEnabled) {
            if (context.renderingConfig.MSAA && this.renderer.renderer.backend === RendererBackend.WEBGPU_WASM) {
                transparentPassList = this.createMultisampledOitPass(graph, opaquePassList, drivenPass, dispatcher, context.renderingConfig);
            } else {
                transparentPassList = this.createOitPass(graph, opaquePassList, drivenPass, dispatcher, context.renderingConfig);
            }
            opaquePassList = [];
        } else if (opaquePassList.length) {
            // never exec when gpu driven enabled.
            transparentPassList = [
                pass('default_transparent_shading_pass')
                    .disableClear()
                    .useDispatcher(dispatcher)
                    .use(renderer => scene.default().render(renderer.renderer, RenderObjectsType.Transparent)),
            ];
        }

        const passList: PassNode[] = [];
        if (opaquePassList.length === 0 && transparentPassList.length === 0) {
            const defaultPass = pass('default_shading_pass')
                .disableClear()
                .useDispatcher(dispatcher)
                .draw(scene.default);
            defaultPass.before(() => { this.eventDispatcher.emit(BeforeScenePassEvent, defaultPass); });
            defaultPass.after(() => { this.eventDispatcher.emit(AfterScenePassEvent, defaultPass); });
            if (drivenEnabled) {
                defaultPass
                    .depend(drivenPass)
                    .useDriven(this.drivenShadingMaterial)
                    .before(() => {
                        if (solidEnabled) {
                            this.drivenShadingMaterial.shadingMode =
                                this.solidLightMaterialEnabled ? DrivenShadingMode.OutlineSolidPhongShading : DrivenShadingMode.OutlineSolidShading;
                        } else if (toonEnabled) {
                            this.drivenShadingMaterial.shadingMode = DrivenShadingMode.ToonShading;
                        }
                    })
                    .after(() => {
                        this.drivenShadingMaterial.shadingMode = DrivenShadingMode.PhongShading;
                    });

                passList.push(drivenPass);
            }
            passList.push(defaultPass);
        } else {
            passList.push(...opaquePassList, ...transparentPassList);
        }

        graph.addPass(passList);
    }

    private updateDrivenShadingMaterial() {
        this.drivenShadingMaterial.colorGradation = this.toonMaterial.tooniness;
        this.drivenShadingMaterial.toonColor = this.toonMaterial.toonColor;
        this.drivenShadingMaterial.diffuseColor = this.toonMaterial.diffuseColor;
        this.drivenShadingMaterial.smoothnessMin = this.toonMaterial.smoothnessMin;
        this.drivenShadingMaterial.smoothnessMax = this.toonMaterial.smoothnessMax;
        this.drivenShadingMaterial.outlineSolidColor = this.solidColor;
        this.drivenShadingMaterial.planarShadowMaxGroundHeight = this.planarShadowMaxGroundHeight;
        this.drivenShadingMaterial.planarShadowMaxGroundThickness = this.planarShadowMaxGroundThickness;
        this.drivenShadingMaterial.shadowMatrix = this.planarShadowDispatcher.shadowMatrix;
        this.drivenShadingMaterial.shadowIntensity = this.planarShadowMaterial.intensity;
    }

    private updateDrivenCullingMaterial(config: DrivenCullingConfig) {
        this.drivenCullingMaterial.update(config);
        this.drivenCullingMaterial.planarShadowMaxGroundHeight = this.planarShadowMaxGroundHeight;
        this.drivenCullingMaterial.planarShadowMatrix = this.planarShadowDispatcher.shadowMatrix;
    }

    createConfig() {
        return {
            enabled: {
                get: () => this._enabled,
                set: (v: boolean) => {
                    this._enabled = v;
                },
            },
            oit: {
                enabled: {
                    get: () => this._oitEnabled,
                    set: (v: boolean) => {
                        this._oitEnabled = v;
                    },
                },
            },
            solid: {
                enabled: {
                    get: () => this.solidEnabled,
                    set: (v: boolean) => {
                        this.solidEnabled = v;
                        this.dispatcher.solidEnabled = this.solidEnabled;
                    },
                },
                lightMaterialEnabled: {
                    get: () => this.solidLightMaterialEnabled,
                    set: (v: boolean) => {
                        this.solidLightMaterialEnabled = v;
                        this.dispatcher.solidLightMaterialEnabled = this.solidLightMaterialEnabled;
                        if (this.solidLightMaterialEnabled) {
                            this.dispatcher.solidMaterial = this.solidPhongMaterial;
                        } else {
                            this.dispatcher.solidMaterial = this.solidBasicMaterial;
                        }
                        PipelineContentBridge.materialDispatcherCreate(this.dispatcher);
                    },
                },
                color: {
                    get: () => this.solidColor.clone(),
                    set: (v: Color) => {
                        this.solidColor = v.clone();
                        this.solidBasicMaterial.color.color = this.solidColor.cloneReadonly();
                        this.solidPhongMaterial.color = this.solidColor.cloneReadonly();
                        PipelineContentBridge.materialDispatcherCreate(this.dispatcher);
                    },
                },
            },
            toon: {
                enabled: {
                    get: () => this.toonEnabled,
                    set: (v: boolean) => {
                        this.toonEnabled = v;
                        this.dispatcher.toonEnabled = this.toonEnabled;
                    },
                },
                tooniness: {
                    get: () => this.toonMaterial.tooniness,
                    set: (v: number) => {
                        this.toonMaterial.tooniness = v;
                        PipelineContentBridge.materialDispatcherCreate(this.dispatcher);
                    },
                },
                toonColor: {
                    get: () => this.toonMaterial.toonColor.clone(),
                    set: (v: Color) => {
                        this.toonMaterial.toonColor = v.clone();
                        PipelineContentBridge.materialDispatcherCreate(this.dispatcher);
                    },
                },
                diffuseColor: {
                    get: () => this.toonMaterial.diffuseColor.clone(),
                    set: (v: Color) => {
                        this.toonMaterial.diffuseColor = v.clone();
                        PipelineContentBridge.materialDispatcherCreate(this.dispatcher);
                    },
                },
                smoothnessMin: {
                    get: () => this.toonMaterial.smoothnessMin,
                    set: (v: number) => {
                        this.toonMaterial.smoothnessMin = v;
                        PipelineContentBridge.materialDispatcherCreate(this.dispatcher);
                    },
                },
                smoothnessMax: {
                    get: () => this.toonMaterial.smoothnessMax,
                    set: (v: number) => {
                        this.toonMaterial.smoothnessMax = v;
                        PipelineContentBridge.materialDispatcherCreate(this.dispatcher);
                    },
                },
            },
            staticFrameCache: {
                enabled: {
                    get: () => this._staticFrameCacheEnabled,
                    set: (v: boolean) => {
                        this._staticFrameCacheEnabled = v;
                    },
                },
            },
            planarShadow: {
                enabled: {
                    get: () => this._planarShadowEnabled,
                    set: (v: boolean) => {
                        this._planarShadowEnabled = v;
                    },
                },
                orderIndependentEnabled: {
                    get: () => this.planarShadowOrderIndependent,
                    set: (v: boolean) => {
                        this.planarShadowOrderIndependent = v;
                    },
                },
                intensity: {
                    get: () => this.planarShadowIntensity,
                    set: (v: number) => { this.planarShadowIntensity = v; },
                },
                blurKernelRadius: {
                    get: () => this.blurXMaterial.blurKernelRadius,
                    set: (v: number) => {
                        this.blurXMaterial.blurKernelRadius = v;
                        this.blurYMaterial.blurKernelRadius = v;
                    },
                },
                maxGroundThickness: {
                    get: () => this.planarShadowMaxGroundThickness,
                    set: (v: number) => { this.planarShadowMaxGroundThickness = v; },
                },
                maxGroundHeight: {
                    get: () => this.planarShadowMaxGroundHeight,
                    set: (v: number) => { this.planarShadowMaxGroundHeight = v; },
                },
            },
        };
    }

    notifyChanged() {
        this.frameSyncId = -1;
        this.planarShadowCopyMaterial.tDiffuse = Texture2D.default;
        this.blurXMaterial.tDiffuse = Texture2D.default;
        this.blurYMaterial.tDiffuse = Texture2D.default;
    }
}
