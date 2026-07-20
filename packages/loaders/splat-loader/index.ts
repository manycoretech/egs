export { KsplatFile, PlyFile, SogFile, SplatFile, SpzFile, LccFile, EszFile } from './file/index.js';
export { SplatData, RawSplatData, CompressedSplatData, SuperCompressedSplatData, SogSplatData } from './splat/index.js';
export {
    type ISingleSplat,
    ISamplerFormat,
    type ISampler,
    type ISplatData,
    type IFile,
    SH_MAPS,
    NUM_F_REST_TO_SH_DEGREE,
    SplatFileType,
    SplatPackType,
    detectSplatFileType,
} from './utils.js';
export { createSplatFile, createSplatData } from './helper.js';

import { FactoryWorkerPool, deferred } from '@qunhe/egs-lib';
import { type ParseExtras, getMaxTextureSize, SplatFileType, SplatPackType } from './utils.js';
import { type SendMessage, TaskType, type ReceiveMessage, TaskStatus } from './WorkerMessage.js';
import type { SplatData } from './splat/index.js';
import { createSplatData } from './helper.js';

const useMockStream =
    /ip([ao]d|hone)/i.test(navigator.userAgent) || /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

let WorkerFactor: () => Worker;
try {
    const W = require('worker-loader?inline&fallback=false!./worker');
    WorkerFactor = () => new W();
} catch {
    WorkerFactor = () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
}
const poll = new FactoryWorkerPool('splat', WorkerFactor, Math.max(0, navigator.hardwareConcurrency - 1), 1);
export async function parseSplatData(
    type: SplatFileType,
    input: Uint8Array | string | File | { stream: ReadableStream<Uint8Array>; contentLength: number },
    packType: SplatPackType = SplatPackType.SuperCompressed,
    extras: Partial<ParseExtras> = {},
): Promise<SplatData> {
    if (packType === SplatPackType.Sog && type !== SplatFileType.SOG) {
        throw new Error('SOG pack type is only supported for SOG file type.');
    }

    let stream: ReadableStream<Uint8Array>;
    let contentLength: number;
    if (typeof input === 'string') {
        const response = await fetch(input);
        stream = response.body!;
        contentLength = parseInt(response.headers.get('Content-Length')!, 10);
    } else if (input instanceof File) {
        stream = input.stream();
        contentLength = input.size;
    } else if (input instanceof Uint8Array) {
        stream = new ReadableStream<Uint8Array>({
            start: (controller: ReadableByteStreamController) => {
                controller.enqueue(input as Uint8Array<ArrayBuffer>);
                controller.close();
            },
        });
        contentLength = input.length;
    } else {
        stream = input.stream;
        contentLength = input.contentLength;
    }

    const { promise, resolve, reject } = deferred<SplatData>();
    const worker = await poll.getWorker();
    worker.onmessage = (event: MessageEvent) => {
        const data = event.data as ReceiveMessage<TaskType.ParseSplat>;
        if (data.status === TaskStatus.Success) {
            const splatData = createSplatData(packType);
            splatData.deserialize(data.payload);
            resolve(splatData);
        } else if (data.status === TaskStatus.Fail) {
            reject(new Error(data.payload));
        }
        worker.release();
    };

    const payload: SendMessage<TaskType.ParseSplat> = {
        taskType: TaskType.ParseSplat,
        payload: {
            type,
            packType,
            stream: useMockStream ? undefined : stream,
            contentLength,
            extras: {
                maxShDegree: extras.maxShDegree ?? 3,
                maxTextureSize: extras.maxTextureSize ?? getMaxTextureSize(),
            },
        },
    };
    worker.postMessage(payload, useMockStream ? [] : [stream as any]);
    if (useMockStream) {
        const reader = stream.getReader();
        while (true) {
            const { done, value } = await reader.read();
            const message: SendMessage<TaskType.PostStreamChunk> = {
                taskType: TaskType.PostStreamChunk,
                payload: {
                    chunk: value,
                },
            };
            worker.postMessage(message, value ? [value.buffer] : []);
            if (done) {
                break;
            }
        }
    }

    return promise;
}
