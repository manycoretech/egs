import { deferred, type Deferred } from '@qunhe/egs-lib';
import * as ZstdWASM from './wasm/zstd.js';
import WASMBuffer from './wasm/zstd_bg.wasm.js';

let initdDeferred: Deferred | undefined;

const WasmImportMap = {
    './zstd_bg.js': ZstdWASM as any,
};
let WASM_INSTANCE: WebAssembly.Instance;
let WASM_MODULE: WebAssembly.Module;
async function init() {
    if (initdDeferred) {
        return initdDeferred.promise;
    }
    initdDeferred = deferred();
    if (WASM_MODULE) {
        WASM_INSTANCE = await WebAssembly.instantiate(WASM_MODULE, WasmImportMap);
    } else {
        const { instance, module } = await WebAssembly.instantiate(WASMBuffer, WasmImportMap);
        WASM_INSTANCE = instance;
        WASM_MODULE = module;
    }
    ZstdWASM.setWasmModule(WASM_INSTANCE.exports);
    initdDeferred.resolve();
}

export async function createZstdDecompressor(outputChunkSize: number = 64 * 1024) {
    await init();
    return ZstdWASM.ZstdDecompressor.withOutputChunkSize(outputChunkSize);
}
