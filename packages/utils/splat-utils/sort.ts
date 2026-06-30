import { deferred, FactoryWorkerPool } from '@qunhe/egs-lib';
import { TaskStatus, TaskType, type ReceiveMessage, type SendMessage } from './WorkerMessage.js';

let WorkerFactor: () => Worker;
try {
    const W = require('worker-loader?inline&fallback=false!./worker');
    WorkerFactor = () => new W();
} catch {
    WorkerFactor = () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
}

const poll = new FactoryWorkerPool('sort-splat-order', WorkerFactor, 1, 1);
export async function sortSplats(count: number, sorting: Uint16Array | Uint32Array, ordering: Uint32Array) {
    const { promise, resolve, reject } = deferred<{
        activeCount: number;
        sorting: Uint16Array | Uint32Array;
        ordering: Uint32Array;
    }>();
    const worker = await poll.getWorker();
    worker.onmessage = (event: MessageEvent) => {
        const data = event.data as ReceiveMessage<TaskType.SortSplats>;
        if (data.status === TaskStatus.Success) {
            resolve(data.payload);
        } else if (data.status === TaskStatus.Fail) {
            reject(new Error(data.payload));
        }
        worker.release();
    };

    const payload: SendMessage<TaskType.SortSplats> = {
        taskType: TaskType.SortSplats,
        payload: { count, sorting, ordering },
    };
    worker.postMessage(payload, [sorting.buffer, ordering.buffer]);

    return promise;
}
