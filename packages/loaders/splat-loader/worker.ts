/// <reference lib="webworker" />

import type { ParseRequest, ParseOutput } from './WorkerMessage.js';
import { SplatFileType, SplatPackType } from './types.js';
import { createSplatData, prepareSplatFiles, readSplatFiles } from './helper.js';
import { createStreamingData, SPLAT_STREAM_CHUNK_BYTES, type SplatStreamSink } from './streaming.js';
import { streamToPort, streamFromPort } from './utils/worker-stream.js';
import { bufferedInput } from './utils/stream.js';

self.onmessage = async ({ data }: MessageEvent<ParseRequest>) => {
    const { type, packType, extras, input } = data;
    const abort = new AbortController();
    const output = new TransformStream<ParseOutput, ParseOutput>();
    const writer = output.writable.getWriter();
    void writer.closed.catch(error => abort.abort(error));
    const returnedBuffers: ArrayBuffer[] = [];
    const port = streamToPort(
        output.readable,
        chunk => ('data' in chunk ? [] : chunk.samplers.map(sampler => sampler.source.buffer as ArrayBuffer)),
        buffers => {
            returnedBuffers.splice(0, returnedBuffers.length, ...buffers);
        },
    );
    postMessage(port, [port]);
    try {
        let stream: ReadableStream<Uint8Array>;
        let contentLength: number;
        if (typeof input === 'string') {
            const response = await fetch(input, { signal: abort.signal });
            if (!response.ok || !response.body) throw new Error(`Failed to load splats: HTTP ${response.status}.`);
            stream = response.body;
            contentLength = Number(response.headers.get('Content-Length') ?? NaN);
            const encoding = response.headers.get('Content-Encoding');
            if (type === SplatFileType.SPLAT && encoding && encoding !== 'identity') contentLength = NaN;
        } else if (input instanceof File) {
            stream = input.stream();
            contentLength = input.size;
        } else {
            stream = input.stream instanceof MessagePort ? streamFromPort(input.stream) : input.stream;
            contentLength = input.contentLength;
        }
        stream = bufferedInput(stream, extras.chunkBytes ?? SPLAT_STREAM_CHUNK_BYTES, abort.signal);
        const files = await prepareSplatFiles(type, stream, contentLength, extras.includeOtherFormats);
        const sink: SplatStreamSink = {
            onHeader: (data, byteLengths) => writer.write({ data, byteLengths }),
            onChunk: chunk => writer.write(chunk),
        };
        if (packType === SplatPackType.Sog) {
            // Native SOG contains encoded images rather than point records.
            const splats = createSplatData(packType, extras.maxShDegree, extras.maxTextureSize);
            await readSplatFiles(files, splats, extras.lodLevel);
            const serialized = splats.serialize();
            await sink.onHeader(
                {
                    ...serialized,
                    samplers: serialized.samplers.map(sampler => ({
                        ...sampler,
                        source: new Uint8Array(0),
                    })),
                },
                serialized.samplers.map(sampler => sampler.source.byteLength),
            );
            const size = extras.chunkBytes ?? SPLAT_STREAM_CHUNK_BYTES;
            for (let index = 0; index < serialized.samplers.length; index++) {
                const bytes = serialized.samplers[index].source;
                for (let offset = 0; offset < bytes.byteLength; offset += size) {
                    await sink.onChunk({ samplers: [{ index, offset, source: bytes.slice(offset, offset + size) }] });
                }
            }
        } else {
            const splats = createStreamingData(packType, extras, sink, returnedBuffers);
            await readSplatFiles(files, splats, extras.lodLevel);
            await splats.flush();
        }
        await writer.close();
    } catch (error) {
        await writer.abort(error).catch(() => {});
    } finally {
        abort.abort();
    }
};
