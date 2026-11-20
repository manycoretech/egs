import { deferred } from '@qunhe/egs-lib';
import type { IData, SplatPart } from '../types.js';

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
            chunks.push(chunk);
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
    decode(offset: number, counts: number, buffer: Uint8Array): void | Promise<void>;
    part?: SplatPart;
}

export class StreamChunkDecoder {
    constructor(
        private cursor: ByteStreamCursor,
        private data: IData,
        private blockOffset = 0,
    ) {}

    async decode(decoders: ChunkDecoder[]) {
        for (const decoder of decoders) {
            const [totals, itemSize] = await decoder.init();
            if (totals === 0 || itemSize === 0) {
                continue;
            }

            const part = decoder.part;
            const pending = new Uint8Array(itemSize);
            let pendingByteLength = 0;
            let decoded = 0;
            while (decoded < totals) {
                const counts =
                    part === undefined
                        ? totals - decoded
                        : this.data.initChunk(this.blockOffset + decoded, totals - decoded, part);
                await this.cursor.readChunks(counts * itemSize, async chunk => {
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

                    const counts = Math.floor((chunk.byteLength - chunkOffset) / itemSize);
                    if (counts > 0) {
                        const batchByteLength = counts * itemSize;
                        await decoder.decode(
                            decoded,
                            counts,
                            chunk.subarray(chunkOffset, chunkOffset + batchByteLength),
                        );
                        decoded += counts;
                        chunkOffset += batchByteLength;
                    }

                    if (chunkOffset < chunk.byteLength) {
                        const remainder = chunk.subarray(chunkOffset);
                        pending.set(remainder);
                        pendingByteLength = remainder.byteLength;
                    }
                });
                if (part !== undefined) {
                    await this.data.commitChunk();
                }
            }
        }
    }
}

export class WorkerStream<R, W> {
    readonly readable: ReadableStream<R>;
    readonly buffers: ArrayBuffer[] = [];
    private controller: ReadableStreamDefaultController<R>;
    private source?: ReadableStreamDefaultReader<W>;
    private requested = deferred<void>();
    private received = deferred<void>();
    private recycled: ArrayBuffer[] = [];
    private readClosed = false;
    private writeClosed = false;
    private error?: unknown;

    constructor(
        private port: MessagePort,
        private transfer: (value: W) => ArrayBuffer[] = () => [],
        recycle: (value: R) => ArrayBuffer[] = () => [],
    ) {
        this.readable = new ReadableStream<R>(
            {
                start: controller => {
                    this.controller = controller;
                },
                pull: () => {
                    const buffers = this.recycled;
                    this.recycled = [];
                    this.received = deferred();
                    port.postMessage({ type: 'pull', buffers }, buffers);
                    return this.received.promise;
                },
                cancel: () => {
                    this.readClosed = true;
                    port.postMessage({ type: 'cancel' });
                    this.closePort();
                },
            },
            { highWaterMark: 0 },
        );
        port.onmessage = ({ data }) => {
            switch (data.type) {
                case 'pull':
                    this.buffers.push(...data.buffers);
                    this.requested.resolve();
                    break;
                case 'data':
                    this.recycled = recycle(data.value);
                    this.controller.enqueue(data.value);
                    this.received.resolve();
                    break;
                case 'end':
                    if (!this.readClosed) {
                        this.controller.close();
                        this.readClosed = true;
                    }
                    this.closePort();
                    break;
                case 'cancel':
                    this.writeClosed = true;
                    this.source?.cancel();
                    this.requested.resolve();
                    this.closePort();
                    break;
                case 'close':
                    this.finish(data.error);
                    break;
            }
        };
    }

    /** The next pull acknowledges consumption and returns reusable buffers. */
    async write(value: W) {
        await this.requested.promise;
        if (this.error) {
            throw this.error;
        }
        if (this.writeClosed) {
            return;
        }
        this.requested = deferred();
        this.port.postMessage({ type: 'data', value }, this.transfer(value));
        await this.requested.promise;
        if (this.error) {
            throw this.error;
        }
    }

    async send(stream: ReadableStream<W>) {
        const reader = (this.source = stream.getReader());
        try {
            await this.requested.promise;
            while (!this.writeClosed) {
                const { value, done } = await reader.read();
                if (done) {
                    break;
                }
                await this.write(value);
            }
        } finally {
            reader.releaseLock();
            this.source = undefined;
        }
        if (!this.writeClosed) {
            // EOF ends this direction; the response may still be in progress.
            this.writeClosed = true;
            this.port.postMessage({ type: 'end' });
            this.closePort();
        }
    }

    close(error?: unknown) {
        this.port.postMessage({ type: 'close', error });
        this.finish(error);
    }

    private finish(error?: unknown) {
        this.error = error;
        if (!this.readClosed) {
            if (error === undefined) {
                this.controller.close();
            } else {
                this.controller.error(error);
            }
        }
        this.source?.cancel();
        this.readClosed = this.writeClosed = true;
        this.requested.resolve();
        this.closePort();
    }

    private closePort() {
        if (this.readClosed) {
            this.received.resolve();
            this.recycled = [];
        }
        if (this.readClosed && this.writeClosed) {
            this.port.onmessage = null;
            this.port.close();
        }
    }
}

export async function probeStream(
    stream: ReadableStream<Uint8Array>,
): Promise<{ magic: number; stream: ReadableStream<Uint8Array> }> {
    const reader = stream.getReader();
    const prefix: Uint8Array[] = [];
    let magic = 0;
    let length = 0;
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
                    } else {
                        controller.enqueue(value);
                    }
                },
                async cancel(reason) {
                    await reader.cancel(reason);
                    reader.releaseLock();
                },
            },
            { highWaterMark: 0 },
        ),
    };
}
