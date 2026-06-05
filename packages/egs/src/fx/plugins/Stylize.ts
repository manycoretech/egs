import type { Vector3 } from '../../math/Vector3';
import { pass, target } from '../../rendergraph/NodeMakers';
import { drawQuad, type RendererAdaptor } from '../RendererAdaptor';
import { FilterMaterial, FilterTarget } from '../../elements/materials/quad/FilterMaterial';
import { PipelinePlugin } from './PipelinePlugin';
import type { HashKeyBuilder } from '../../utils/HashKeyBuilder';
import type { RenderGraph } from '../../rendergraph/RenderGraph';
import type { SceneAdaptorDispatcher } from '../SceneAdaptor';
import type { Texture } from '../../elements/textures/Texture';

export class StylizePlugin extends PipelinePlugin {
    readonly PLUGIN_NAME = 'stylize';

    private filterMaterial = new FilterMaterial();
    private get useDepth() {
        return this.filterMaterial.target !== FilterTarget.All && this.IS_SUPPORT_DEPTH_TEXTURE;
    }

    constructor(scene: SceneAdaptorDispatcher, renderer: RendererAdaptor) {
        super(scene, renderer);
        this.filterMaterial.target = FilterTarget.Foreground;
    }

    destroy() {
        this.filterMaterial.destroy();
    }

    updateFrameSize() {}
    updateEffect() {}

    updateGraphHash(hasher: HashKeyBuilder) {
        hasher.bool(this.useDepth);
    }

    updateRenderGraph(graph: RenderGraph) {
        const allPasses = graph.removeAllPasses();

        const stylizeTarget = target('stylize_target').from(allPasses);
        const stylizePass = pass('stylize_filter_pass')
            .input('tDiffuse', stylizeTarget)
            .use(drawQuad(this.filterMaterial));
        if (this.useDepth) {
            stylizePass.input('depth', stylizeTarget, 'depth');
        }
        if (!graph.depthTarget) {
            graph.depthTarget = stylizeTarget;
        }
        graph.addPass(stylizePass);
    }

    createConfig() {
        return {
            enabled: {
                get: () => this._enabled,
                set: (v: boolean) => {
                    this._enabled = v;
                },
            },
            temperature: {
                get: () => this.filterMaterial.temperature,
                set: (v: number) => {
                    this.filterMaterial.temperature = v;
                    this.filterMaterial.notifyRecompileShader();
                },
            },
            tint: {
                get: () => this.filterMaterial.tint,
                set: (v: number) => {
                    this.filterMaterial.tint = v;
                    this.filterMaterial.notifyRecompileShader();
                },
            },
            brightness: {
                get: () => this.filterMaterial.brightness,
                set: (v: number) => {
                    this.filterMaterial.brightness = v;
                    this.filterMaterial.notifyRecompileShader();
                },
            },
            contrast: {
                get: () => this.filterMaterial.contrast,
                set: (v: number) => {
                    this.filterMaterial.contrast = v;
                    this.filterMaterial.notifyRecompileShader();
                },
            },
            saturation: {
                get: () => this.filterMaterial.saturation,
                set: (v: number) => {
                    this.filterMaterial.saturation = v;
                    this.filterMaterial.notifyRecompileShader();
                },
            },
            colorBalance: {
                get: () => this.filterMaterial.colorBalance.clone(),
                set: (v: Vector3) => {
                    this.filterMaterial.colorBalance = v.clone();
                },
            },
            hue: {
                get: () => this.filterMaterial.hue,
                set: (v: number) => {
                    this.filterMaterial.hue = v;
                    this.filterMaterial.notifyRecompileShader();
                },
            },
            lut: {
                get: () => this.filterMaterial.lut,
                set: (v: Texture | null) => {
                    this.filterMaterial.lut = v;
                    this.filterMaterial.notifyRecompileShader();
                },
            },
            texture: {
                get: () => this.filterMaterial.texture,
                set: (v: Texture | null) => {
                    this.filterMaterial.texture = v;
                    this.filterMaterial.notifyRecompileShader();
                },
            },
            target: {
                get: () => this.filterMaterial.target,
                set: (v: FilterTarget) => {
                    this.filterMaterial.depth = null;
                    this.filterMaterial.target = v;
                    this.filterMaterial.notifyRecompileShader();
                },
            },
        };
    }
}
