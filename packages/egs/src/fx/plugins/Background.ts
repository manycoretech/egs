import { PipelinePlugin } from './PipelinePlugin';
import { Ground } from '../../scene/renderables/Ground';
import { BackgroundMode, BasicBackground, SolidColorBackground, EnvMapBackground, GradientBackground, Background, SkyBackground } from '../../scene/renderables/Background';
import { PreSkyMapMaterial } from '../../elements/materials/mesh/SkyMaterial';
import { CopyMaterial } from '../../elements/materials/quad/CopyMaterial';
import { HashKeyBuilder } from '../../utils/HashKeyBuilder';
import { RenderGraph } from '../../rendergraph/RenderGraph';
import { target, pass } from '../../rendergraph/NodeMakers';
import { drawQuad, RendererAdaptor } from '../RendererAdaptor';
import { RenderTarget } from '../../elements/textures/RenderTarget';
import { Vector2 } from '../../math/Vector2';
import { Color } from '../../math/Color';
import { Nullable } from '../../utils/Utils';
import { Vector3 } from '../../math/Vector3';
import { SceneAdaptorDispatcher } from '../SceneAdaptor';
import { Texture } from '../../elements/textures/Texture';

export const BACKGROUND_SHADING_PASS_NAME = 'background_shading_pass';

const SKY_MAP_SOURCE_SIZE = { width: 8192, height: 4096 };
const SKY_MAP_TARGET_SIZE = { width: 768, height: 384 };

export class BackgroundPlugin extends PipelinePlugin {
    readonly PLUGIN_NAME = 'background';

    ground = new Ground();

    basicBackground = new BasicBackground();
    solidBackground = new SolidColorBackground();
    skyBackground = new SkyBackground();
    envBackground = new EnvMapBackground();
    gradientBackground = new GradientBackground();

    activeBackground: BackgroundMode = BackgroundMode.BasicBackground;
    private get background(): Background | undefined {
        let background: Background | undefined;
        switch (this.activeBackground) {
            case BackgroundMode.BasicBackground:
                background = this.basicBackground;
                break;
            case BackgroundMode.EnvMapBackground:
                background = this.envBackground;
                break;
            case BackgroundMode.GradientBackground:
                background = this.gradientBackground;
                break;
            case BackgroundMode.SkyBackground:
                background = this.skyBackground;
                break;
            case BackgroundMode.SolidColorBackground:
                background = this.solidBackground;
                break;
            default:
                break;
        }
        return background;
    }

    private skyMapMaterial = new PreSkyMapMaterial();
    private copyMaterial = new CopyMaterial();
    private up = new Vector3(0, 0, 1);

    private get needRecreateSkyMap() {
        return this.activeBackground === BackgroundMode.SkyBackground &&
            (this.skyBackground.enableSkyMap && !this.skyBackground.material.tEquirect);
    }

    protected _enabled = true;

    constructor(scene: SceneAdaptorDispatcher, renderer: RendererAdaptor) {
        super(scene, renderer);
        this.ground.up = this.skyBackground.up = this.envBackground.up = this.gradientBackground.up = this.up;
    }

    destroy() {
        this.ground.destroy();
        this.basicBackground.destroy();
        this.skyBackground.destroy();
        this.envBackground.destroy();
        this.gradientBackground.destroy();
        this.skyMapMaterial.destroy();
        this.copyMaterial.destroy();
    }

    updateFrameSize() {
        this.notifyChanged();
    }

    notifyChanged() {
        this.skyBackground.setSkyMap(null);
    }

    updateEffect() { }

    updateGraphHash(hasher: HashKeyBuilder) {
        hasher.bool(this.needRecreateSkyMap);
    }

