import initZstd, { type MainModule, type ZstdDecompressor as NativeZstdDecompressor } from './zstd.js';

type ChunkCallback = (chunk: Uint8Array<ArrayBuffer>) => void;

export interface ZstdDecompressor {
    feed(input: Uint8Array): Uint8Array<ArrayBuffer>[];
    feedView(input: Uint8Array, callback: ChunkCallback): void;
    finish(): Uint8Array<ArrayBuffer>[];
    finishView(callback?: ChunkCallback): void;
    free(): void;
}

const decoderFinalizer =
    typeof FinalizationRegistry === 'undefined'
        ? undefined
        : new FinalizationRegistry<NativeZstdDecompressor>(native => native.delete());

class WasmZstdDecompressor implements ZstdDecompressor {
    private readonly inputPtr: number;
    private readonly inputCapacity: number;
    private readonly outputPtr: number;
    private busy = false;
    private freed = false;

    constructor(
        private readonly wasm: MainModule,
        private readonly native: NativeZstdDecompressor,
    ) {
        this.inputPtr = native.input_ptr;
        this.inputCapacity = native.input_capacity;
        this.outputPtr = native.output_ptr;
        decoderFinalizer?.register(this, native, this);
    }

    feed(input: Uint8Array) {
        const chunks: Uint8Array<ArrayBuffer>[] = [];
        this.decode(input, size => chunks.push(this.wasm.HEAPU8.slice(this.outputPtr, this.outputPtr + size)));
        return chunks;
    }

    feedView(input: Uint8Array, callback: ChunkCallback) {
        let view: Uint8Array<ArrayBuffer> | undefined;
        let failure: { error: unknown } | undefined;
        this.decode(input, size => {
            if (failure) {
                return;
            }
            const heap = this.wasm.HEAPU8 as Uint8Array<ArrayBuffer>;
            if (view?.byteLength !== size || view.buffer !== heap.buffer) {
                view = heap.subarray(this.outputPtr, this.outputPtr + size);
            }
            try {
                callback(view);
            } catch (error) {
                failure = { error };
            }
        });
        if (failure) {
            throw failure.error;
        }
    }

    finish(): Uint8Array<ArrayBuffer>[] {
        this.finishView();
        return [];
    }

    finishView(_callback?: ChunkCallback) {
        this.requireIdle();
        if (!this.native.at_frame_boundary()) {
            throw new Error('truncated zstd input');
        }
    }

    free() {
        if (!this.freed) {
            this.freed = true;
            decoderFinalizer?.unregister(this);
            if (!this.busy) {
                this.native.delete();
            }
        }
    }

    private requireIdle() {
        if (this.freed) {
            throw new Error('Zstd decompressor has been freed');
        }
        if (this.busy) {
            throw new Error('Zstd decompressor is busy');
        }
    }

    private decode(input: Uint8Array, emit: (size: number) => void) {
        this.requireIdle();
        const { wasm, native } = this;
        const length = input.byteLength;
        const inHeap = input.buffer === wasm.HEAPU8.buffer;
        const inputPtr = inHeap ? input.byteOffset : this.inputPtr;
        const step = inHeap ? length : this.inputCapacity;
        this.busy = true;
        try {
            for (let offset = 0; offset < length; offset += step) {
                const end = Math.min(offset + step, length);
                if (!inHeap) {
                    wasm.HEAPU8.set(step >= length ? input : input.subarray(offset, end), inputPtr);
                }
                native.begin_input(inputPtr, end - offset, end === length);
                for (let size = native.next_output(); size !== 0; size = native.next_output()) {
                    if (size < 0) {
                        throw new Error(`zstd decode failed: ${native.error_name()}`);
                    }
                    emit(size);
                }
            }
        } finally {
            this.busy = false;
            if (this.freed) {
                native.delete();
            }
        }
    }
}

let initPromise: ReturnType<typeof initZstd> | undefined;

export async function createZstdDecompressor(outputChunkSize = 64 * 1024): Promise<ZstdDecompressor> {
    if (!Number.isInteger(outputChunkSize) || outputChunkSize < 1 || outputChunkSize > 0x7fffffff) {
        throw new RangeError('output_chunk_size must be a positive 32-bit integer');
    }
    const wasm = await (initPromise ??= initZstd());
    const native: NativeZstdDecompressor | null = wasm.ZstdDecompressor.withOutputChunkSize(outputChunkSize);
    if (!native) {
        throw new Error('Failed to allocate zstd decompressor');
    }
    return new WasmZstdDecompressor(wasm, native);
}
