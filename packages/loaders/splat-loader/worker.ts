/// <reference lib="webworker" />

import { type SendMessage, TaskStatus, type ReceiveMessage } from './WorkerMessage.js';
import { createSplatData, prepareSplatFiles, readSplatFiles } from './helper.js';
import { SplatPackType, type SplatStreamMessage } from './types.js';
import { WorkerStream } from './utils/stream.js';
import { sortSplatData } from './utils/morton.js';
import { StreamSplatData } from './splat/StreamSplatData.js';

self.onmessage = async (event: MessageEvent<SendMessage>) => {
    const { type, packType, port, contentLength, extras } = event.data;
    const channel = new WorkerStream<Uint8Array, SplatStreamMessage>(port, message => {
        if ('data' in message) {
            return message.data.samplers
                .filter(sampler => sampler.source.byteLength)
                .map(sampler => sampler.source.buffer as ArrayBuffer);
        }
        return [message.source.buffer as ArrayBuffer];
    });
    try {
        const streaming = !extras.mortonSort && packType !== SplatPackType.Sog;
        let splatData = createSplatData(packType, extras.maxShDegree, extras.maxTextureSize);
        if (streaming) {
            splatData = new StreamSplatData(
                splatData,
                message => channel.write(message),
                extras.streamChunkBytes,
                channel.buffers,
            );
        }
        const files = await prepareSplatFiles(type, channel.readable, contentLength, extras.includeOtherFormats);
        await readSplatFiles(files, splatData, extras.lodLevel);
        if (extras.mortonSort && packType !== SplatPackType.Sog) {
            sortSplatData(splatData);
        }
        if (!streaming) {
            await channel.write({ data: splatData.serialize() });
        }
        channel.close();
        postMessage({ status: TaskStatus.Success } satisfies ReceiveMessage);
    } catch (error) {
        channel.close(error);
        postMessage({ status: TaskStatus.Fail, error } satisfies ReceiveMessage);
    }
};
