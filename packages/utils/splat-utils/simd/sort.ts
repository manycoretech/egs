import type { SendMessage, TaskType } from '../WorkerMessage.js';

const CHUNK_SIZE = 4096;
const CHUNK_BYTES = CHUNK_SIZE * 4 * Float32Array.BYTES_PER_ELEMENT;
const SIMD_ALIGNMENT = 16;

export async function createSimdSort() {
    const [binary, loader] = await Promise.all([import('./sort.wasm.js'), import('./sort-module.js')]);
    const wasm = await loader.default({
        async instantiateWasm(
            imports: WebAssembly.Imports,
            receiveInstance: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void,
        ) {
            const module = await WebAssembly.compile(binary.default);
            const instance = new WebAssembly.Instance(module, imports);
            receiveInstance(instance, module);
        },
    });
    // Keep the original allocation pointer for realloc; align the working address separately.
    let dataPtr = wasm._malloc(CHUNK_BYTES + SIMD_ALIGNMENT - 1);
    if (!dataPtr) {
        throw new Error('Failed to allocate the SIMD sort buffer.');
    }
    let dataBytes = CHUNK_BYTES;

    return (request: SendMessage<TaskType.SortSplats>['payload']) => {
        const { count, sorting, ordering, cameraPosition, cameraDirection, depthBias, radial } = request;
        // The last SIMD store writes four lanes, even for a partial chunk.
        const keysBytes = Math.ceil(count / 4) * 4 * Uint32Array.BYTES_PER_ELEMENT;
        const bytes = CHUNK_BYTES + keysBytes + count * Uint32Array.BYTES_PER_ELEMENT;
        if (bytes > dataBytes) {
            const nextPtr = wasm._realloc(dataPtr, bytes + SIMD_ALIGNMENT - 1);
            if (!nextPtr) {
                throw new Error(`Failed to allocate ${bytes} bytes for SIMD sorting.`);
            }
            dataPtr = nextPtr;
            dataBytes = bytes;
        }
        const centersPtr = Math.ceil(dataPtr / SIMD_ALIGNMENT) * SIMD_ALIGNMENT;
        const keysPtr = centersPtr + CHUNK_BYTES;
        const orderPtr = keysPtr + keysBytes;
        // Emscripten refreshes these views if realloc grows the memory.
        const chunk = wasm.HEAPF32.subarray(centersPtr >>> 2, (centersPtr >>> 2) + CHUNK_SIZE * 4);
        const [cx, cy, cz] = cameraPosition;
        const [dx, dy, dz] = cameraDirection;
        wasm._reset_buckets();
        for (let start = 0; start < count; start += CHUNK_SIZE) {
            const end = Math.min(start + CHUNK_SIZE, count);
            chunk.set(sorting.subarray(start * 4, end * 4));
            wasm._project_chunk(
                centersPtr,
                keysPtr + start * 4,
                end - start,
                cx,
                cy,
                cz,
                dx,
                dy,
                dz,
                depthBias,
                +radial,
            );
        }
        const activeCount = wasm._write_order(keysPtr, count, orderPtr);
        ordering.set(wasm.HEAPU32.subarray(orderPtr >>> 2, (orderPtr >>> 2) + activeCount));
        return { activeCount, sorting, ordering };
    };
}
