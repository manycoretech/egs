import {
    SplatPackType,
    type ISingleSplat,
    type ISplatData,
    type SplatPart,
    type SplatStreamMessage,
} from '../types.js';
import { SplatData } from './SplatData.js';
import { computeTextureSize } from '../utils/texture.js';

interface SamplerState {
    index: number;
    stride: number;
    tail: Uint8Array;
}

export class StreamSplatData extends SplatData {
    counts = 0;
    shDegree = 0;
    readonly packType: SplatPackType;

    private baseSamplerCount = 1;
    private layout: ISplatData;
    private samplers: SamplerState[];
    private writing: SamplerState[] = [];
    private offset = 0;

    constructor(
        private block: SplatData,
        private output: (message: SplatStreamMessage) => void | Promise<void>,
        readonly chunkBytes = 16 * 1024 * 1024,
        private returned: ArrayBuffer[] = [],
    ) {
        super(block.maxShDegree, block.maxTextureSize, block.blockCounts);
        this.packType = this.block.packType;
        if (this.packType === SplatPackType.Raw) {
            this.baseSamplerCount = 14;
        } else if (this.packType === SplatPackType.Compressed) {
            this.baseSamplerCount = 2;
        }
    }

    async init(counts: number, shDegree: number) {
        await this.block.init(1, shDegree);
        const sample = this.block.serialize();
        const {
            w: width,
            h: height,
            d: depth,
        } = this.packType === SplatPackType.Raw
            ? { w: counts, h: 1, d: 1 }
            : computeTextureSize(counts, this.block.maxTextureSize);
        this.counts = counts;
        this.shDegree = sample.shDegree;
        this.samplers = sample.samplers.map((sampler, index) => ({
            index,
            stride: sampler.source.byteLength,
            tail: new Uint8Array(0),
        }));
        this.layout = {
            ...sample,
            counts,
            samplers: sample.samplers.map(sampler => ({ ...sampler, width, height, depth, source: new Uint8Array(0) })),
        };
        await this.output({
            data: this.layout,
            byteLengths: this.layout.samplers.map(
                (sampler, index) => this.samplers[index].stride * sampler.width * sampler.height * sampler.depth,
            ),
        });
    }

    initChunk(offset: number, counts: number, part: SplatPart, chunkBytes = this.chunkBytes) {
        let first = 0;
        let last = this.samplers.length;
        if (typeof part === 'number') {
            first = part;
            last = part + 1;
        } else if (part === 'splat') {
            last = this.baseSamplerCount;
        } else if (part === 'sh') {
            first = this.baseSamplerCount;
        }
        this.writing = this.samplers.filter(({ index, stride }) => index >= first && index < last && stride > 0);
        const width = this.layout.samplers[0].width;
        const stride = this.writing.reduce((sum, sampler) => sum + sampler.stride, 0);
        if (stride) {
            const rows = Math.max(1, Math.floor(chunkBytes / (width * stride)));
            counts = Math.min(counts, rows * width - (offset % width));
        }
        this.offset = Math.floor(offset / width) * width;
        const blockCounts = offset + counts - this.offset;
        const pixels = Math.ceil(blockCounts / width) * width;
        const samplers = this.layout.samplers.map(sampler => ({ ...sampler, height: pixels / width, depth: 1 }));
        for (const sampler of this.writing) {
            const bytes = pixels * sampler.stride;
            const reusable = this.returned.findIndex(buffer => buffer.byteLength === bytes);
            const source = new Uint8Array(reusable < 0 ? new ArrayBuffer(bytes) : this.returned.splice(reusable, 1)[0]);
            if (reusable >= 0) {
                source.fill(0);
            }
            source.set(sampler.tail);
            sampler.tail = new Uint8Array(0);
            samplers[sampler.index].source = source;
        }
        this.returned.length = 0;
        this.block.deserialize({ counts: blockCounts, shDegree: this.shDegree, samplers });
        return counts;
    }

    async commitChunk() {
        const { counts, samplers } = this.block.serialize();
        const width = this.layout.samplers[0].width;
        const end = this.offset + counts;
        const pixels = end === this.counts ? Math.ceil(counts / width) * width : Math.floor(counts / width) * width;
        const recycle = samplers.reduce((sum, sampler) => sum + sampler.source.byteLength, 0) <= this.chunkBytes;
        for (const sampler of this.writing) {
            const { index, stride } = sampler;
            const source = samplers[index].source;
            const bytes = pixels * stride;
            // Only an unfinished row is carried across file or block boundaries.
            if (counts > pixels) {
                sampler.tail = source.slice(bytes, counts * stride);
            }
            if (bytes) {
                await this.output({
                    index,
                    offset: this.offset * stride,
                    source: source.subarray(0, bytes),
                    recycle,
                });
            }
        }
    }

    getSamplerSource(index: number, offset: number) {
        return this.block.getSamplerSource(index, offset - this.offset);
    }

    set(i: number, value: ISingleSplat) {
        this.block.set(i - this.offset, value);
    }
    setCenter(i: number, x: number, y: number, z: number) {
        this.block.setCenter(i - this.offset, x, y, z);
    }
    setScale(i: number, x: number, y: number, z: number) {
        this.block.setScale(i - this.offset, x, y, z);
    }
    setLogScale(i: number, x: number, y: number, z: number) {
        this.block.setLogScale(i - this.offset, x, y, z);
    }
    setQuat(i: number, x: number, y: number, z: number, w: number) {
        this.block.setQuat(i - this.offset, x, y, z, w);
    }
    setColor(i: number, r: number, g: number, b: number) {
        this.block.setColor(i - this.offset, r, g, b);
    }
    setAlpha(i: number, a: number) {
        this.block.setAlpha(i - this.offset, a);
    }
    setShN(i: number, sh: number[]) {
        this.block.setShN(i - this.offset, sh);
    }
    get(i: number, value: ISingleSplat) {
        this.block.get(i - this.offset, value);
    }
    getCenter(i: number, value: ISingleSplat) {
        this.block.getCenter(i - this.offset, value);
    }
    getScale(i: number, value: ISingleSplat) {
        this.block.getScale(i - this.offset, value);
    }
    getQuat(i: number, value: ISingleSplat) {
        this.block.getQuat(i - this.offset, value);
    }
    getColor(i: number, value: ISingleSplat) {
        this.block.getColor(i - this.offset, value);
    }
    getAlpha(i: number, value: ISingleSplat) {
        this.block.getAlpha(i - this.offset, value);
    }
    getShN(i: number, sh: number[]) {
        this.block.getShN(i - this.offset, sh);
    }

    fillCenters(centers: Float32Array) {
        this.block.fillCenters(centers.subarray(this.offset * 3));
    }

    serialize(): ISplatData {
        return this.layout;
    }

    deserialize(data: ISplatData) {
        this.block.deserialize(data);
        this.counts = data.counts;
        this.shDegree = data.shDegree;
        this.layout = data;
        this.offset = 0;
    }
}
