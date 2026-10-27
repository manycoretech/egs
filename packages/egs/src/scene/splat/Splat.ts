import { Object3D } from '../Object3D.js';
import { EventType } from '../../utils/EventDispatcher.js';
import type { UniformBlockObject } from '../../renderer/shader/components/UniformBlockObject.js';
import type { SourceTexture } from '../../elements/textures/SourceTexture.js';
import type { MipLevelSource } from '../../elements/textures/SourceTexture.js';
import { type SplatModifier, SplatModifierUpdateEvent } from './SplatModifier.js';

/** Backend operations on a Splat's encoded source data. */
export interface SplatSource {
    validate(): void;
    readback(): Promise<MipLevelSource[]>;
}

/**
 * Event emitted when splat rendering stability changes.
 */
export const SplatRenderingStabilityChangedEvent = new EventType<boolean>();
/**
 * Event emitted after splat ordering has been updated.
 */
export const SplatSortedEvent = new EventType();

/**
 * Bit flags that control splat visibility and appearance.
 */
export enum SplatState {
    Deleted = 1,
    Selected = 2,
    DisableSH = 4,
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
    /** True when the source is only retained on the GPU. */
    stream = false;
    private source?: SplatSource;
    private reading?: Promise<this>;

    /** @internal The loading consumer supplies the backend's read operation. */
    setStreamSource(source: SplatSource) {
        this.stream = true;
        this.source = source;
    }

    /** @internal GPU-only sources must remain on their original context. */
    checkSource() {
        if (!this.stream) {
            return;
        }
        if (!this.source) {
            throw new Error('Splat source has been released; reload the data.');
        }
        this.source.validate();
    }

    /** Restore CPU source data for editing, export and later GPU recreation. */
    readback(): Promise<this> {
        if (!this.stream) {
            return Promise.resolve(this);
        }
        if (this.reading) {
            return this.reading;
        }
        const source = this.source;
        if (!source) {
            return Promise.reject(new Error('Splat source has been released.'));
        }
        this.reading = (async () => {
            source.validate();
            const sources = await source.readback();
            if (source !== this.source) {
                throw new Error('Splat source was released during readback.');
            }
            sources.forEach((source, index) => this.extrasTex[index].setLevelData(source, 0));
            this.source = undefined;
            this.stream = false;
            this.updateVersion();
            return this;
        })().finally(() => {
            this.reading = undefined;
        });
        return this.reading;
    }
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
        this.source = undefined;
        super.freeGPU();
        this.stateTex?.freeGPU();
        this.extrasTex.forEach(item => item.freeGPU());
    }

    destroy() {
        this.freeGPU();
        super.destroy();
    }
}
