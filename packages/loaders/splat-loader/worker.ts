/// <reference lib="webworker" />

import { TaskType, type SendMessage, TaskStatus, type ReceiveMessage } from './WorkerMessage';
import { SogFile } from './file';
import type { SogMetadataV1, SogMetadataV2 } from './file/sog';
import { SogSplatData } from './splat';
import type { SogMetadata } from './splat/SogSplatData';
import { NUM_F_REST_TO_SH_DEGREE, SplatPackType, type ISplatData } from './utils';
import { createSplatData, createSplatFile } from './helper';

let writer: WritableStreamDefaultWriter<Uint8Array> | undefined;
self.onmessage = async (event: MessageEvent) => {
    try {
        const message = event.data as { taskType: TaskType };
        switch (message.taskType) {
            case TaskType.ParseSplat: {
                const {
                    type,
                    packType,
                    stream,
                    contentLength,
                    extras: { maxShDegree, maxTextureSize },
                } = (event.data as SendMessage<TaskType.ParseSplat>).payload;
                const splatData = createSplatData(packType, maxShDegree, maxTextureSize);
                const file = createSplatFile(type);

                let reader = stream;
                if (!reader) {
                    const stream = new TransformStream<Uint8Array, Uint8Array>();
                    writer = stream.writable.getWriter();
                    reader = stream.readable;
                }
                if (packType === SplatPackType.Sog) {
                    await (file as SogFile).load(reader, contentLength);
                    const { meta, refs } = file as SogFile;

                    let splatMeta: SogMetadata;
                    if (meta.version === undefined) {
                        const m = meta as SogMetadataV1;
                        splatMeta = {
                            version: 1,
                            counts: m.means.shape[0],
                            shDegree: NUM_F_REST_TO_SH_DEGREE[m.shN?.shape?.[1] ?? 0],
                            means: {
                                mins: [m.means.mins[0], m.means.mins[1], m.means.mins[2]],
                                maxs: [m.means.maxs[0], m.means.maxs[1], m.means.maxs[2]],
                            },
                            scales: {
                                mins: [m.scales.mins[0], m.scales.mins[1], m.scales.mins[2]],
                                maxs: [m.scales.maxs[0], m.scales.maxs[1], m.scales.maxs[2]],
                            },
                            sh0: {
                                mins: [m.sh0.mins[0], m.sh0.mins[1], m.sh0.mins[2], m.sh0.mins[3]],
                                maxs: [m.sh0.maxs[0], m.sh0.maxs[1], m.sh0.maxs[2], m.sh0.maxs[3]],
                            },
                            shN: m.shN
                                ? {
                                      mins: m.shN.mins,
                                      maxs: m.shN.maxs,
                                  }
                                : undefined,
                        };
                    } else {
                        const m = meta as SogMetadataV2;
                        splatMeta = {
                            version: 2,
                            counts: m.count,
                            shDegree: m.shN?.bands ?? 0,
                            means: {
                                mins: [m.means.mins[0], m.means.mins[1], m.means.mins[2]],
                                maxs: [m.means.maxs[0], m.means.maxs[1], m.means.maxs[2]],
                            },
                            scales: {
                                codebook: m.scales.codebook,
                            },
                            sh0: {
                                codebook: m.sh0.codebook,
                            },
                            shN: m.shN
                                ? {
                                      codebook: m.shN.codebook,
                                  }
                                : undefined,
                        };
                    }

                    (splatData as SogSplatData).load(
                        splatMeta,
                        refs[meta.means.files[0]],
                        refs[meta.means.files[1]],
                        refs[meta.scales.files[0]],
                        refs[meta.quats.files[0]],
                        refs[meta.sh0.files[0]],
                        ...(meta.shN ? [refs[meta.shN.files[0]], refs[meta.shN.files[1]]] : []),
                    );
                } else {
                    await file.read(reader, contentLength, splatData);
                }
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
