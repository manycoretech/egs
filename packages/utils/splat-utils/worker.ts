/// <reference lib="webworker" />

import { TaskStatus, TaskType, type IMessage, type ReceiveMessage, type SendMessage } from './WorkerMessage.js';
import * as WasmSort from './sort-wasm/index.js';

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
function sortSplats({
    storage: { sorting, ordering },
    count,
    cameraPosition,
    cameraDirection,
    radial,
    depthBias,
}: IMessage[TaskType.Sort]['send']) {
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

    return countingSort(count, depthBits, ordering);
}

let sort: Awaited<ReturnType<typeof WasmSort.init>>;
self.onmessage = async ({ data }: MessageEvent<SendMessage>) => {
    const storage = data.payload && 'storage' in data.payload ? data.payload.storage : undefined;
    let reply: ReceiveMessage<TaskType>;
    try {
        let payload: IMessage[TaskType]['receive'];
        const { taskType } = data;
        switch (taskType) {
            case TaskType.Init:
                sort ??= await WasmSort.init(data.payload).catch(error => {
                    console.warn('WASM splat sort unavailable, using JavaScript.', error);
                    return sortSplats;
                });
                break;
            case TaskType.Alloc:
                payload = WasmSort.alloc(data.payload.capacity, data.payload.storage?.sorting);
                break;
            case TaskType.Update:
                WasmSort.update(data.payload);
                break;
            case TaskType.Sort:
                payload = { activeCount: sort(data.payload) ?? sortSplats(data.payload) };
                break;
            case TaskType.Release:
                WasmSort.release(data.payload.region);
                break;
            default:
                throw new Error(`Unsupported task type: ${taskType}.`);
        }
        reply = { status: TaskStatus.Success, payload };
    } catch (error) {
        reply = { status: TaskStatus.Fail, payload: String(error) };
    }
    reply.returned = storage;
    postMessage(
        reply,
        storage
            ? [storage.sorting.buffer, storage.ordering.buffer].filter(buffer => buffer instanceof ArrayBuffer)
            : [],
    );
};
