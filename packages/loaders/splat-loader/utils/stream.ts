import type { IData } from '../types.js';

export class ByteStreamCursor {
    private reader: ReadableStreamDefaultReader<Uint8Array>;
    private chunk: Uint8Array | undefined;
    private chunkOffset = 0;

    constructor(stream: ReadableStream<Uint8Array>) {
        this.reader = stream.getReader();
    }

    cancel(reason?: unknown) {
        this.chunk = undefined;
        this.chunkOffset = 0;
        return this.reader.cancel(reason);
    }

    private async ensureChunk() {
        while (!this.chunk || this.chunkOffset >= this.chunk.byteLength) {
            const { done, value } = await this.reader.read();
            if (done || !value) {
                return false;
            }
            this.chunk = value;
            this.chunkOffset = 0;
        }
        return true;
    }

    private advance(byteLength: number) {
        this.chunkOffset += byteLength;
        if (this.chunkOffset === this.chunk!.byteLength) {
            this.chunk = undefined;
            this.chunkOffset = 0;
        }
    }

    async readInto(target: Uint8Array, offset = 0, byteLength = target.byteLength - offset) {
        if (
            !Number.isSafeInteger(offset) ||
            !Number.isSafeInteger(byteLength) ||
            offset < 0 ||
            byteLength < 0 ||
            offset + byteLength > target.byteLength
        ) {
            throw new RangeError('Invalid stream read range');
        }

        const end = offset + byteLength;
        while (offset < end) {
            if (!(await this.ensureChunk())) {
                throw new Error('Stream ended unexpectedly');
            }
            const copyLength = Math.min(end - offset, this.chunk!.byteLength - this.chunkOffset);
            target.set(this.chunk!.subarray(this.chunkOffset, this.chunkOffset + copyLength), offset);
            this.advance(copyLength);
            offset += copyLength;
        }
    }

    async readChunks(byteLength: number, onChunk: (chunk: Uint8Array) => void | Promise<void>) {
        if (!Number.isSafeInteger(byteLength) || byteLength < 0) {
            throw new RangeError(`Invalid stream read length: ${byteLength}`);
        }

        let remaining = byteLength;
        while (remaining > 0) {
            if (!(await this.ensureChunk())) {
                throw new Error('Stream ended unexpectedly');
            }
            const chunkLength = Math.min(remaining, this.chunk!.byteLength - this.chunkOffset);
            const chunk = this.chunk!.subarray(this.chunkOffset, this.chunkOffset + chunkLength);
            this.advance(chunkLength);
            remaining -= chunkLength;
            await onChunk(chunk);
        }
    }

    skip(byteLength: number) {
        return this.readChunks(byteLength, () => {});
    }

    async readUntil(delimiter: Uint8Array) {
        if (delimiter.byteLength === 0) {
            throw new RangeError('Stream delimiter must not be empty');
        }

        const prefix = new Uint32Array(delimiter.byteLength);
        for (let i = 1, matched = 0; i < delimiter.byteLength; i++) {
            while (matched > 0 && delimiter[i] !== delimiter[matched]) {
                matched = prefix[matched - 1];
            }
            if (delimiter[i] === delimiter[matched]) {
                matched++;
            }
            prefix[i] = matched;
        }

        const chunks: Uint8Array[] = [];
        let byteLength = 0;
        let matched = 0;
        while (await this.ensureChunk()) {
            const source = this.chunk!;
            const start = this.chunkOffset;
            let end = start;
            for (; end < source.byteLength; end++) {
                const value = source[end];
                while (matched > 0 && value !== delimiter[matched]) {
                    matched = prefix[matched - 1];
                }
                if (value === delimiter[matched]) {
                    matched++;
                }
                if (matched === delimiter.byteLength) {
                    end++;
                    break;
                }
            }

            const chunk = source.subarray(start, end);
            this.advance(chunk.byteLength);
            if (matched === delimiter.byteLength && chunks.length === 0) {
                return chunk;
            }
            // A BYOB reader may transfer and reuse the backing buffer on the next read.
            chunks.push(chunk.slice());
            byteLength += chunk.byteLength;
            if (matched === delimiter.byteLength) {
                const result = new Uint8Array(byteLength);
                let offset = 0;
                for (const part of chunks) {
                    result.set(part, offset);
                    offset += part.byteLength;
                }
                return result;
            }
        }

        throw new Error('Stream ended unexpectedly');
    }

