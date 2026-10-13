import { unzipSync } from 'fflate';

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

export async function probeZipStream(
    stream: ReadableStream<Uint8Array>,
): Promise<{ isZip: boolean; stream: ReadableStream<Uint8Array> }> {
    const [probe, source] = stream.tee();
    const reader = probe.getReader();
    let magic = 0;
    let length = 0;
    try {
        while (length < 4) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            for (let i = 0; i < value.length && length < 4; i++, length++) {
                magic |= value[i] << (length * 8);
            }
        }
    } catch (error) {
        source.cancel(error).catch(() => {});
        throw error;
    } finally {
        // Awaiting one branch's cancellation would wait for the other branch.
        reader.cancel().catch(() => {});
    }
    return { isZip: magic === 0x04034b50 || magic === 0x06054b50, stream: source };
}

export async function readZipIndex(stream: ReadableStream<Uint8Array>): Promise<Record<string, Uint8Array>> {
    const entries = unzipSync(new Uint8Array(await new Response(stream).arrayBuffer()));
    return Object.fromEntries(
        Object.entries(entries)
            .filter(([path]) => !path.endsWith('/'))
            .map(([path, bytes]) => [resolveFilePath('', path), bytes]),
    );
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
