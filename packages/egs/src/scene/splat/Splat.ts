import { Object3D } from '../Object3D.js';
import { EventType } from '../../utils/EventDispatcher.js';
import { Vector3 } from '../../math/Vector3.js';
import { Vector4 } from '../../math/Vector4.js';
import type { UniformBlockObject } from '../../renderer/shader/components/UniformBlockObject.js';
import type { SourceTexture } from '../../elements/textures/SourceTexture.js';

/**
 * Event emitted when splat rendering stability changes.
 */
export const SplatRenderingStabilityChangedEvent = new EventType<boolean>();
/**
 * Event emitted after splat ordering has been updated.
 */
export const SplatSortedEvent = new EventType();

/**
 * Bit flags that describe splat selection state.
 */
export enum SplatState {
    Deleted = 1,
    Selected = 2,
}

/**
 * Configuration for animated splat visual effects.
 */
export interface SplatEffectConfig {
    enabled: boolean;

    pulseEnabled: boolean;
    pulseSparseThreshold: number;
    pulseJitterPhase: number;
    pulseJitterAmount: number;
    pulsePhase: number;
    pulseAmount: number;
    pulseSize: number;
    pulseSizeVariance: number;
    pulseColorBoost: number;

    ringEnabled: boolean;
    ringInnerRegionVisible: boolean;
    ringOrigin: Vector3;
    ringRadius: number;
    ringWidth: number;
    ringColor: Vector3;

    spreadEnabled: boolean;
    spreadOrigin: Vector3;
    spreadRadius: number;
    spreadPreRadius: number;
    spreadPreScale: number;
    spreadColorBlendRadius: number;
    spreadColorBlendBase: Vector4;

    remyEnabled: boolean;
    remyOrigin: Vector3;
    remyPreRadius: number;
    remyPreScale: number;
    remyDenseRadius: number;
    remyDenseScale: number;
    remyDenseMinRatio: number;
    remyDenseMaxRatio: number;
    remyColorBlendRadius: number;
    remyColorBlendBase: Vector4;
    remyNormalRadius: number;
    remyRingRadius: number;
    remyRingWidth: number;
    remyRingInnerColor: Vector4;
    remyRingMidRatios: number;
    remyRingMidColor: Vector4;
    remyRingOuterColor: Vector4;

    magicEnabled: boolean;
    magicOrigin: Vector3;
    magicExpandRadius: number;
    magicInitialSize: number;
    magicInitialAlpha: number;
    magicInitialDensity: number;
    magicExpandJitterAmount: number;
    magicExpandScale: number;
    magicColorBlendRadius: number;
    magicColorBlendBase: Vector4;
    magicRingRadius: number;
    magicRingWidth: number;
    magicRingColor: Vector4;
    magicRingJitterAmount: number;

    overrideEnabled: boolean;
    overrideColor: Vector4;
}

/**
 * Base scene object for Gaussian splat renderables.
 */
export abstract class Splat extends Object3D {
    abstract readonly PackType: string;
    abstract createUnpackSplatShader(): string;
    abstract createUnpackSHShader(): string;

    readonly isSplat: boolean = true;
    /**
     * @internal
     */
    version: number = 0;

    offset: number = 0;
    counts: number;
    shDegree: number;

    autoFreeResourceOnGpuPacked: boolean = false;
    maxShDegree: number = 3;

    /**
     * @internal
     */
    extrasTex: SourceTexture[] = [];

    /**
     * @internal
     */
    groupTex?: SourceTexture;
    /**
     * @internal
     */
    groupTransformTex?: SourceTexture;

    /**
     * @internal
     */
    stateTex?: SourceTexture;

    /**
     * @internal
     */
    extrasUBO: UniformBlockObject[] = [];

    /**
     * @internal
     */
    effect: SplatEffectConfig = {
        enabled: false,

        pulseEnabled: false,
        pulseSparseThreshold: 0,
        pulseJitterPhase: 0,
        pulseJitterAmount: 0.01,
        pulsePhase: 0,
        pulseAmount: 0.4,
        pulseSize: 0.005,
        pulseSizeVariance: 0.01,
        pulseColorBoost: 1.2,

        ringEnabled: false,
        ringInnerRegionVisible: true,
        ringOrigin: new Vector3(0, 0, 0),
        ringRadius: 0,
        ringWidth: 2,
        ringColor: new Vector3(0.627, 0.682, 0.961),

        spreadEnabled: false,
        spreadOrigin: new Vector3(0, 0, 0),
        spreadRadius: 0,
        spreadPreRadius: 0,
        spreadPreScale: 0.2,
        spreadColorBlendRadius: 1,
        spreadColorBlendBase: new Vector4(0.3, 0.3, 0.3, 0.3),

        remyEnabled: false,
        remyOrigin: new Vector3(0, 0, 0),
        remyPreRadius: 0,
        remyPreScale: 0.001,
        remyDenseRadius: 0,
        remyDenseScale: 1,
        remyDenseMinRatio: 0.2,
        remyDenseMaxRatio: 0.4,
        remyColorBlendRadius: 0,
        remyColorBlendBase: new Vector4(0, 0.8, 0.48, 0.6),
        remyNormalRadius: 0,
        remyRingRadius: 0,
        remyRingWidth: 6,
        remyRingInnerColor: new Vector4(0.2, 0.4, 1.0, 0.4),
        remyRingMidRatios: 0.5,
        remyRingMidColor: new Vector4(0.72, 0.38, 0.3, 0.4),
        remyRingOuterColor: new Vector4(0.9, 0.64, 0.02, 0.4),

        magicEnabled: false,
        magicOrigin: new Vector3(0, 0, 0),
        magicInitialSize: 0.002,
        magicInitialAlpha: 0.6,
        magicInitialDensity: 0.2,
        magicExpandRadius: 0,
        magicExpandJitterAmount: 0,
        magicExpandScale: 2,
        magicColorBlendRadius: 0,
        magicColorBlendBase: new Vector4(0, 1, 0.68, 0.6),
        magicRingRadius: 0,
        magicRingWidth: 0.1,
        magicRingColor: new Vector4(1, 1, 1, 1),
        magicRingJitterAmount: 0,

        overrideEnabled: false,
        overrideColor: new Vector4(1, 1, 1, 1),
    };

    constructor(counts: number, shDegree: number) {
        super();
        this.counts = counts;
        this.shDegree = shDegree;
    }

    private isRenderingStability: boolean = false;
    /**
     * @internal
     */
    onUpdateRenderingStability(stable: boolean) {
        if (this.isRenderingStability === stable) {
            return;
        }
        this.emit(SplatRenderingStabilityChangedEvent, (this.isRenderingStability = stable));
    }

    /**
     * @internal
     */
    abstract onGpuDataPacked(): void;

    /**
     * @internal
     */
    onSorted() {
        this.emit(SplatSortedEvent);
    }

    updateVersion() {
        this.version++;
    }

    setEffectConfig(config: Partial<SplatEffectConfig>) {
        this.effect = { ...this.effect, ...config };
        this.updateVersion();
    }

    freeGPU() {
        super.freeGPU();
        this.groupTex?.freeGPU();
        this.groupTransformTex?.freeGPU();
        this.stateTex?.freeGPU();
        this.extrasTex.forEach(item => item.freeGPU());
    }
}
