import { deferred, FactoryWorkerPool } from '@qunhe/egs-lib';
import { TaskStatus, TaskType, type IMessage, type ReceiveMessage, type SendMessage } from './WorkerMessage.js';

let WorkerFactor: () => Worker;
try {
    const W = require('worker-loader?inline&fallback=false!./worker');
    WorkerFactor = () => new W();
} catch {
    WorkerFactor = () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
}

const pool = new FactoryWorkerPool('sort-splat-order', WorkerFactor, 1, 1);
export async function sortSplats(request: SendMessage<TaskType.SortSplats>['payload']) {
    const { promise, resolve, reject } = deferred<IMessage[TaskType.SortSplats]['receive']>();
    const worker = await pool.getWorker();
    worker.onmessage = ({ data }: MessageEvent<ReceiveMessage<TaskType.SortSplats>>) => {
        if (data.status === TaskStatus.Success) {
            resolve(data.payload);
        } else if (data.status === TaskStatus.Fail) {
            reject(new Error(data.payload));
        }
        worker.release();
    };

    const payload: SendMessage<TaskType.SortSplats> = {
        taskType: TaskType.SortSplats,
        payload: request,
    };
    worker.postMessage(payload, [request.sorting.buffer, request.ordering.buffer]);

    return promise;
}
