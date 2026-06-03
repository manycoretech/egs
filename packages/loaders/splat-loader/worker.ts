/// <reference lib="webworker" />

declare let self: ServiceWorkerGlobalScope;

import { TaskType, type SendMessage, TaskStatus, type ReceiveMessage } from './WorkerMessage';
import { SplatFileType, sortSplats, SplatPackType } from './utils';
import { type SplatData, RawSplatData, CompressedSplatData, SuperCompressedSplatData, SogSplatData } from './splat';
import type { ISplatData } from './splat/utils';
import { KsplatFile, PlyFile, SogFile, SplatFile, SpzFile, LccFile, EszFile } from './file';
import { type IFile, NUM_F_REST_TO_SH_DEGREE } from './file/utils';
import type { SogMetadata } from './splat/SogSplatData';
import type { SogMetadataV1,SogMetadataV2 } from './file/sog';

let writer: WritableStreamDefaultWriter<Uint8Array> | undefined;
self.onmessage = async (event: ExtendableMessageEvent) => {
    try {
        const message = event.data as { taskType: TaskType; };
        switch (message.taskType) {
            case TaskType.ParseSplat: {
                const { type, packType, stream, contentLength, extras: { maxShDegree, maxTextureSize } } = (event.data as SendMessage<TaskType.ParseSplat>).payload;
                let splatData: SplatData;
                switch (packType) {
                    case SplatPackType.Raw: {
                        splatData = new RawSplatData(maxShDegree, maxTextureSize);
                        break;
                    }
                    case SplatPackType.Compressed: {
                        splatData = new CompressedSplatData(maxShDegree, maxTextureSize);
                        break;
                    }
                    case SplatPackType.SuperCompressed: {
                        splatData = new SuperCompressedSplatData(maxShDegree, maxTextureSize);
                        break;
                    }
                    case SplatPackType.Sog: {
                        splatData = new SogSplatData(maxShDegree, maxTextureSize);
                    }
                }

                let file: IFile;
                switch (type) {
                    case SplatFileType.PLY: {
                        file = new PlyFile();
                        break;
                    }
                    case SplatFileType.SPZ: {
                        file = new SpzFile();
                        break;
                    }
                    case SplatFileType.KSPLAT: {
                        file = new KsplatFile();
                        break;
                    }
                    case SplatFileType.SPLAT: {
                        file = new SplatFile();
                        break;
                    }
                    case SplatFileType.SOG: {
                        file = new SogFile();
                        break;
                    }
                    case SplatFileType.LCC: {
                        file = new LccFile();
                        break;
                    }
                    case SplatFileType.ESZ: {
                        file = new EszFile();
                        break;
                    }
                }

                let reader = stream;
                if (!reader) {
                    const stream = new TransformStream<Uint8Array, Uint8Array>();
                    writer = stream.writable.getWriter();
                    reader = stream.readable;
                }
                if (packType === SplatPackType.Sog) {
                    await (file as SogFile).load(reader, contentLength);
                    const { meta, refs } = (file as SogFile);

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
                            shN: m.shN ? {
                                mins: m.shN.mins,
                                maxs: m.shN.maxs,
                            } : undefined,
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
                            shN: m.shN ? {
                                codebook: m.shN.codebook,
                            } : undefined,
                        };
                    }

                    (splatData as SogSplatData).load(
                        splatMeta,
                        refs[meta.means.files[0]],
                        refs[meta.means.files[1]],
                        refs[meta.scales.files[0]],
                        refs[meta.quats.files[0]],
                        refs[meta.sh0.files[0]],
                        ...(meta.shN ? [
                            refs[meta.shN.files[0]],
                            refs[meta.shN.files[1]],
                        ] : []),
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
            case TaskType.SortSplats: {
                const { splatCounts, sorting, ordering } = (event.data as SendMessage<TaskType.SortSplats>).payload;
                const activeSplats = sortSplats(splatCounts, sorting, ordering);
                const payload: ReceiveMessage<TaskType.SortSplats> = { status: TaskStatus.Success, payload: { activeSplats, sorting, ordering } };
                postMessage(payload, [sorting.buffer, ordering.buffer]);
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
