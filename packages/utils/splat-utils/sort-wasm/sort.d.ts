// TypeScript bindings for emscripten-generated code.  Automatically generated at compile time.
declare namespace RuntimeExports {
    let HEAPU8: Uint8Array;
    /** @param {number} count @return {!Promise<number>} */
    function startSortWorkers(count: number): Promise<number>;
}
interface WasmModule {
  _init_sort(_0: number): void;
  _alloc_sort(_0: number): number;
  _sorting_buffer(_0: number): number;
  _ordering_buffer(_0: number): number;
  _invalidate_sorting(_0: number, _1: number, _2: number): void;
  _sort_splats(_0: number, _1: number, _2: number, _3: number, _4: number, _5: number, _6: number, _7: number, _8: number, _9: number, _10: number): number;
  _free(_0: number): void;
}

export type MainModule = WasmModule & typeof RuntimeExports;
export default function MainModuleFactory (options?: unknown): Promise<MainModule>;
