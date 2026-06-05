
import { FactoryWorkerPool } from '@qunhe/egs-lib';

let WorkerFactor: () => Worker;
try {
    const W = require('worker-loader?inline&fallback=false!./transcoder.worker');
    WorkerFactor = () => new W();
} catch {
    WorkerFactor = () => new Worker(new URL('./transcoder.worker', import.meta.url), { type: 'module' });
}

const pool = new FactoryWorkerPool('transcode', WorkerFactor);

export default pool;