    async readExact(byteLength: number) {
        if (!Number.isSafeInteger(byteLength) || byteLength < 0) {
            throw new RangeError(`Invalid stream read length: ${byteLength}`);
        }
        if (byteLength === 0) {
            return new Uint8Array(0);
        }
        if (!(await this.ensureChunk())) {
            throw new Error('Stream ended unexpectedly');
        }

        const available = this.chunk!.byteLength - this.chunkOffset;
        if (byteLength <= available) {
            const result = this.chunk!.subarray(this.chunkOffset, this.chunkOffset + byteLength);
            this.advance(byteLength);
            return result;
        }

        const result = new Uint8Array(byteLength);
        await this.readInto(result);
        return result;
    }

    async readUint32(littleEndian: boolean = true) {
        const buffer = await this.readExact(4);
        return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength).getUint32(0, littleEndian);
    }
}

export interface ChunkDecoder {
    init(): Promise<[number, number]> | [number, number]; // [totals, itemSize]
    maxCounts?(): number;
    decode(offset: number, counts: number, buffer: Uint8Array): void | Promise<void>;
}

export const STREAM_CHUNK_COUNTS = 16384;

/** Bound encoded output while keeping the format's point/column decoding order. */
export async function forEachSplatChunk(
    data: IData,
    offset: number,
    counts: number,
    consume: (start: number, counts: number) => void | Promise<void>,
    channel: 'all' | 'splat' | 'sh' | number = 'all',
) {
    for (let start = 0; start < counts;) {
        const size = Math.min(data.availableChunkCounts ?? STREAM_CHUNK_COUNTS, counts - start);
        await data.beginChunk?.(offset + start, size, channel);
        await consume(start, size);
        await data.endChunk?.();
        start += size;
    }
}

export class StreamChunkDecoder {
    constructor(private cursor: ByteStreamCursor) {}

    /** Column files require input columns before complete points can be emitted. */
    async decodeColumns(decoders: ChunkDecoder[], data: IData, offset: number) {
        const columns: { decoder: ChunkDecoder; itemSize: number; bytes: Uint8Array }[] = [];
        for (const decoder of decoders.slice(0, -1)) {
            const [totals, itemSize] = await decoder.init();
            const bytes = new Uint8Array(totals * itemSize);
            await this.cursor.readInto(bytes);
            columns.push({ decoder, itemSize, bytes });
        }
        const last = decoders[decoders.length - 1];
        if (!last) return;
        await this.decode([
            {
                init: last.init,
                maxCounts: () => data.availableChunkCounts ?? STREAM_CHUNK_COUNTS,
                decode: async (start, size, bytes) => {
                    await data.beginChunk?.(offset + start, size, 'all');
                    for (const column of columns) {
                        await column.decoder.decode(
                            start,
                            size,
                            column.bytes.subarray(start * column.itemSize, (start + size) * column.itemSize),
                        );
                    }
                    await last.decode(start, size, bytes);
                    await data.endChunk?.();
                },
            },
        ]);
    }

