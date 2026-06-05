import type { SplatFileType, SplatPackType } from './utils';
import type { ISplatData } from './splat/utils';

export interface ParseExtras {
    maxShDegree: number;
    maxTextureSize: number;
}

export enum TaskType {
    ParseSplat = 'ParseSplat',
    PostStreamChunk = 'PostStreamChunk',
    SortSplats = 'SortSplats',
}

export enum TaskStatus {
    Success,
    Fail,
}

interface IBasicMessage {
    [key: string]: {
        send: unknown;
        receive: unknown;
    };
}

export interface IMessage extends IBasicMessage {
    [TaskType.ParseSplat]: {
        send: {
            type: SplatFileType;
            packType: SplatPackType;
            stream?: ReadableStream<Uint8Array>;
            contentLength: number;
            extras: ParseExtras;
        };
        receive: ISplatData;
    };
    [TaskType.PostStreamChunk]: {
        send: {
            chunk: Uint8Array | undefined;
        };
        receive: undefined;
    };
    [TaskType.SortSplats]: {
        send: { splatCounts: number; sorting: Uint16Array; ordering: Uint32Array };
        receive: { activeSplats: number; sorting: Uint16Array; ordering: Uint32Array };
    };
}

export interface SendMessage<T extends TaskType> {
    taskType: T;
    payload: IMessage[T]['send'];
}
export type ReceiveMessage<T extends TaskType> =
    | {
          status: TaskStatus.Success;
          payload: IMessage[T]['receive'];
      }
    | {
          status: TaskStatus.Fail;
          payload: string;
      };
