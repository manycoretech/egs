import type { __INTERNAL__ } from '@qunhe/egs';
import { deferred, FactoryWorkerPool, logger } from '@qunhe/egs-lib';
import { TaskStatus, TaskType, type IMessage, type ReceiveMessage, type SortStorage } from './WorkerMessage.js';

let WorkerFactor: () => Worker;
try {
    const W = require('worker-loader?inline&fallback=false!./worker');
    WorkerFactor = () => new W();
} catch {
    WorkerFactor = () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
}
const pool = new FactoryWorkerPool('sort-splat', WorkerFactor, 1, 1);

async function request<Task extends TaskType>(taskType: Task, payload: IMessage[Task]['send']) {
    const { promise, resolve, reject } = deferred<IMessage[Task]['receive']>();
    const worker = await pool.getWorker();
    const storage = 'storage' in payload ? payload.storage : undefined;
    worker.onmessage = ({ data }: MessageEvent<ReceiveMessage<Task>>) => {
        if (storage && data.returned) {
            Object.assign(storage, data.returned);
        }
        if (data.status === TaskStatus.Success) {
            resolve(data.payload);
        } else if (data.status === TaskStatus.Fail) {
            reject(new Error(data.payload));
        }
    };
    try {
        worker.postMessage(
            { taskType, payload },
            storage
                ? [storage.sorting.buffer, storage.ordering.buffer].filter(buffer => buffer instanceof ArrayBuffer)
                : [],
        );
        return await promise;
    } finally {
        worker.release();
    }
}

export class WorkerSplatSorter implements __INTERNAL__.SplatSorter {
    private readonly shared: boolean;

    constructor() {
        this.shared = globalThis.crossOriginIsolated && typeof SharedArrayBuffer !== 'undefined';
        request(TaskType.Init, {
            moduleUrl: new URL('./sort-wasm/sort.js', import.meta.url).href,
            shared: this.shared,
        });
    }

    async alloc(capacity: number, storage?: SortStorage): Promise<SortStorage> {
        if (storage && storage.sorting.length >= capacity * 4) {
            return storage;
        }
        let next: SortStorage | undefined;
        if (this.shared) {
            next = await request(TaskType.Alloc, { capacity, storage });
        }
        if (!next) {
            const sorting = new Float32Array(capacity * 4);
            if (storage) {
                sorting.set(storage.sorting);
            }
            next = { sorting, ordering: new Uint32Array(capacity) };
        }
        if (storage) {
            this.release(storage);
        }
        return next;
    }

    async update(storage: SortStorage, changed: Array<{ start: number; end: number }>) {
        if (!this.shared || storage.region === undefined || !changed.length) {
            return;
        }
        await request(TaskType.Update, { storage, changed });
    }

    async sort(
        storage: SortStorage,
        count: number,
        cameraPosition: number[],
        cameraDirection: number[],
        radial: boolean,
        depthBias: number,
    ): Promise<number> {
        const { activeCount } = await request(TaskType.Sort, {
            storage,
            count,
            cameraPosition,
            cameraDirection,
            radial,
            depthBias,
        });
        return activeCount;
    }

    release({ region }: SortStorage) {
        if (!this.shared || region === undefined) {
            return;
        }
        request(TaskType.Release, { region }).catch(error =>
            logger.warn('Failed to release splat sort buffers', error),
        );
    }
}
