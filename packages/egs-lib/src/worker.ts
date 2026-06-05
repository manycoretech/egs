import { logger } from './logger';
import { setFlags, intersectFlags, disableFlags, hasFlags, enableFlags } from './flags';

const WorkerFlags = {
    BUSY: 1,
    ALIVE: 2,
    PERMANENT: 4,

    KEEP: 1 | 4,
} as const;

export type WebWorker = Worker & {
    readonly alive: boolean;
    readonly permanent: boolean;
    release(): void;
};

type InternalWebWorker = WebWorker & {
    pool: FactoryWorkerPool;
    flags: number;
};

const workerProperties = {
    alive: {
        get(this: InternalWebWorker) {
            return hasFlags(this.flags, WorkerFlags.ALIVE);
        },
        enumerable: true,
        configurable: false,
    },
    permanent: {
        get(this: InternalWebWorker) {
            return hasFlags(this.flags, WorkerFlags.PERMANENT);
        },
        enumerable: true,
        configurable: false,
    },
    release: {
        value(this: InternalWebWorker) {
            this.flags = disableFlags(this.flags, WorkerFlags.BUSY);
            this.onmessage = null;
            this.pool.flush();
        },
        enumerable: false,
        configurable: false,
    },
};

export class FactoryWorkerPool {
    private workers: InternalWebWorker[] = [];
    private timeoutHandle: any = undefined;
    private tasks: Array<(worker: InternalWebWorker) => void> = [];

    constructor(
        readonly name: string,
        private workerFactory: () => Worker,
        readonly maxWorkerCount = 1,
        readonly permanentWorkers = 0,
        readonly cleanupTimeout = 30000, // 30s
    ) {}

    private createWorker() {
        const worker = this.workerFactory() as InternalWebWorker;
        worker.pool = this;
        worker.flags = setFlags(WorkerFlags.ALIVE, WorkerFlags.PERMANENT, this.workers.length < this.permanentWorkers);
        Object.defineProperties(worker, workerProperties);
        this.workers.push(worker);
        return worker;
    }

    private cleanupWorkers() {
        if (this.workers.length <= this.permanentWorkers) {
            this.timeoutHandle = undefined;
            return;
        }
        const aliveWorkers = [...this.workers];
        this.workers.length = 0;
        logger.info(`Cleaning up unused ${this.name} workers, current alive: ${aliveWorkers.length}`);
        for (const worker of aliveWorkers) {
            if (intersectFlags(worker.flags, WorkerFlags.KEEP)) {
                this.workers.push(worker);
            } else {
                worker.terminate();
                worker.flags = disableFlags(worker.flags, WorkerFlags.ALIVE);
            }
        }
        logger.info(`Alive ${this.name} workers after cleanup ${this.workers.length}`);
        this.timeoutHandle = undefined;
    }

    flush() {
        if (this.tasks.length === 0 && this.timeoutHandle == null) {
            this.timeoutHandle = globalThis.setTimeout(() => {
                this.cleanupWorkers();
            }, this.cleanupTimeout);
        }
        if (this.tasks.length === 0) {
            return;
        }
        const worker = this.workers.find(w => !hasFlags(w.flags, WorkerFlags.BUSY));
        if (worker && this.tasks.length > 0) {
            this.tasks.shift()!(worker);
        }
    }

    getWorker(): Promise<WebWorker> {
        if (this.timeoutHandle != null) {
            globalThis.clearTimeout(this.timeoutHandle);
            this.timeoutHandle = undefined;
        }

        if (this.workers.length < this.maxWorkerCount) {
            const worker = this.createWorker();
            worker.flags = enableFlags(worker.flags, WorkerFlags.BUSY);
            return Promise.resolve(worker);
        }
        const worker = this.workers.find(w => !hasFlags(w.flags, WorkerFlags.BUSY));
        if (worker) {
            worker.flags = enableFlags(worker.flags, WorkerFlags.BUSY);
            return Promise.resolve(worker);
        }
        return new Promise<WebWorker>(resolve => {
            this.tasks.push(function (worker) {
                worker.flags = enableFlags(worker.flags, WorkerFlags.BUSY);
                resolve(worker);
            });
        });
    }
}

export class WorkerPool extends FactoryWorkerPool {
    constructor(
        name: string,
        WorkerCtor: new () => Worker,
        maxWorkerCount = 1,
        permanentWorkers = 0,
        cleanupTimeout = 30000, // 30s
    ) {
        super(name, () => new WorkerCtor(), maxWorkerCount, permanentWorkers, cleanupTimeout);
    }
}
