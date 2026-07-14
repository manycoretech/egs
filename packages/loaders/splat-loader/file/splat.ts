import { type IFile, type IData, ByteStreamCursor, clamp, createSingleSplat, StreamChunkDecoder } from '../utils.js';

const ITEM_SIZE = 32;
const STREAM_CHUNK_BYTE_LENGTH = 128 * 1024;
const STREAM_CHUNK_ITEM_COUNTS = Math.floor(STREAM_CHUNK_BYTE_LENGTH / ITEM_SIZE);
export class SplatFile implements IFile {
    async read(stream: ReadableStream<Uint8Array>, contentLength: number, data: IData) {
        const setFn = data.set.bind(data) as IData['set'];
        const counts = Math.floor(contentLength / ITEM_SIZE);
        const BlockOffset = await data.initBlock(counts, 0);
        const single = createSingleSplat();

        const decoder = new StreamChunkDecoder(new ByteStreamCursor(stream));
        await decoder.decode([
            {
                init: () => [counts, ITEM_SIZE],
                decode: (offset, counts, buffer) => {
                    offset += BlockOffset;
                    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
                    for (let i = 0; i < counts; i++) {
                        const o = i * ITEM_SIZE;
                        single.x = view.getFloat32(o, true);
                        single.y = view.getFloat32(o + 4, true);
                        single.z = view.getFloat32(o + 8, true);
                        single.sx = view.getFloat32(o + 12, true);
                        single.sy = view.getFloat32(o + 16, true);
                        single.sz = view.getFloat32(o + 20, true);
                        single.r = buffer[o + 24] / 255;
                        single.g = buffer[o + 25] / 255;
                        single.b = buffer[o + 26] / 255;
                        single.a = buffer[o + 27] / 255;
                        single.qw = (buffer[o + 28] - 128) / 128;
                        single.qx = (buffer[o + 29] - 128) / 128;
                        single.qy = (buffer[o + 30] - 128) / 128;
                        single.qz = (buffer[o + 31] - 128) / 128;
                        setFn(offset + i, single);
                    }
                },
            },
        ]);
        data.finishBlock();
    }

    async write(stream: WritableStream<Uint8Array>, data: IData) {
        const writer = stream.getWriter();

        const single = createSingleSplat();
        for (let i = 0; i < data.counts; i += STREAM_CHUNK_ITEM_COUNTS) {
            const currentChunkSize = Math.min(STREAM_CHUNK_ITEM_COUNTS, data.counts - i);
            const chunk = new Uint8Array(currentChunkSize * ITEM_SIZE);
            const dataView = new DataView(chunk.buffer);
            for (let j = 0; j < currentChunkSize; j++) {
                data.get(i + j, single);
                const o = j * ITEM_SIZE;
                dataView.setFloat32(o, single.x, true);
                dataView.setFloat32(o + 4, single.y, true);
                dataView.setFloat32(o + 8, single.z, true);
                dataView.setFloat32(o + 12, single.sx, true);
                dataView.setFloat32(o + 16, single.sy, true);
                dataView.setFloat32(o + 20, single.sz, true);
                dataView.setUint8(o + 24, clamp(Math.round(single.r * 255), 0, 255));
                dataView.setUint8(o + 25, clamp(Math.round(single.g * 255), 0, 255));
                dataView.setUint8(o + 26, clamp(Math.round(single.b * 255), 0, 255));
                dataView.setUint8(o + 27, clamp(Math.round(single.a * 255), 0, 255));
                dataView.setUint8(o + 28, clamp(Math.round(single.qw * 128 + 128), 0, 255));
                dataView.setUint8(o + 29, clamp(Math.round(single.qx * 128 + 128), 0, 255));
                dataView.setUint8(o + 30, clamp(Math.round(single.qy * 128 + 128), 0, 255));
                dataView.setUint8(o + 31, clamp(Math.round(single.qz * 128 + 128), 0, 255));
            }

            writer.write(chunk);
            if (writer.desiredSize! <= 0) {
                await writer.ready;
            }
        }

        await writer.close();
    }
}
