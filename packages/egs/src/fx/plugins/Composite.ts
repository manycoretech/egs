import { PipelinePlugin, type IEffectConfig } from './PipelinePlugin';
import type { HashKeyBuilder } from '../../utils/HashKeyBuilder';
import type { RenderGraph } from '../../rendergraph/RenderGraph';
import { pass, target } from '../../rendergraph/NodeMakers';
import { Platform } from '../../utils/Platform';
import { CopyMaterial } from '../../elements/materials/quad/CopyMaterial';
import { drawQuad } from '../RendererAdaptor';
import type { Vector4 } from '../../math/Vector4';
import { Quad } from '../../scene/renderables/Quad';
import { BufferGeometry } from '../../elements/geometries/containers/BufferGeometry';
import { BufferAttribute } from '../../elements/attributes/BufferAttribute';
import type { SceneAdaptor } from '../SceneAdaptor';
import { RendererBackend } from '../../renderer/IRenderer';

export const COMPOSITE_TARGET_NAME = 'composite_target';

export class CompositePlugin extends PipelinePlugin {
    readonly PLUGIN_NAME = 'composite';

    private staticFrameCacheEnabled: boolean = false;
    private hasStaticCacheFrame: boolean = false;

    private _multiSamplingEnabled = false;
    private get multiSamplingEnabled() {
        return this._multiSamplingEnabled && this.IS_ADVANCED_BACKEND;
    }

    private copyMaterial = new CopyMaterial({ transparent: false });
    /**
     * @internal
     */
    private _bound?: Vector4;
    get bound() {
        return this._bound;
    }
    set bound(v) {
        this._bound = v;
        this.updateQuad();
    }
    private quad?: Quad;
    private updateQuad() {
        if (!this.bound) {
            this.quad = undefined;
            return;
        }
        if (!this.quad) {
            this.quad = new Quad();
        }
        const x0 = this.bound.x * 2 - 1;
        const y1 = 1 - this.bound.y * 2;
        const x1 = x0 + this.bound.z * 2;
        const y0 = y1 - this.bound.w * 2;
        const vertices: number[] = [x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y1, 0];
        const isWebGPU = this.renderer.renderer.backend === RendererBackend.WEBGPU_WASM;
        const uvs: number[] = isWebGPU ? [0, 1, 1, 1, 1, 0, 0, 0] : [0, 0, 1, 0, 1, 1, 0, 1];
        const geometry = new BufferGeometry();
        geometry.addAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
        geometry.addAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
        geometry.index = new BufferAttribute(new Uint32Array([0, 1, 2, 0, 2, 3]), 1);
        (geometry as any).isWebGPU = isWebGPU;
        (geometry as any).updateUV = function (this: BufferGeometry, isWebGPU: boolean) {
            const currentIsWebGPU = (this as any).isWebGPU;
            if (currentIsWebGPU !== isWebGPU) {
                const uvs = this.getAttribute('uv');
                if (uvs) {
                    const array = uvs.array.slice();
                    array[1] = array[1] * -1 + 1;
                    array[3] = array[3] * -1 + 1;
                    array[5] = array[5] * -1 + 1;
                    array[7] = array[7] * -1 + 1;
                    uvs.array = array;
                }
                (this as any).isWebGPU = isWebGPU;
            }
        };
        this.quad.setGeometry(geometry);
    }

    private _shouldMacWorkaround = false;
    get enabled() {
        const shouldWorkaround =
            this._shouldMacWorkaround && window.EGS_ENABLE_CONTENT_API === true && Platform.getInstance().isChromeMac;
        return this._enabled || this._multiSamplingEnabled || shouldWorkaround;
    }
    set enabled(v: boolean) {
        this._enabled = v;
    }

    destroy() {
        this.copyMaterial.destroy();
    }

    updateFrameSize() {
        this.notifyChanged();
    }

    updateEffect(_scene: SceneAdaptor, isFrameStable: boolean, isCameraStable: boolean, effectConfig: IEffectConfig) {
        if (!isCameraStable || !isFrameStable || (effectConfig.taaEnabled && !effectConfig.taaStable)) {
            this.notifyChanged();
        }
    }

    updateGraphHash(hasher: HashKeyBuilder) {
        hasher.bool(this.multiSamplingEnabled).bool(this.staticFrameCacheEnabled).bool(this.hasStaticCacheFrame);
    }

    updateRenderGraph(graph: RenderGraph) {
        const allPasses = graph.removeAllPasses();
        const compositeTarget = target(COMPOSITE_TARGET_NAME).setFilter(false, false).keepContent();
        let compositeOutputTarget = compositeTarget;
        if (this.multiSamplingEnabled) {
            compositeOutputTarget = target(`${COMPOSITE_TARGET_NAME}_msaa`).enableMultiSample();
        }

        if (!this.staticFrameCacheEnabled || !this.hasStaticCacheFrame) {
            const updateCachePass = pass('update_cache_pass')
                .disableClear()
                .use(() => {})
                .after(() => {
                    this.hasStaticCacheFrame = this.staticFrameCacheEnabled;
                });
            if (this.multiSamplingEnabled) {
                updateCachePass.resolveTo(compositeTarget, true, true);
            }
            compositeOutputTarget.from([...allPasses, updateCachePass]);
        }

        graph.addPass([
            pass('composite_pass')
                .disableClear()
                .input('tDiffuse', compositeTarget)
                .config(({ renderer }) => {
                    const { width, height } = renderer.getSize();
                    if (this.bound) {
                        renderer.setScissor(
                            this.bound.x * width,
                            this.bound.y * height,
                            this.bound.z * width,
                            this.bound.w * height,
                        );
                        renderer.setScissorTest(true);
                    } else {
                        renderer.setScissor(0, 0, width, height);
                        renderer.setScissorTest(false);
                    }
                    return false;
                })
                .use(drawQuad(this.copyMaterial, this.quad)),
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
            macWorkaround: {
                get: () => {
                    return this._shouldMacWorkaround;
                },
                set: (v: boolean) => {
                    this._shouldMacWorkaround = v;
                },
            },
            multiSamplingEnabled: {
                get: () => this._multiSamplingEnabled,
                set: (v: boolean) => {
                    this._multiSamplingEnabled = v;
                },
            },
            staticFrameCacheEnabled: {
                get: () => this.staticFrameCacheEnabled,
                set: (v: boolean) => {
                    this.staticFrameCacheEnabled = v;
                },
            },
        };
    }

    notifyChanged() {
        this.hasStaticCacheFrame = false;
    }
}
