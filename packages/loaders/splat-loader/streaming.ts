import { type SplatData, RawSplatData, CompressedSplatData, SuperCompressedSplatData } from './splat/index.js';
import {
    SplatPackType,
    type IData,
    type ISingleSplat,
    type ISplatData,
    type ParseExtras,
    type SplatStreamChunk,
} from './types.js';
import { computeTextureSize } from './utils/texture.js';

export const SPLAT_STREAM_CHUNK_BYTES = 16 * 1024 * 1024;

export interface SplatStreamSink {
    onHeader(data: ISplatData, byteLengths: number[]): Promise<void>;
    onChunk(chunk: SplatStreamChunk): Promise<void>;
}

export function createStreamingData(
    packType: SplatPackType,
    extras: Partial<ParseExtras>,
    sink: SplatStreamSink,
    returnedBuffers: ArrayBuffer[] = [],
): IData & { flush(): Promise<void> } {
    const Data: new (
        maxShDegree?: number,
        maxTextureSize?: number,
    ) => IData & Pick<SplatData, 'init' | 'serialize' | 'deserialize' | 'maxTextureSize'> =
        packType === SplatPackType.Raw
            ? RawSplatData
            : packType === SplatPackType.Compressed
              ? CompressedSplatData
              : SuperCompressedSplatData;
    const splatSamplers = packType === SplatPackType.Raw ? 14 : packType === SplatPackType.Compressed ? 2 : 1;
    const chunkBytes = extras.chunkBytes ?? SPLAT_STREAM_CHUNK_BYTES;
    return new (class extends Data {
        private chunkOffset = 0;
        private chunkCounts = 0;
        private pendingCounts = 0;
        private components: number[] = [];
        private channel: 'all' | 'splat' | 'sh' | number = 'all';
        private prepareChunk?: () => void;

        async initBlock(counts: number, shDegree: number) {
            if (
                !Number.isSafeInteger(counts) ||
                counts < 0 ||
                !Number.isInteger(shDegree) ||
                shDegree < 0 ||
                shDegree > 3
            ) {
                throw new Error('Invalid splat header.');
            }
            const inputDegree = shDegree;
            this.init(1, shDegree);
            shDegree = this.shDegree;
            const probe = this.serialize();
            this.components = probe.samplers.map(sampler => sampler.source.byteLength / 4);
            const bytesPerSplat = this.components.reduce((sum, value) => sum + value * 4, 0);
            const budgetCounts = Math.floor(chunkBytes / bytesPerSplat);
            if (!budgetCounts) {
                throw new RangeError('chunkBytes must fit at least one encoded splat (' + bytesPerSplat + ' bytes).');
            }
            const {
                w: width,
                h: height,
                d: depth,
            } = packType === SplatPackType.Raw
                ? { w: counts, h: 1, d: 1 }
                : computeTextureSize(counts, this.maxTextureSize);
            const row = packType === SplatPackType.Raw ? 1 : Math.max(1, width);
            const capacity = Math.floor(budgetCounts / row) * row || 2 ** Math.floor(Math.log2(budgetCounts));
            await sink.onHeader(
                {
                    counts,
                    shDegree,
                    samplers: probe.samplers.map(sampler => ({
                        ...sampler,
                        width,
                        height,
                        depth,
                        source: new Uint8Array(0),
                    })),
                },
                this.components.map(value => value * 4 * width * height * depth),
            );
            this.init(Math.min(counts, capacity), inputDegree);
            return 0;
        }

        finishBlock() {}

        get availableChunkCounts() {
            return this.counts - this.pendingCounts;
        }

        async beginChunk(offset: number, counts: number, channel: 'all' | 'splat' | 'sh' | number) {
            if (
                this.pendingCounts &&
                (typeof channel === 'number' ||
                    channel !== this.channel ||
                    offset !== this.chunkOffset + this.pendingCounts)
            ) {
                await this.flush();
            }
            this.prepareChunk?.();
            this.prepareChunk = undefined;
            if (!this.pendingCounts) {
                this.chunkOffset = offset;
            }
            this.chunkCounts = counts;
            this.channel = channel;
        }

        set(index: number, single: ISingleSplat) {
            super.set(index - this.chunkOffset, single);
        }
        setCenter(index: number, x: number, y: number, z: number) {
            super.setCenter(index - this.chunkOffset, x, y, z);
        }
        setScale(index: number, x: number, y: number, z: number) {
            super.setScale(index - this.chunkOffset, x, y, z);
        }
        setQuat(index: number, x: number, y: number, z: number, w: number) {
            super.setQuat(index - this.chunkOffset, x, y, z, w);
        }
        setColor(index: number, r: number, g: number, b: number) {
            super.setColor(index - this.chunkOffset, r, g, b);
        }
        setAlpha(index: number, value: number) {
            super.setAlpha(index - this.chunkOffset, value);
        }
        setShN(index: number, values: number[]) {
            super.setShN(index - this.chunkOffset, values);
        }
        getShN(index: number, values: number[]) {
            super.getShN(index - this.chunkOffset, values);
        }

        async endChunk() {
            this.pendingCounts += this.chunkCounts;
            if (this.pendingCounts === this.counts) {
                await this.flush();
            }
        }

        async flush() {
            if (!this.pendingCounts) {
                return;
            }
            const data = this.serialize();
            const samplers = data.samplers.flatMap((sampler, index) => {
                if (
                    !this.components[index] ||
                    (this.channel === 'splat' && index >= splatSamplers) ||
                    (this.channel === 'sh' && index < splatSamplers) ||
                    (typeof this.channel === 'number' && index !== this.channel)
                ) {
                    return [];
                }
                return [
                    {
                        index,
                        offset: this.chunkOffset * this.components[index] * 4,
                        source: new Uint8Array(
                            sampler.source.buffer,
                            sampler.source.byteOffset,
                            this.pendingCounts * this.components[index] * 4,
                        ),
                    },
                ];
            });
            if (samplers.length) {
                // Only reuse buffers explicitly returned by a completed consumer.
                const sizes = samplers.map(({ index }) => data.samplers[index].source.byteLength);
                this.prepareChunk = () => {
                    samplers.forEach(({ index }, i) => {
                        const reused = returnedBuffers.findIndex(buffer => buffer.byteLength === sizes[i]);
                        data.samplers[index].source =
                            reused < 0
                                ? new Uint8Array(sizes[i])
                                : new Uint8Array(returnedBuffers.splice(reused, 1)[0]).fill(0);
                    });
                    this.deserialize(data);
                };
                await sink.onChunk({ samplers });
            }
            this.pendingCounts = 0;
        }
    })(extras.maxShDegree, extras.maxTextureSize);
}