    updateRenderGraph(graph: RenderGraph) {
        const backgroundShading = pass(BACKGROUND_SHADING_PASS_NAME)
            .disableClear()
            .use({
                config: r => {
                    const renderer = r.renderer;
                    let batchable = true;
                    const background = this.background;
                    const ground = this.ground;
                    if (background) {
                        const r = background.config(renderer);
                        batchable = batchable && r;
                    }

                    if (ground.enabled) {
                        const r = ground.config(renderer);
                        batchable = batchable && r;
                    }
                    return batchable;
                },
                render: r => {
                    const renderer = r.renderer;
                    renderer.resetRenderState();
                    renderer.useCamera(this.scene.camera);
                    const background = this.background;
                    if (background) {
                        renderer.renderRenderable(background);
                    }
                    renderer.renderRenderable(this.ground);
                }
            });

        if (this.needRecreateSkyMap) {
            // be careful, WEBGPU any command failed will cause the whole submission failed
            // we should force flush command buffer to make sure the sky map generation will not failed?
            const skyMapGenTarget = target('ss_sky_map_target', true, false)
                .resize(() => SKY_MAP_SOURCE_SIZE)
                .from([
                    pass('sky_map_pass')
                        .disableClear()
                        .before(() => this.updateMaterial(this.skyBackground))
                        .use(drawQuad(this.skyMapMaterial)),
                ]);

            const skyMapTarget = target('sky_map_target', true, false)
                .keepContent()
                .resize(() => SKY_MAP_TARGET_SIZE)
                .from([
                    pass('downsample_pass')
                        .disableClear()
                        .input('tDiffuse', skyMapGenTarget)
                        .use(drawQuad(this.copyMaterial))
                        .after(r => this.skyBackground.setSkyMap((r.target as RenderTarget).colors[0])),
                ]);
            backgroundShading.depend(skyMapTarget);
        }

        graph.addPass(backgroundShading);
    }

