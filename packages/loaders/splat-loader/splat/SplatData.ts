import { deferred } from '@qunhe/egs-lib';
import type { ISplatData,ISingleSplat } from './utils';

export abstract class SplatData {
    readonly counts: number;
    readonly shDegree: number;
    readonly maxShDegree: number;
    readonly maxTextureSize: number;

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
