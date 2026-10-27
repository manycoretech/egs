import type { ParseExtras, SplatFileType, SplatPackType, ISplatData, SplatStreamChunk } from './types.js';

export interface ParseRequest {
    type: SplatFileType;
    packType: SplatPackType;
    input: string | File | { stream: ReadableStream<Uint8Array> | MessagePort; contentLength: number };
    extras: Omit<ParseExtras, 'signal' | 'retainData'>;
}

export type ParseOutput = { data: ISplatData; byteLengths: number[] } | SplatStreamChunk;
