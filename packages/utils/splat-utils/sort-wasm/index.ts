import type { IMessage, SortStorage, TaskType } from '../WorkerMessage.js';
import type { MainModule } from './sort.js';

let wasm: MainModule | undefined;
let transferRegion = 0;
let transferCapacity = 0;

export async function init({ moduleUrl, shared: allowShared }: IMessage[TaskType.Init]['send']) {
    let helperBlobUrl: string | undefined;
    try {
        const { default: initModule } = (await import(
            /* @vite-ignore */ /* webpackIgnore: true */ moduleUrl
        )) as typeof import('./sort.js');
        const cores = navigator.hardwareConcurrency;
        let helpers = 0;
        if (allowShared && typeof Worker !== 'undefined' && cores >= 4) {
            helpers = cores >= 8 ? 3 : 1;
        }
        if (helpers && new URL(moduleUrl).origin !== self.location.origin) {
            const source = new Blob([`import ${JSON.stringify(moduleUrl)}`], { type: 'text/javascript' });
            helperBlobUrl = URL.createObjectURL(source);
        }
        const module = await initModule({ mainScriptUrlOrBlob: helperBlobUrl ?? moduleUrl });
        const shared =
            allowShared &&
            typeof SharedArrayBuffer !== 'undefined' &&
            module.HEAPU8.buffer instanceof SharedArrayBuffer;
        module._init_sort(await module.startSortWorkers(shared ? helpers : 0));
        wasm = module;
        return shared ? sortShared : sortTransferred;
    } finally {
        if (helperBlobUrl) {
            URL.revokeObjectURL(helperBlobUrl);
        }
    }
}

export function alloc(capacity: number, previous?: Float32Array): SortStorage | undefined {
    if (!wasm || typeof SharedArrayBuffer === 'undefined' || !(wasm.HEAPU8.buffer instanceof SharedArrayBuffer)) {
        return;
    }
    const region = wasm._alloc_sort(capacity);
    if (!region) {
        return;
    }
    const heap = wasm.HEAPU8.buffer;
    const sorting = new Float32Array(heap, wasm._sorting_buffer(region) >>> 0, capacity * 4);
    const ordering = new Uint32Array(heap, wasm._ordering_buffer(region) >>> 0, capacity);
    if (previous) {
        sorting.set(previous);
    }
    return { region, sorting, ordering };
}

export function update({ storage, changed }: IMessage[TaskType.Update]['send']) {
    const region = storage.region!;
    const module = wasm!;
    for (const { start, end } of changed) {
        module._invalidate_sorting(region, start, end);
    }
}

function sortShared(params: IMessage[TaskType.Sort]['send']) {
    const { region } = params.storage;
    if (region === undefined) {
        return;
    }
    return sortRegion(params, region, true);
}

function sortTransferred(params: IMessage[TaskType.Sort]['send']) {
    const { storage, count } = params;
    if (!count) {
        return 0;
    }
    const module = wasm!;
    if (count > transferCapacity) {
        module._free(transferRegion);
        transferRegion = module._alloc_sort(count);
        transferCapacity = transferRegion ? count : 0;
        if (!transferRegion) {
            return;
        }
    }
    const input = new Float32Array(module.HEAPU8.buffer, module._sorting_buffer(transferRegion) >>> 0, count * 4);
    input.set(storage.sorting.subarray(0, count * 4));
    const activeCount = sortRegion(params, transferRegion, false);
    const orderStart = module._ordering_buffer(transferRegion) >>> 0;
    storage.ordering.set(new Uint32Array(module.HEAPU8.buffer, orderStart, activeCount));
    return activeCount;
}

function sortRegion(params: IMessage[TaskType.Sort]['send'], region: number, useCache: boolean) {
    const { count, cameraPosition, cameraDirection, depthBias, radial } = params;
    const [cx, cy, cz] = cameraPosition;
    const [dx, dy, dz] = cameraDirection;
    return wasm!._sort_splats(region, count, cx, cy, cz, dx, dy, dz, depthBias, +radial, +useCache);
}

export function release(region: number) {
    wasm!._free(region);
}
