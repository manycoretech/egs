import { unzipSync, Unzip, UnzipInflate } from 'fflate';
import { probeStream, ByteStreamCursor } from './stream.js';

export interface FileContext {
    path: string;
    files: Record<string, Uint8Array>;
}

export function resolveFilePath(path: string, relative: string) {
    const parts: string[] = [];
    const name = relative.replace(/\\/g, '/');
    const fullPath = name.startsWith('/') ? name : path.slice(0, path.lastIndexOf('/') + 1) + name;
    for (const part of fullPath.split('/')) {
        if (part === '..') {
            parts.pop();
        } else if (part && part !== '.') {
            parts.push(part);
        }
    }
    return parts.join('/');
}

async function unzipStream(stream: ReadableStream<Uint8Array>): Promise<Record<string, Uint8Array>> {
    const entries: Record<string, Uint8Array> = {};
    const unzip = new Unzip(file => {
        let bytes = file.originalSize === undefined ? undefined : new Uint8Array(file.originalSize);
        const parts: Uint8Array[] = [];
        let length = 0;
        file.ondata = (error, chunk, final) => {
            if (error) {
                throw error;
            }
            if (bytes) {
                bytes.set(chunk, length);
            } else {
                parts.push(chunk);
            }
            length += chunk.byteLength;
            if (!final) {
                return;
            }
            if (!bytes) {
                bytes = new Uint8Array(length);
                let offset = 0;
                for (const part of parts) {
                    bytes.set(part, offset);
                    offset += part.byteLength;
                }
            }
            entries[file.name] = bytes;
        };
        file.start();
    });
    unzip.register(UnzipInflate);
    await stream.pipeTo(
        new WritableStream<Uint8Array>({
            write: chunk => unzip.push(chunk),
            close: () => unzip.push(new Uint8Array(0), true),
        }),
    );
    return entries;
}

export async function readZipIndex(
    stream: ReadableStream<Uint8Array>,
): Promise<{ stream: ReadableStream<Uint8Array>; files?: Record<string, Uint8Array> }> {
    const { magic, stream: source } = await probeStream(stream);
    if (magic !== 0x04034b50 && magic !== 0x06054b50) {
        return { stream: source };
    }

    const [probe, zipStream] = source.tee();
    const cursor = new ByteStreamCursor(probe);
    const header = await cursor.readExact(8);
    cursor.cancel();

    // Descriptor-based archives have no local sizes; use their central directory.
    const entries =
        header[6] & 8
            ? unzipSync(new Uint8Array(await new Response(zipStream).arrayBuffer()))
            : await unzipStream(zipStream);
    return {
        stream: source,
        files: Object.fromEntries(
            Object.entries(entries)
                .filter(([path]) => !path.endsWith('/'))
                .map(([path, bytes]) => [resolveFilePath('', path), bytes]),
        ),
    };
}

export function openZipEntry(bytes: Uint8Array): ReadableStream<Uint8Array> {
    return new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(bytes);
            controller.close();
        },
    });
}

export function getFileEntry(context: FileContext, relative?: string): Uint8Array {
    const path = relative === undefined ? context.path : resolveFilePath(context.path, relative);
    const bytes = Object.hasOwn(context.files, path) ? context.files[path] : undefined;
    if (!bytes) {
        throw new Error(`File not found: ${path}`);
    }
    return bytes;
}
