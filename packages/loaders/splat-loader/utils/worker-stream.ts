/** Bridge a stream through a port, transferring owned output buffers when supplied. */
export function streamToPort<T>(
    stream: ReadableStream<T>,
    transfer?: (chunk: T) => Transferable[],
    receive?: (buffers: ArrayBuffer[]) => void,
): MessagePort {
    const { port1, port2 } = new MessageChannel();
    const reader = stream.getReader();
    let closed = false;
    const close = () => {
        closed = true;
        reader.releaseLock();
        port1.close();
    };
    port1.onmessage = async ({ data }) => {
        if (closed) return;
        try {
            if (data.cancel) {
                await reader.cancel(data.reason);
                close();
            } else {
                if (data.buffers) receive?.(data.buffers);
                const result = await reader.read();
                if (!closed) {
                    port1.postMessage(result, result.done ? [] : (transfer?.(result.value) ?? []));
                    if (result.done) close();
                }
            }
        } catch (error) {
            if (!closed) {
                port1.postMessage({ error: String(error) });
                await reader.cancel(error).catch(() => {});
                close();
            }
        }
    };
    return port2;
}

export function streamFromPort<T>(stream: MessagePort, release?: () => ArrayBuffer[]): ReadableStream<T> {
    let pulled: (() => void) | undefined;
    const close = () => {
        pulled?.();
        pulled = undefined;
        stream.close();
    };
    return new ReadableStream<T>(
        {
            start(controller) {
                stream.onmessage = ({ data }) => {
                    if (data.error !== undefined) {
                        controller.error(new Error(data.error));
                        close();
                    } else if (data.done) {
                        controller.close();
                        close();
                    } else {
                        controller.enqueue(data.value);
                        pulled?.();
                        pulled = undefined;
                    }
                };
                stream.onmessageerror = () => {
                    stream.postMessage({ cancel: true, reason: 'Failed to receive stream data.' });
                    controller.error(new Error('Failed to receive stream data.'));
                    close();
                };
            },
            pull() {
                return new Promise<void>(resolve => {
                    pulled = resolve;
                    const buffers = release?.() ?? [];
                    stream.postMessage({ buffers }, buffers);
                });
            },
            cancel(reason) {
                stream.postMessage({ cancel: true, reason: String(reason) });
                close();
            },
        },
        { highWaterMark: 0 },
    );
}
