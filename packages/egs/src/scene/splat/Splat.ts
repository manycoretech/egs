import { Object3D } from '../Object3D.js';
import { EventType } from '../../utils/EventDispatcher.js';
import type { UniformBlockObject } from '../../renderer/shader/components/UniformBlockObject.js';
import type { SourceTexture } from '../../elements/textures/SourceTexture.js';
import { type SplatModifier, SplatModifierUpdateEvent } from './SplatModifier.js';

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
    extrasUBO: UniformBlockObject[] = [];

    /**
     * @internal
     */
    stateTex?: SourceTexture;
    /**
     * @internal
     */
    modifiers: SplatModifier[] = [];

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

    updateVersion = () => {
        this.version++;
    };

    setModifiers(modifiers: SplatModifier[]) {
        this.modifiers.forEach(modifier => modifier.off(SplatModifierUpdateEvent, this.updateVersion));
        this.modifiers = modifiers.map(modifier => {
            modifier.on(SplatModifierUpdateEvent, this.updateVersion);
            return modifier;
        });
        this.updateVersion();
    }

    freeGPU() {
        super.freeGPU();
        this.stateTex?.freeGPU();
        this.extrasTex.forEach(item => item.freeGPU());
    }
}
