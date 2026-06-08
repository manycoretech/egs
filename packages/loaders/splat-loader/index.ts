import { __INTERNAL__ } from '@qunhe/egs';
import { FactoryWorkerPool, deferred } from '@qunhe/egs-lib';
import { getMaxTextureSize, SplatFileType, SplatPackType } from './utils';
import { type ParseExtras, type SendMessage, TaskType, type ReceiveMessage, TaskStatus } from './WorkerMessage';
import { type SplatData, RawSplatData, CompressedSplatData, SuperCompressedSplatData, SogSplatData } from './splat';

export { KsplatFile, PlyFile, SogFile, SplatFile, SpzFile, LccFile, EszFile } from './file';
export type { IFile } from './file';
export { SplatData, RawSplatData, CompressedSplatData, SuperCompressedSplatData, SogSplatData } from './splat';
export { ISamplerFormat, SH_MAPS } from './splat/utils';
export type { ISingleSplat, ISampler } from './splat/utils';
export { SplatFileType, SplatPackType, detectSplatFileType } from './utils';

let SplatWorkerFactor: () => Worker;
try {
    const W = require('worker-loader?inline&fallback=false!./worker');
    SplatWorkerFactor = () => new W();
} catch {
    SplatWorkerFactor = () => new Worker(new URL('./worker', import.meta.url), { type: 'module' });
}
const poll = new FactoryWorkerPool('splat', SplatWorkerFactor, 4, 1);
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
            let splatData: SplatData;
            switch (packType) {
                case SplatPackType.Raw: {
                    splatData = new RawSplatData();
                    break;
                }
                case SplatPackType.Compressed: {
                    splatData = new CompressedSplatData();
                    break;
                }
                case SplatPackType.SuperCompressed: {
                    splatData = new SuperCompressedSplatData();
                    break;
                }
                case SplatPackType.Sog: {
                    splatData = new SogSplatData();
                    break;
                }
            }
            splatData.deserialize(data.payload);
            resolve(splatData);
        } else if (data.status === TaskStatus.Fail) {
            reject(new Error(data.payload));
        }
        worker.release();
    };

    const platform = __INTERNAL__.Platform.getInstance();
    const isMockStream = platform.isSafari || platform.ios;
    const payload: SendMessage<TaskType.ParseSplat> = {
        taskType: TaskType.ParseSplat,
        payload: {
            type,
            packType,
            stream: isMockStream ? undefined : stream,
            contentLength,
            extras: {
                maxShDegree: extras.maxShDegree ?? 3,
                maxTextureSize: extras.maxTextureSize ?? getMaxTextureSize(),
            },
        },
    };
    worker.postMessage(payload, isMockStream ? [] : [stream as any]);
    if (isMockStream) {
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

async function sortSplats(count: number, sorting: Uint16Array | Uint32Array, ordering: Uint32Array) {
    const { promise, resolve, reject } = deferred<{
        activeCount: number;
        sorting: Uint16Array | Uint32Array;
        ordering: Uint32Array;
    }>();
    const worker = await poll.getWorker();
    worker.onmessage = (event: MessageEvent) => {
        const data = event.data as ReceiveMessage<TaskType.SortSplats>;
        if (data.status === TaskStatus.Success) {
            resolve(data.payload);
        } else if (data.status === TaskStatus.Fail) {
            reject(new Error(data.payload));
        }
        worker.release();
    };

    const payload: SendMessage<TaskType.SortSplats> = {
        taskType: TaskType.SortSplats,
        payload: { count, sorting, ordering },
    };
    worker.postMessage(payload, [sorting.buffer, ordering.buffer]);

    return promise;
}

__INTERNAL__.setSortSplats?.(sortSplats);
