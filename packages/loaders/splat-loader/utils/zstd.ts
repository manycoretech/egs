import * as ZstdWASM from './zstd-wasm/zstd.js';
import WASMBuffer from './zstd-wasm/zstd_bg.wasm.js';

let initPromise: Promise<void> | undefined;
export async function createZstdDecompressor(outputChunkSize: number = 64 * 1024) {
    initPromise ??= WebAssembly.instantiate(WASMBuffer, { './zstd_bg.js': ZstdWASM }).then(({ instance }) => {
        ZstdWASM.setWasmModule(instance.exports);
    });
    await initPromise;
    return ZstdWASM.ZstdDecompressor.withOutputChunkSize(outputChunkSize);
}
