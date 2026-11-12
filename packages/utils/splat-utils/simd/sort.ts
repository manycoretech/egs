import type { SendMessage, TaskType } from '../WorkerMessage.js';
import wasmBuffer from './sort.wasm.js';

interface SortExports extends WebAssembly.Exports {
    memory: WebAssembly.Memory;
    __heap_base: WebAssembly.Global;
    resetBuckets(): void;
    projectChunk(
        centers: number,
        keys: number,
        count: number,
        cx: number,
        cy: number,
        cz: number,
        dx: number,
        dy: number,
        dz: number,
        bias: number,
        radial: number,
    ): void;
    writeOrder(keys: number, count: number, order: number): number;
}

const CHUNK_SIZE = 4096;
const WASM_PAGE_SIZE = 65536;

export async function createSimdSort() {
    const { instance } = await WebAssembly.instantiate(wasmBuffer);
    const wasm = instance.exports as SortExports;
    const { memory } = wasm;
    const centersPtr = Number(wasm.__heap_base.value);
    const keysPtr = centersPtr + CHUNK_SIZE * 4 * Float32Array.BYTES_PER_ELEMENT;

    return (request: SendMessage<TaskType.SortSplats>['payload']) => {
        const { count, sorting, ordering, cameraPosition, cameraDirection, depthBias, radial } = request;
        // The last SIMD store writes four lanes, even for a partial chunk.
        const orderPtr = keysPtr + Math.ceil(count / 4) * 4 * Uint32Array.BYTES_PER_ELEMENT;
        const bytes = orderPtr + count * Uint32Array.BYTES_PER_ELEMENT;
        if (bytes > memory.buffer.byteLength) {
            memory.grow(Math.ceil((bytes - memory.buffer.byteLength) / WASM_PAGE_SIZE));
        }
        const chunk = new Float32Array(memory.buffer, centersPtr, CHUNK_SIZE * 4);
        const [cx, cy, cz] = cameraPosition;
        const [dx, dy, dz] = cameraDirection;
        wasm.resetBuckets();
        for (let start = 0; start < count; start += CHUNK_SIZE) {
            const end = Math.min(start + CHUNK_SIZE, count);
            chunk.set(sorting.subarray(start * 4, end * 4));
            wasm.projectChunk(centersPtr, keysPtr + start * 4, end - start, cx, cy, cz, dx, dy, dz, depthBias, +radial);
        }
        const activeCount = wasm.writeOrder(keysPtr, count, orderPtr);
        ordering.set(new Uint32Array(memory.buffer, orderPtr, activeCount));
        return { activeCount, sorting, ordering };
    };
}
