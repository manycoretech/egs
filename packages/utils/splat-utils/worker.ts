/// <reference lib="webworker" />

import { TaskType, type SendMessage, TaskStatus, type ReceiveMessage } from './WorkerMessage';

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
const RADIX_BITS = 16;
const RADIX = 1 << RADIX_BITS;
const RADIX_MASK = RADIX - 1;
const HI_OFFSET = RADIX;
let bucket16: Uint32Array | undefined; // [lo buckets | hi buckets]
let scratch: Uint32Array | undefined;
function sort32Splats(counts: number, sorting: Uint32Array, order: Uint32Array): number {
    if (!bucket16) {
        bucket16 = new Uint32Array(RADIX * 2);
    }
    if (!scratch || scratch.length < counts) {
        scratch = new Uint32Array(counts);
    }
    const buckets = bucket16;
    buckets.fill(0);

    let activeCount = 0;

    for (let i = 0; i < counts; ++i) {
        const key = sorting[i];
        if (key >= DEPTH_INFINITY_F32) {
            continue;
        }

        const inv = ~key >>> 0;
        buckets[inv & RADIX_MASK] += 1;
        buckets[HI_OFFSET + (inv >>> RADIX_BITS)] += 1;
        order[activeCount++] = i;
    }

    // Pass 1: lo 16 bits
    let offset = 0;
    for (let b = 0; b < RADIX; ++b) {
        const count = buckets[b];
        buckets[b] = offset;
        offset += count;
    }

    for (let i = 0; i < activeCount; ++i) {
        const idx = order[i];
        const inv = ~sorting[idx] >>> 0;
        scratch[buckets[inv & RADIX_MASK]++] = idx;
    }

    // Pass 2: hi 16 bits
    offset = 0;
    for (let b = 0; b < RADIX; ++b) {
        const p = HI_OFFSET + b;
        const count = buckets[p];
        buckets[p] = offset;
        offset += count;
    }

    for (let i = 0; i < activeCount; ++i) {
        const idx = scratch[i];
        const inv = ~sorting[idx] >>> 0;
        order[buckets[HI_OFFSET + (inv >>> RADIX_BITS)]++] = idx;
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
                        ? sort32Splats(count, sorting, ordering)
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
