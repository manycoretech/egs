/// <reference lib="webworker" />

import { TaskType, TaskStatus, type SendMessage, type ReceiveMessage } from './WorkerMessage.js';
import { createSimdSort } from './simd/sort.js';

const DEPTH_INFINITY_F32 = 0x7f800000 - 1;
const KEY_SHIFT = 8;

let depthBuckets: Uint32Array | undefined;
function countingSort(count: number, depthBits: Uint32Array, order: Uint32Array): number {
    const buckets = (depthBuckets ??= new Uint32Array(1 << (31 - KEY_SHIFT)));
    buckets.fill(0);
    let minBucket = buckets.length;
    let maxBucket = -1;
    for (let i = 0; i < count; i++) {
        const key = depthBits[i];
        if (key < DEPTH_INFINITY_F32) {
            const bucket = key >>> KEY_SHIFT;
            buckets[bucket]++;
            if (bucket < minBucket) {
                minBucket = bucket;
            }
            if (bucket > maxBucket) {
                maxBucket = bucket;
            }
        }
    }

    let activeCount = 0;
    for (let bucket = maxBucket; bucket >= minBucket; bucket--) {
        const size = buckets[bucket];
        buckets[bucket] = activeCount;
        activeCount += size;
    }

    for (let i = 0; i < count; i++) {
        const key = depthBits[i];
        if (key < DEPTH_INFINITY_F32) {
            order[buckets[key >>> KEY_SHIFT]++] = i;
        }
    }
    return activeCount;
}

let depths = new Float32Array(0);
let depthBits = new Uint32Array(depths.buffer);
function sortSplats(request: SendMessage<TaskType.SortSplats>['payload']) {
    const { count, sorting, ordering, cameraPosition, cameraDirection, radial, depthBias } = request;
    if (depths.length < count) {
        depths = new Float32Array(count);
        depthBits = new Uint32Array(depths.buffer);
    }

    const [cx, cy, cz] = cameraPosition;
    const [dx, dy, dz] = cameraDirection;
    for (let i = 0; i < count; i++) {
        const p = i * 4;
        let depth = Infinity;
        if (sorting[p + 3] > 0) {
            const x = sorting[p] - cx;
            const y = sorting[p + 1] - cy;
            const z = sorting[p + 2] - cz;
            const biasedDepth = x * dx + y * dy + z * dz + depthBias;
            if (biasedDepth > 0) {
                depth = radial ? Math.sqrt(x * x + y * y + z * z) : biasedDepth;
            }
        }
        depths[i] = depth;
    }

    const activeCount = countingSort(count, depthBits, ordering);
    return { activeCount, sorting, ordering };
}

const sorter = createSimdSort().catch(error => {
    console.warn('Splat sort WASM initialization failed; using JavaScript.', error);
    return sortSplats;
});

self.onmessage = async ({ data }: MessageEvent<SendMessage<TaskType.SortSplats>>) => {
    try {
        if (data.taskType !== TaskType.SortSplats) {
            throw new Error(`Unsupported task type: ${data.taskType}.`);
        }
        const payload = (await sorter)(data.payload);
        postMessage({ status: TaskStatus.Success, payload } satisfies ReceiveMessage<TaskType.SortSplats>, [
            payload.sorting.buffer,
            payload.ordering.buffer,
        ]);
    } catch (error) {
        postMessage({ status: TaskStatus.Fail, payload: String(error) } satisfies ReceiveMessage<TaskType.SortSplats>);
    }
};