    createConfig() {
        return {
            enabled: {
                get: () => this._enabled,
                set: (v: boolean) => {
                    this._enabled = v;
                },
            },
            up: {
                get: () => this.up,
                set: (v: Vector3) => {
                    this.up.copy(v);
                    this.ground.up = this.skyBackground.up = this.envBackground.up = this.gradientBackground.up = v;
                },
            },
            ground: {
                enabled: {
                    get: () => this.ground.enabled,
                    set: (v: boolean) => { this.ground.enabled = v; },
                },
                gridSize: {
                    get: () => this.ground.size,
                    set: (v: number) => { this.ground.size = v; },
                },
                offsetA: {
                    get: () => this.ground.material.offsetA.clone(),
                    set: (v: Vector2) => { this.ground.material.offsetA = v.cloneReadonly(); },
                },
                gridGapSizeA: {
                    get: () => this.ground.material.gridGapSizeA,
                    set: (v: number) => { this.ground.material.gridGapSizeA = v; },
                },
                colorA: {
                    get: () => this.ground.material.colorA.clone(),
                    set: (v: Color) => { this.ground.material.colorA = v.cloneReadonly(); },
                },
                lineWidthA: {
                    get: () => this.ground.material.lineWidthA,
                    set: (v: number) => { this.ground.material.lineWidthA = v; },
                },
                offsetB: {
                    get: () => this.ground.material.offsetB.clone(),
                    set: (v: Vector2) => { this.ground.material.offsetB = v.cloneReadonly(); },
                },
                gridGapSizeB: {
                    get: () => this.ground.material.gridGapSizeB,
                    set: (v: number) => { this.ground.material.gridGapSizeB = v; },
                },
                colorB: {
                    get: () => this.ground.material.colorB.clone(),
                    set: (v: Color) => { this.ground.material.colorB = v.cloneReadonly(); },
                },
                lineWidthB: {
                    get: () => this.ground.material.lineWidthB,
                    set: (v: number) => { this.ground.material.lineWidthB = v; },
                },
                isGroundColorEnabled: {
                    get: () => this.ground.material.isGroundColorEnabled,
                    set: (v: boolean) => { this.ground.material.isGroundColorEnabled = v; },
                },
                groundColor: {
                    get: () => this.ground.material.groundColor.clone(),
                    set: (v: Color) => { this.ground.material.groundColor = v.cloneReadonly(); },
                },
            },
            background: {
                active: {
                    get: () => this.activeBackground,
                    set: (v: BackgroundMode) => { this.activeBackground = v; },
                },
                solid: {
                    color: {
                        get: () => this.solidBackground.color.clone(),
                        set: (v: Color) => { this.solidBackground.color = v.clone(); },
                    },
                    alpha: {
                        get: () => this.solidBackground.alpha,
                        set: (v: number) => { this.solidBackground.alpha = v; },
                    }
                },
                envmap: {
                    texture: {
                        get: () => this.envBackground.material.tEquirect,
                        set: (v: Texture) => {
                            v.configSamplerRepeat()
                                .disableAutoMipmap()
                                .configDoubleLinear();
                            this.envBackground.material.tEquirect = v;
                        },
                    },
                    luma: {
                        get: () => this.envBackground.material.luma,
                        set: (v: number) => { this.envBackground.material.luma = v; },
                    },
                    verticalRotation: {
                        get: () => this.envBackground.material.verticalRotation,
                        set: (v: number) => { this.envBackground.material.verticalRotation = v; },
                    },
                    horizonRotation: {
                        get: () => this.envBackground.material.horizonRotation,
                        set: (v: number) => { this.envBackground.material.horizonRotation = v; },
                    },
                    reverseVertical: {
                        get: () => this.envBackground.material.reverseVertical,
                        set: (v: boolean) => {
                            this.envBackground.material.reverseVertical = v;
                            this.envBackground.material.notifyRecompileShader();
                        },
                    },
                    reverseHorizon: {
                        get: () => this.envBackground.material.reverseHorizon,
                        set: (v: boolean) => {
                            this.envBackground.material.reverseHorizon = v;
                            this.envBackground.material.notifyRecompileShader();
                        },
                    }
                },
                gradient: {
                    skyColor: {
                        get: () => this.gradientBackground.material.skyColor.clone(),
                        set: (v: Color) => { this.gradientBackground.material.skyColor = v.cloneReadonly(); },
                    },
                    groundColor: {
                        get: () => this.gradientBackground.material.groundColor.clone(),
                        set: (v: Color) => { this.gradientBackground.material.groundColor = v.cloneReadonly(); },
                    }
                },
                sky: {
                    enablePreSkyMap: {
                        get: () => this.skyBackground.enableSkyMap,
                        set: (v: boolean) => { this.skyBackground.setSkyMapEnable(v); },
                    },
                    luminance: {
                        get: () => this.skyBackground.material.luminance,
                        set: (v: number) => {
                            this.skyBackground.material.luminance = v;
                        },
                    },
                    turbidity: {
                        get: () => this.skyBackground.material.turbidity,
                        set: (v: number) => {
                            this.skyBackground.material.turbidity = v;
                        },
                    },
                    rayleigh: {
                        get: () => this.skyBackground.material.rayleigh,
                        set: (v: number) => {
                            this.skyBackground.material.rayleigh = v;
                        },
                    },
                    mieCoefficient: {
                        get: () => this.skyBackground.material.mieCoefficient,
                        set: (v: number) => {
                            this.skyBackground.material.mieCoefficient = v;
                        },
                    },
                    mieDirectionalG: {
                        get: () => this.skyBackground.material.mieDirectionalG,
                        set: (v: number) => {
                            this.skyBackground.material.mieDirectionalG = v;
                        },
                    },
                },
                basic: {
                    color: {
                        get: () => this.basicBackground.color.clone(),
                        set: (v: Color) => { this.basicBackground.color = v.clone(); },
                    },
                    alpha: {
                        get: () => this.basicBackground.alpha,
                        set: (v: number) => { this.basicBackground.alpha = v; },
                    },
                    texture: {
                        get: () => this.basicBackground.texture,
                        set: (v: Nullable<Texture>) => {
                            this.basicBackground.texture = v;
                        },
                    },
                },
            },
        };
    }

    private updateMaterial(background: SkyBackground) {
        this.skyMapMaterial.luminance = background.material.luminance;
        this.skyMapMaterial.rayleigh = background.material.rayleigh;
        this.skyMapMaterial.mieCoefficient = background.material.mieCoefficient;
        this.skyMapMaterial.mieDirectionalG = background.material.mieDirectionalG;
        this.skyMapMaterial.turbidity = background.material.turbidity;
        this.skyMapMaterial.up = background.material.up;
    }
}
