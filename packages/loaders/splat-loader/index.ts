export { KsplatFile, PlyFile, SogFile, SplatFile, SpzFile, LccFile, Lcc2File, EszFile } from './file/index.js';
export { SplatData, RawSplatData, CompressedSplatData, SuperCompressedSplatData, SogSplatData } from './splat/index.js';
export {
    type ISingleSplat,
    ISamplerFormat,
    type ISampler,
    type ISplatData,
    type IFile,
    type ParseExtras,
    type SplatStreamChunk,
    SplatFileType,
    SplatPackType,
} from './types.js';
export { SH_MAPS, NUM_F_REST_TO_SH_DEGREE } from './utils/splat.js';
export { detectSplatFileType } from './utils/file.js';
export { createSplatFile, createSplatData, prepareSplatFiles, readSplatFiles } from './helper.js';
export { SPLAT_STREAM_CHUNK_BYTES } from './streaming.js';

import { FactoryWorkerPool, deferred } from '@qunhe/egs-lib';
import { type ParseExtras, type SplatStreamChunk, SplatFileType, SplatPackType } from './types.js';
import { getMaxTextureSize } from './utils/texture.js';
import type { ParseRequest, ParseOutput } from './WorkerMessage.js';
import type { SplatData } from './splat/index.js';
import { createSplatData } from './helper.js';
import { SPLAT_STREAM_CHUNK_BYTES } from './streaming.js';
import { streamToPort, streamFromPort } from './utils/worker-stream.js';

const useMockStream =
    /ip([ao]d|hone)/i.test(navigator.userAgent) || /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

let WorkerFactor: () => Worker;
try {
    const W = require('worker-loader?inline&fallback=false!./worker');
    WorkerFactor = () => new W();
} catch {
    WorkerFactor = () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
}
const pool = new FactoryWorkerPool('splat', WorkerFactor, Math.max(1, navigator.hardwareConcurrency - 1), 1);

/** All formats parse in a worker; retainData only chooses whether to collect the resulting stream. */
export async function parseSplatData(
    type: SplatFileType,
    input: string | File | Uint8Array | { stream: ReadableStream<Uint8Array>; contentLength: number },
    packType: SplatPackType = SplatPackType.SuperCompressed,
    extras: Partial<ParseExtras> = {},
): Promise<SplatData> {
    if (packType === SplatPackType.Sog && type !== SplatFileType.SOG) {
        throw new Error('SOG pack type is only supported for SOG file type.');
    }
    const { signal, retainData = true, chunkBytes = SPLAT_STREAM_CHUNK_BYTES } = extras;
    if (!Number.isSafeInteger(chunkBytes) || chunkBytes <= 0)
        throw new RangeError('chunkBytes must be a positive safe integer.');
    signal?.throwIfAborted();
    let transferInput: ((chunk: Uint8Array) => Transferable[]) | undefined;
    if (input instanceof Uint8Array) {
        const bytes = input;
        transferInput = chunk => [chunk.buffer as ArrayBuffer];
        let offset = 0;
        input = {
            contentLength: bytes.byteLength,
            stream: new ReadableStream<Uint8Array>(
                {
                    pull(controller) {
                        if (offset === bytes.byteLength) return controller.close();
                        const end = Math.min(bytes.byteLength, offset + chunkBytes);
                        controller.enqueue(new Uint8Array(bytes.subarray(offset, end)));
                        offset = end;
                    },
                },
                { highWaterMark: 0 },
            ),
        };
    }
    const worker = await pool.getWorker();
    const response = deferred<ReadableStreamDefaultReader<ParseOutput>>();
    void response.promise.catch(() => {});
    let reader: ReadableStreamDefaultReader<ParseOutput> | undefined;
    let returnedBuffers: ArrayBuffer[] = [];
    const inputAbort = new AbortController();
    let finished = false;
    let failure: unknown;
    const finish = () => {
        if (finished) return;
        finished = true;
        signal?.removeEventListener('abort', abort);
        reader?.releaseLock();
        inputAbort.abort(failure);
        worker.release();
    };
    const cancel = async (reason: unknown = new DOMException('Splat parsing cancelled.', 'AbortError')) => {
        failure = reason;
        response.reject(reason);
        inputAbort.abort(reason);
        if (reader) {
            await reader.cancel(reason).catch(() => {});
            finish();
        }
    };
    const abort = () => {
        void cancel(signal!.reason);
    };
    worker.onmessage = ({ data }: MessageEvent<MessagePort>) => {
        reader = streamFromPort<ParseOutput>(data, () => {
            const buffers = returnedBuffers;
            returnedBuffers = [];
            return buffers;
        }).getReader();
        if (failure !== undefined) void cancel(failure);
        response.resolve(reader);
    };
    worker.onerror = event => {
        void cancel(new Error(event.message));
        if (!reader) finish();
    };
    worker.onmessageerror = () => {
        void cancel(new Error('Failed to receive parsed splat data.'));
        if (!reader) finish();
    };
    try {
        signal?.throwIfAborted();
        signal?.addEventListener('abort', abort, { once: true });
        const send = (input: ParseRequest['input'], transfers: Transferable[] = []) =>
            worker.postMessage(
                {
                    type,
                    packType,
                    input,
                    extras: {
                        maxShDegree: extras.maxShDegree ?? 3,
                        maxTextureSize: extras.maxTextureSize ?? getMaxTextureSize(),
                        lodLevel: extras.lodLevel ?? 0,
                        includeOtherFormats: extras.includeOtherFormats ?? false,
                        chunkBytes,
                    },
                } satisfies ParseRequest,
                transfers,
            );
        if (typeof input === 'string' || input instanceof File) send(input);
        else {
            const { contentLength } = input;
            const source = input.stream.pipeThrough(new TransformStream<Uint8Array, Uint8Array>(), {
                signal: inputAbort.signal,
            });
            const stream = useMockStream || transferInput ? streamToPort(source, transferInput) : source;
            send({ stream, contentLength }, [stream]);
        }
    } catch (error) {
        finish();
        throw error;
    }
    try {
        reader = await response.promise;
        const header = await reader.read();
        if (failure !== undefined) throw failure;
        if (header.done || !('data' in header.value)) throw new Error('Splat parser returned no metadata.');
        const data = createSplatData(packType, extras.maxShDegree, extras.maxTextureSize);
        data.setStream(
            header.value.data,
            header.value.byteLengths,
            async (consume: (chunk: SplatStreamChunk) => Promise<void>, release: boolean) => {
                try {
                    while (true) {
                        const next = await reader!.read();
                        if (failure !== undefined) throw failure;
                        if (next.done) break;
                        const chunk = next.value as SplatStreamChunk;
                        await consume(chunk);
                        if (release)
                            returnedBuffers = chunk.samplers.map(sampler => sampler.source.buffer as ArrayBuffer);
                    }
                } catch (error) {
                    await cancel(error);
                    throw error;
                } finally {
                    finish();
                }
            },
            reason => {
                void cancel(reason);
            },
            signal,
        );
        if (retainData) await data.collect();
        return data;
    } catch (error) {
        await cancel(error);
        throw error;
    }
}
