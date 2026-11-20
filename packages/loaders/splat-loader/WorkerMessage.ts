import type { ParseExtras, SplatFileType, SplatPackType } from './types.js';

export enum TaskStatus {
    Success,
    Fail,
}

export interface SendMessage {
    type: SplatFileType;
    packType: SplatPackType;
    port: MessagePort;
    contentLength: number;
    extras: ParseExtras;
}

export interface ReceiveMessage {
    status: TaskStatus;
    error?: unknown;
}
