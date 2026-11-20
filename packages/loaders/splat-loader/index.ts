export { KsplatFile, PlyFile, SogFile, SplatFile, SpzFile, LccFile, Lcc2File, EszFile } from './file/index.js';
export {
    SplatData,
    RawSplatData,
    CompressedSplatData,
    SuperCompressedSplatData,
    SogSplatData,
    StreamSplatData,
} from './splat/index.js';
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

import { FactoryWorkerPool } from '@qunhe/egs-lib';
import {
    type ParseExtras,
    type SplatStreamMessage,
    type SplatStreamHeader,
    type SplatStreamChunk,
    SplatFileType,
    SplatPackType,
} from './types.js';
import { getMaxTextureSize } from './utils/texture.js';
import { type SendMessage, type ReceiveMessage, TaskStatus } from './WorkerMessage.js';
import type { SplatData } from './splat/index.js';
import { createSplatData } from './helper.js';
import { WorkerStream } from './utils/stream.js';

let WorkerFactor: () => Worker;
try {
    const W = require('worker-loader?inline&fallback=false!./worker');
    WorkerFactor = () => new W();
} catch {
    WorkerFactor = () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
}
const pool = new FactoryWorkerPool('splat', WorkerFactor, Math.max(1, navigator.hardwareConcurrency - 1), 1);

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
            start(controller) {
                controller.enqueue(input);
                controller.close();
            },
        });
        contentLength = input.length;
    } else {
        stream = input.stream;
        contentLength = input.contentLength;
    }

    const worker = await pool.getWorker();
    const { port1, port2 } = new MessageChannel();
    const channel = new WorkerStream<SplatStreamMessage, Uint8Array>(
        port1,
        value => [value.buffer as ArrayBuffer],
        message => ('data' in message || !message.recycle ? [] : [message.source.buffer as ArrayBuffer]),
    );
    channel.send(stream).catch(error => channel.close(error));
    worker.onmessage = ({ data: message }: MessageEvent<ReceiveMessage>) => {
        worker.release();
        if (message.status === TaskStatus.Fail) {
            channel.close(message.error);
        }
    };
    const options: ParseExtras = {
        stream: extras.stream ?? true,
        streamChunkBytes: extras.streamChunkBytes ?? 16 * 1024 * 1024,
        mortonSort: extras.mortonSort ?? true,
        maxShDegree: extras.maxShDegree ?? 3,
        maxTextureSize: extras.maxTextureSize ?? getMaxTextureSize(),
        lodLevel: extras.lodLevel ?? 0,
        includeOtherFormats: extras.includeOtherFormats ?? false,
    };
    worker.postMessage(
        {
            type,
            packType,
            port: port2,
            contentLength,
            extras: options,
        } satisfies SendMessage,
        [port2],
    );

    const reader = channel.readable.getReader();
    const header = (await reader.read()).value as SplatStreamHeader;
    if (!header.byteLengths) {
        await reader.read();
    }
    reader.releaseLock();

    const data = createSplatData(packType, options.maxShDegree, options.maxTextureSize);
    data.deserialize(header.data);
    if (header.byteLengths) {
        data.stream = {
            chunks: channel.readable as ReadableStream<SplatStreamChunk>,
            byteLengths: header.byteLengths,
        };
    } else if (options.stream) {
        data.stream = {};
    }
    if (!options.stream) {
        await data.collect();
    }
    return data;
}
