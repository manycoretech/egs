import type { IMessage, TaskType } from '../WorkerMessage.js';
import initSort from './sort.js';

type SortMessage = IMessage[TaskType.SortSplats];

export async function createWasmSorter() {
    const wasm = await initSort();
    const chunkSize = wasm._sort_chunk_size();

    return (request: SortMessage['send']): SortMessage['receive'] => {
        const { count, sorting, ordering, cameraPosition, cameraDirection, depthBias, radial } = request;
        if (!Number.isInteger(count) || count < 0 || count > sorting.length / 4) {
            throw new RangeError('Splat count must be an integer within the sorting buffer.');
        }

        const centersPtr = wasm._begin_sort(count);
        if (!centersPtr) {
            throw new Error(`Failed to allocate WASM sort buffer for ${count} splats.`);
        }
        const { HEAPF32, HEAPU32 } = wasm;
        const centersStart = centersPtr >>> 2;
        const [cx, cy, cz] = cameraPosition;
        const [dx, dy, dz] = cameraDirection;
        for (let start = 0; start < count; start += chunkSize) {
            const end = Math.min(start + chunkSize, count);
            HEAPF32.set(sorting.subarray(start * 4, end * 4), centersStart);
            wasm._project_chunk(start, end - start, cx, cy, cz, dx, dy, dz, depthBias, +radial);
        }
        const activeCount = wasm._write_order(count);
        const orderStart = wasm._sort_order() >>> 2;
        ordering.set(HEAPU32.subarray(orderStart, orderStart + activeCount));
        return { activeCount, sorting, ordering };
    };
}
