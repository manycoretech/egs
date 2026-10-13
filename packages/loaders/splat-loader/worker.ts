/// <reference lib="webworker" />

import { TaskType, type SendMessage, TaskStatus, type ReceiveMessage } from './WorkerMessage.js';
import type { ISplatData } from './utils.js';
import { createSplatData, prepareSplatFiles, readSplatFiles } from './helper.js';

let writer: WritableStreamDefaultWriter<Uint8Array> | undefined;
self.onmessage = async (event: MessageEvent) => {
    try {
        const message = event.data as { taskType: TaskType };
        switch (message.taskType) {
            case TaskType.ParseSplat: {
                const { type, packType, stream, contentLength, extras } = (
                    event.data as SendMessage<TaskType.ParseSplat>
                ).payload;

                let reader = stream;
                if (!reader) {
                    const stream = new TransformStream<Uint8Array, Uint8Array>();
                    writer = stream.writable.getWriter();
                    reader = stream.readable;
                }
                const splatData = createSplatData(packType, extras.maxShDegree, extras.maxTextureSize);
                const splatFiles = await prepareSplatFiles(type, reader, contentLength, extras.includeOtherFormats);
                await readSplatFiles(splatFiles, splatData, extras.lodLevel);

                writer = undefined;

                const splats: ISplatData = splatData.serialize();
                const payload: ReceiveMessage<TaskType.ParseSplat> = { status: TaskStatus.Success, payload: splats };
                postMessage(
                    payload,
                    splats.samplers.map(v => v.source.buffer),
                );
                return;
            }
            case TaskType.PostStreamChunk: {
                const { chunk } = (event.data as SendMessage<TaskType.PostStreamChunk>).payload;
                if (!writer) {
                    return;
                }
                if (chunk) {
                    writer.write(chunk);
                } else {
                    writer.close();
                }
                return;
            }
            default: {
                const check: never = message.taskType;
                throw new Error(`Unsupported task type: ${check}.`);
            }
        }
    } catch (e) {
        console.error(e);
        postMessage({ status: TaskStatus.Fail, payload: e.toString() });
    }
};
