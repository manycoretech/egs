import { TAAMaterial } from '../../elements/materials/quad/TAAMaterial';
import { CopyMaterial } from '../../elements/materials/quad/CopyMaterial';
import { pingpong, pass, target } from '../../rendergraph/NodeMakers';
import { Camera3D } from '../../scene/cameras/Camera3D';
import { Vector2 } from '../../math/Vector2';
import { drawQuad } from '../RendererAdaptor';
import { Utils } from '../../utils/Utils';
import { readonlyMath } from '../../math/Readonly';
import { Blending } from '../../utils/Constants';
import { PassNode } from '../../rendergraph/nodes/PassNode';
import { PipelinePlugin, IEffectConfig } from './PipelinePlugin';
import { HashKeyBuilder } from '../../utils/HashKeyBuilder';
import { RenderGraph } from '../../rendergraph/RenderGraph';
import { SceneAdaptor } from '../SceneAdaptor';

export class TAAPlugin extends PipelinePlugin {
    readonly PLUGIN_NAME = 'taa';

    private taaMaterial = new TAAMaterial({ blending: Blending.NoBlending });
    private copyMaterial = new CopyMaterial({ blending: Blending.NoBlending });
    private taaPingPong = pingpong('taa');
    private outSampleCount = 8;
    private samples = Utils.preComputeHalton(32);

    private active: boolean = false;
    get enabled() {
        return this._enabled && this.active;
    }
    set enabled(v: boolean) {
        this._enabled = v;
    }

    private _maxSampleCount = 32;
    get maxSampleCount() {
        return this._maxSampleCount;
    }
    set maxSampleCount(v) {
        this._maxSampleCount = v;
        this.samples = Utils.preComputeHalton(v);
    }

    private waitingTime = 160;
    private lastResetTimestamp = 0;
    private get isTAAReady() {
        return !(this.taaMaterial.sampleCount === 0 && (performance.now() - this.lastResetTimestamp < this.waitingTime));
    }

    get shouldRender(): boolean {
        return (this._enabled && !this.enabled) ||
            (this.enabled && this.taaMaterial.sampleCount < this.maxSampleCount);
    }

    resetSample() {
        this.taaMaterial.sampleCount = 0;
    }

    destroy() {
        this.taaMaterial.destroy();
        this.copyMaterial.destroy();
    }

    updateFrameSize() {
        this.taaMaterial.sampleCount = 0;
        this.lastResetTimestamp = performance.now();
    }

    updateEffect(_scene: SceneAdaptor, isFrameStable: boolean, isCameraStable: boolean, effectConfig: IEffectConfig) {
        const isNothingChange = isFrameStable && isCameraStable;
        if (isNothingChange) {
            /**
             * 1. make user we wait for TAA extra some time to start it
             * 2. if planar shadow is on, we have to wait for shadow finished
             */
            this.active = this.isTAAReady &&
                (!effectConfig.planarShadowEnabled || effectConfig.planarShadowReady);
        } else {
            this.active = false;
            this.lastResetTimestamp = performance.now();
        }

        if (!this.active) {
            this.taaMaterial.sampleCount = 0;
        }
        effectConfig.taaEnabled = this.enabled;
        effectConfig.taaStable = (this.enabled && this.taaMaterial.sampleCount >= this.maxSampleCount);
    }

    updateGraphHash(hasher: HashKeyBuilder) {
        hasher
            .bool(this.taaPingPong.evenTick)
            .bool(this.outputScreen);
    }

    updateRenderGraph(graph: RenderGraph) {
        const allPasses = graph.removeAllPasses();

        const currentRenderTarget = target('taa_current_render_target')
            .keepContent()
            .from(allPasses);

        if (!graph.depthTarget) {
            graph.depthTarget = currentRenderTarget;
        }

        const taaHistoryTarget = this.taaPingPong.ping()
            .from(pass('pre_create_history_target_pass').disableClear().use(() => { }));

        const taaTarget = this.taaPingPong.pong()
            .from([
                pass('taa_pass')
                    .disableClear()
                    .input('current', currentRenderTarget)
                    .input('history', taaHistoryTarget)
                    .use(drawQuad(this.taaMaterial))
                    .after(() => this.taaMaterial.sampleCount++),
            ]);

        let copyPass: PassNode;
        if (this.outputScreen) {
            copyPass = pass('copy_taa_pass')
                .disableClear()
                .input('tDiffuse', taaTarget)
                .use(drawQuad(this.copyMaterial));
        } else {
            copyPass = pass('no_copy_taa_pass')
                .depend(taaTarget)
                .disableClear()
                .use(() => { });
        }

        graph.addPass(copyPass);
    }

    createConfig() {
        return {
            enabled: {
                get: () => this._enabled,
                set: (v: boolean) => {
                    this._enabled = v;
                },
            },
            maxSample: {
                get: () => this.maxSampleCount,
                set: (v: number) => {
                    this.maxSampleCount = v;
                },
            },
            outputSample: {
                get: () => this.outSampleCount,
                set: (v: number) => {
                    this.outSampleCount = v;
                },
            },
            waitingTime: {
                get: () => this.waitingTime,
                set: (v: number) => {
                    this.waitingTime = v;
                },
            },
        };
    }

    private get outputScreen() {
        return this.taaMaterial.sampleCount >= (Math.min(this.outSampleCount, this.maxSampleCount) - 1);
    }

    tick() {
        this.taaPingPong.tick();
    }

    jitterCamera(camera: Camera3D, width: number, height: number) {
        const offset = this.samples[this.taaMaterial.sampleCount];
        if (offset === undefined) {
            return;
        }
        const canvas_size = new Vector2(width, height);
        const jitter = readonlyMath.vec2(-(2 * offset.x - 1) / width, -(2 * offset.y - 1) / height);
        camera.updateJitter(jitter);
        camera.updateProjectionMatrix({ offset, canvas_size });
    }

    jitterClear(camera: Camera3D) {
        camera.updateJitter(readonlyMath.vec2(0, 0));
    }
}
