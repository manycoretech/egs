/// <reference lib="webworker" />

import { TaskType, type SendMessage, TaskStatus, type ReceiveMessage } from './WorkerMessage.js';

const DEPTH_INFINITY = 0x7bff;
const buckets = new Uint32Array(0x10000);
function sortSplats(counts: number, sorting: Uint16Array, order: Uint32Array): number {
    buckets.fill(0);

    for (let i = 0; i < counts; i++) {
        buckets[sorting[i]]++;
    }
    let activeCount = 0;
    for (let i = DEPTH_INFINITY - 1; i >= 0; i--) {
        const v = buckets[i];
        buckets[i] = activeCount;
        activeCount += v;
    }
    for (let i = 0; i < counts; i++) {
        const v = sorting[i];
        if (v < DEPTH_INFINITY) {
            order[buckets[v]++] = i;
        }
    }

    return activeCount;
}

const DEPTH_INFINITY_F32 = 0x7f800000 - 1;
// Match WebGPU: stable descending order on the upper 24 float32 depth bits.
const KEY_SHIFT = 8;
const RADIX_BITS = 8;
const RADIX = 1 << RADIX_BITS;
const RADIX_MASK = RADIX - 1;
const HIGH_RADIX = 1 << (24 - RADIX_BITS);
const HI_OFFSET = RADIX;
let radixBuckets: Uint32Array | undefined; // [low buckets | high buckets]
let scratch: { indices: Uint32Array; digits: Uint16Array } | undefined;
let depthBuckets: Uint32Array | undefined;
function sort24Splats(counts: number, sorting: Uint32Array, order: Uint32Array): number {
    // Counting avoids radix scratch traffic once the input is large enough.
    if (counts < 8 * 1024 * 1024) {
        return radixSort24Splats(counts, sorting, order);
    }

    let minKey = DEPTH_INFINITY_F32;
    let maxKey = -1;
    for (let i = 0; i < counts; i++) {
        const key = sorting[i];
        if (key < DEPTH_INFINITY_F32) {
            if (key < minKey) {
                minKey = key;
            }
            if (key > maxKey) {
                maxKey = key;
            }
        }
    }
    if (maxKey < minKey) {
        return 0;
    }
    const minDepth = minKey >>> KEY_SHIFT;
    const bucketCount = (maxKey >>> KEY_SHIFT) - minDepth + 1;
    if (bucketCount > counts / 4) {
        return radixSort24Splats(counts, sorting, order);
    }
    if (!depthBuckets || depthBuckets.length < bucketCount) {
        depthBuckets = new Uint32Array(bucketCount);
    }
    const buckets = depthBuckets;
    buckets.fill(0, 0, bucketCount);
    for (let i = 0; i < counts; i++) {
        const key = sorting[i];
        if (key < DEPTH_INFINITY_F32) {
            buckets[(key >>> KEY_SHIFT) - minDepth]++;
        }
    }
    let activeCount = 0;
    for (let i = bucketCount - 1; i >= 0; i--) {
        const count = buckets[i];
        buckets[i] = activeCount;
        activeCount += count;
    }
    for (let i = 0; i < counts; i++) {
        const key = sorting[i];
        if (key < DEPTH_INFINITY_F32) {
            order[buckets[(key >>> KEY_SHIFT) - minDepth]++] = i;
        }
    }
    return activeCount;
}

function radixSort24Splats(counts: number, sorting: Uint32Array, order: Uint32Array): number {
    if (!radixBuckets) {
        radixBuckets = new Uint32Array(RADIX + HIGH_RADIX);
    }
    if (!scratch || scratch.indices.length < counts) {
        scratch = { indices: new Uint32Array(counts), digits: new Uint16Array(counts) };
    }
    const { indices, digits } = scratch;
    const buckets = radixBuckets;
    buckets.fill(0);

    let activeCount = 0;

    for (let i = 0; i < counts; ++i) {
        const key = sorting[i];
        if (key >= DEPTH_INFINITY_F32) {
            continue;
        }

        const inv = ~key >>> KEY_SHIFT;
        buckets[inv & RADIX_MASK] += 1;
        buckets[HI_OFFSET + (inv >>> RADIX_BITS)] += 1;
        activeCount++;
    }

    // Pass 1: low 8 key bits
    let offset = 0;
    for (let b = 0; b < RADIX; ++b) {
        const count = buckets[b];
        buckets[b] = offset;
        offset += count;
    }

    for (let i = 0; i < counts; ++i) {
        const key = sorting[i];
        if (key < DEPTH_INFINITY_F32) {
            const inv = ~key >>> KEY_SHIFT;
            const position = buckets[inv & RADIX_MASK]++;
            indices[position] = i;
            digits[position] = inv >>> RADIX_BITS;
        }
    }

    // Pass 2: high 16 key bits
    offset = 0;
    for (let b = 0; b < HIGH_RADIX; ++b) {
        const p = HI_OFFSET + b;
        const count = buckets[p];
        buckets[p] = offset;
        offset += count;
    }

    for (let i = 0; i < activeCount; ++i) {
        order[buckets[HI_OFFSET + digits[i]]++] = indices[i];
    }

    return activeCount;
}

self.onmessage = async (event: MessageEvent) => {
    try {
        const message = event.data as { taskType: TaskType };
        switch (message.taskType) {
            case TaskType.SortSplats: {
                const { count, sorting, ordering } = (event.data as SendMessage<TaskType.SortSplats>).payload;
                const activeCount =
                    sorting instanceof Uint32Array
                        ? sort24Splats(count, sorting, ordering)
                        : sortSplats(count, sorting, ordering);
                const payload: ReceiveMessage<TaskType.SortSplats> = {
                    status: TaskStatus.Success,
                    payload: { activeCount, sorting, ordering },
                };
                postMessage(payload, [sorting.buffer, ordering.buffer]);
                return;
            }
            default: {
                const check: never = message.taskType;
                throw new Error(`Unsupported task type: ${check}.`);
            }
        }
    } catch (e) {
        console.error(e);
        postMessage({ status: TaskStatus.Fail, payload: e.toString() });
    }
};
