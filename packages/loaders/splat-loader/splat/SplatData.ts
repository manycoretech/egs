import { deferred } from '@qunhe/egs-lib';
import type { ISplatData, ISingleSplat, IData, SplatPackType, SplatPart, SplatStreamChunk } from '../types.js';

export abstract class SplatData implements IData {
    abstract readonly packType: SplatPackType;
    readonly counts: number;
    readonly shDegree: number;
    readonly maxShDegree: number;
    readonly maxTextureSize: number;
    stream?: { chunks?: ReadableStream<SplatStreamChunk>; byteLengths?: number[] };

    blockCounts: number;

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

    async initBlock(counts: number, shDegree: number) {
        this.blockOffsets.push(this.totalBlockCounts);
        this.totalBlockCounts += counts;
        this.totalBlockShDegree = Math.min(shDegree, this.totalBlockShDegree);
        const { promise, resolve } = deferred<number>();
        this.blockExecs.push(resolve);
        if (this.blockOffsets.length === this.blockCounts) {
            await this.init(this.totalBlockCounts, this.totalBlockShDegree);
            this.blockExecs[this.currentBlockIndex](this.blockOffsets[0]);
        }
        return promise;
    }

    finishBlock() {
        this.currentBlockIndex++;
        this.blockExecs[this.currentBlockIndex]?.(this.blockOffsets[this.currentBlockIndex]);
    }

    initChunk(_offset: number, counts: number, _part: SplatPart, _chunkBytes?: number) {
        return counts;
    }

    async commitChunk() {}

    getSamplerSource(index: number, offset: number) {
        const { source, width, height, depth } = this.serialize().samplers[index];
        const stride = source.byteLength / (width * height * depth);
        return source.subarray(offset * stride);
    }

    abstract init(counts: number, shDegree: number): void | Promise<void>;

    abstract set(i: number, single: ISingleSplat): void;
    abstract setCenter(i: number, x: number, y: number, z: number): void;
    abstract setScale(i: number, sx: number, sy: number, sz: number): void;
    abstract setLogScale(i: number, sx: number, sy: number, sz: number): void;
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

    async collect() {
        const { stream } = this;
        this.stream = undefined;
        if (!stream?.chunks) {
            return;
        }
        const data = this.serialize();
        data.samplers = data.samplers.map(sampler => ({ ...sampler }));
        const reader = stream.chunks.getReader();
        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                break;
            }
            const sampler = data.samplers[value.index];
            const byteLength = stream.byteLengths![value.index];
            if (!value.recycle && value.offset === 0 && value.source.byteLength === byteLength) {
                sampler.source = value.source;
            } else {
                if (!sampler.source.byteLength) {
                    sampler.source = new Uint8Array(byteLength);
                }
                sampler.source.set(value.source, value.offset);
            }
        }
        reader.releaseLock();
        this.deserialize(data);
    }

    release() {
        const data = this.serialize();
        data.samplers = data.samplers.map(sampler => ({ ...sampler, source: new Uint8Array(0) }));
        this.deserialize(data);
    }
}