    async decode(decoders: ChunkDecoder[]) {
        for (const decoder of decoders) {
            const [totals, itemSize] = await decoder.init();
            if (totals === 0 || itemSize === 0) {
                continue;
            }

            const pending = new Uint8Array(itemSize);
            let pendingByteLength = 0;
            let decoded = 0;
            await this.cursor.readChunks(totals * itemSize, async chunk => {
                let chunkOffset = 0;
                if (pendingByteLength > 0) {
                    const copyLength = Math.min(itemSize - pendingByteLength, chunk.byteLength);
                    pending.set(chunk.subarray(0, copyLength), pendingByteLength);
                    pendingByteLength += copyLength;
                    chunkOffset += copyLength;
                    if (pendingByteLength === itemSize) {
                        await decoder.decode(decoded, 1, pending);
                        decoded++;
                        pendingByteLength = 0;
                    }
                }

                while (chunk.byteLength - chunkOffset >= itemSize) {
                    const counts = Math.min(
                        decoder.maxCounts?.() ?? STREAM_CHUNK_COUNTS,
                        Math.floor((chunk.byteLength - chunkOffset) / itemSize),
                    );
                    const batchByteLength = counts * itemSize;
                    await decoder.decode(decoded, counts, chunk.subarray(chunkOffset, chunkOffset + batchByteLength));
                    decoded += counts;
                    chunkOffset += batchByteLength;
                }

                if (chunkOffset < chunk.byteLength) {
                    const remainder = chunk.subarray(chunkOffset);
                    pending.set(remainder);
                    pendingByteLength = remainder.byteLength;
                }
            });

            if (pendingByteLength !== 0 || decoded !== totals) {
                throw new Error(`Invalid stream data: expected ${totals} items, got ${decoded}`);
            }
        }
    }
}

/** Reuse a bounded input buffer without reading ahead of its consumer. */
export function bufferedInput(stream: ReadableStream<Uint8Array>, byteLength: number, signal: AbortSignal) {
    signal.throwIfAborted();
    let reader: ReadableStreamDefaultReader<Uint8Array> | ReadableStreamBYOBReader;
    let buffer: ArrayBuffer | undefined;
    try {
        reader = stream.getReader({ mode: 'byob' });
        buffer = new ArrayBuffer(byteLength);
    } catch {
        reader = stream.getReader();
    }
    let closed = false;
    let controller: ReadableStreamDefaultController<Uint8Array>;
    const close = async (reason?: unknown) => {
        if (closed) return;
        closed = true;
        signal.removeEventListener('abort', abort);
        await reader.cancel(reason).catch(() => {});
        reader.releaseLock();
        buffer = undefined;
    };
    const abort = () => {
        controller.error(signal.reason);
        void close(signal.reason);
    };
    return new ReadableStream<Uint8Array>(
        {
            start(value) {
                controller = value;
                signal.addEventListener('abort', abort, { once: true });
            },
            async pull() {
                try {
                    const { done, value } = buffer
                        ? await (reader as ReadableStreamBYOBReader).read(new Uint8Array(buffer))
                        : await (reader as ReadableStreamDefaultReader<Uint8Array>).read();
                    if (closed) return;
                    if (buffer && value) buffer = value.buffer as ArrayBuffer;
                    if (done) {
                        controller.close();
                        await close();
                    } else controller.enqueue(value);
                } catch (error) {
                    if (!closed) {
                        controller.error(error);
                        await close(error);
                    }
                }
            },
            cancel: close,
        },
        { highWaterMark: 0 },
    );
}

export async function probeStream(
    stream: ReadableStream<Uint8Array>,
): Promise<{ magic: number; stream: ReadableStream<Uint8Array> }> {
    const reader = stream.getReader();
    const prefix: Uint8Array[] = [];
    let magic = 0;
    let length = 0;
    try {
        while (length < 4) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            // A BYOB source can detach its previous buffer on the next read.
            prefix.push(length + value.length < 4 ? value.slice() : value);
            for (let i = 0; i < value.length && length < 4; i++, length++) {
                magic |= value[i] << (length * 8);
            }
        }
    } catch (error) {
        await reader.cancel(error).catch(() => {});
        reader.releaseLock();
        throw error;
    }
    return {
        magic,
        stream: new ReadableStream<Uint8Array>(
            {
                async pull(controller) {
                    if (prefix.length) {
                        controller.enqueue(prefix.shift()!);
                        return;
                    }
                    const { done, value } = await reader.read();
                    if (done) {
                        controller.close();
                        reader.releaseLock();
                    } else controller.enqueue(value);
                },
                async cancel(reason) {
                    await reader.cancel(reason).catch(() => {});
                    reader.releaseLock();
                },
            },
            { highWaterMark: 0 },
        ),
    };
}
