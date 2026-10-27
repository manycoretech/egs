import { deferred } from '@qunhe/egs-lib';
import type { ISplatData, ISingleSplat, IData, SplatStreamChunk } from '../types.js';

export abstract class SplatData implements IData {
    readonly counts: number;
    readonly shDegree: number;
    readonly maxShDegree: number;
    readonly maxTextureSize: number;

    /** True until complete encoded CPU data is retained, including after a GPU-only load. */
    stream = false;
    private streamSignal?: AbortSignal;
    private streamByteLengths: number[] = [];
    private chunkReader?: (consume: (chunk: SplatStreamChunk) => Promise<void>, release: boolean) => Promise<void>;
    private cancelSource?: (reason?: unknown) => void;

    get byteLengths(): readonly number[] {
        return this.stream
            ? this.streamByteLengths
            : this.serialize().samplers.map(sampler => sampler.source.byteLength);
    }

    get signal() {
        return this.streamSignal;
    }

    /** @internal Attach worker-produced metadata and its single-consumer stream. */
    setStream(
        data: ISplatData,
        byteLengths: number[],
        read: (consume: (chunk: SplatStreamChunk) => Promise<void>, release: boolean) => Promise<void>,
        cancel: (reason?: unknown) => void,
        signal?: AbortSignal,
    ) {
        this.deserialize(data);
        this.stream = true;
        this.streamByteLengths = byteLengths;
        this.chunkReader = read;
        this.cancelSource = cancel;
        this.streamSignal = signal;
    }

    /** Consume once; release detaches chunk buffers after each callback resolves. Defaults to caller-owned buffers. */
    async readChunks(consume: (chunk: SplatStreamChunk) => Promise<void>, release = false): Promise<void> {
        const read = this.chunkReader;
        if (!read) {
            throw new Error('Splat data is not streaming or has already been consumed.');
        }
        this.chunkReader = undefined;
        try {
            await read(consume, release);
        } finally {
            this.cancelSource = undefined;
        }
    }

    /** Collect the same stream into complete CPU buffers without re-encoding. */
    async collect(): Promise<this> {
        if (!this.stream) {
            return this;
        }
        if (!this.chunkReader) {
            throw new Error('Splat stream has already been consumed.');
        }
        const data = this.serialize();
        const samplers = data.samplers.map((sampler, index) => ({
            ...sampler,
            source: new Uint8Array(this.streamByteLengths[index]),
        }));
        await this.readChunks(async chunk => {
            for (const { index, offset, source } of chunk.samplers) {
                samplers[index].source.set(source, offset);
            }
        }, true);
        this.deserialize({ ...data, samplers });
        this.stream = false;
        this.streamByteLengths = [];
        return this;
    }

    cancel(reason?: unknown) {
        this.cancelSource?.(reason);
        this.cancelSource = undefined;
        this.chunkReader = undefined;
    }

    private blockCounts: number;

    constructor(maxShDegree: number = 3, maxTextureSize: number = 16384, blockCounts: number = 1) {
        this.blockCounts = blockCounts;
        this.maxShDegree = maxShDegree;
        this.maxTextureSize = maxTextureSize;
    }

    private totalBlockCounts: number = 0;
    private totalBlockShDegree: number = 3;
    private blockOffsets: number[] = [];
    private blockExecs: Function[] = [];
    private currentBlockIndex: number = 0;
    initBlock(counts: number, shDegree: number) {
        this.blockOffsets.push(this.totalBlockCounts);
        this.totalBlockCounts += counts;
        this.totalBlockShDegree = Math.min(shDegree, this.totalBlockShDegree);
        const { promise, resolve } = deferred<number>();
        this.blockExecs.push(resolve);
        if (this.blockOffsets.length === this.blockCounts) {
            this.init(this.totalBlockCounts, this.totalBlockShDegree);
            this.blockExecs[this.currentBlockIndex](this.blockOffsets[0]);
        }
        return promise;
    }

    finishBlock() {
        this.currentBlockIndex++;
        this.blockExecs[this.currentBlockIndex]?.(this.blockOffsets[this.currentBlockIndex]);
    }

    abstract init(counts: number, shDegree: number): void;

    abstract set(i: number, single: ISingleSplat): void;
    abstract setCenter(i: number, x: number, y: number, z: number): void;
    abstract setScale(i: number, sx: number, sy: number, sz: number): void;
    abstract setQuat(i: number, qx: number, qy: number, qz: number, qw: number): void;
    abstract setColor(i: number, r: number, g: number, b: number): void;
    abstract setAlpha(i: number, a: number): void;
    abstract setShN(i: number, shN: number[]): void;

    abstract get(i: number, single: ISingleSplat): void;
    abstract getCenter(i: number, single: ISingleSplat): void;
    abstract getScale(i: number, single: ISingleSplat): void;
    abstract getQuat(i: number, single: ISingleSplat): void;
    abstract getColor(i: number, single: ISingleSplat): void;
    abstract getAlpha(i: number, single: ISingleSplat): void;
    abstract getShN(i: number, shN: number[]): void;

    abstract fillCenters(centers: Float32Array): void;

    abstract serialize(): ISplatData;
    abstract deserialize(data: ISplatData): void;
}
