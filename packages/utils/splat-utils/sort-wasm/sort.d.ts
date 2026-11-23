// TypeScript bindings for emscripten-generated code.  Automatically generated at compile time.
declare namespace RuntimeExports {
    let HEAPF32: Float32Array;
    let HEAPU32: Uint32Array;
}
interface WasmModule {
  _sort_chunk_size(): number;
  _begin_sort(_0: number): number;
  _project_chunk(_0: number, _1: number, _2: number, _3: number, _4: number, _5: number, _6: number, _7: number, _8: number, _9: number): void;
  _write_order(_0: number): number;
  _sort_order(): number;
}

export type MainModule = WasmModule & typeof RuntimeExports;
export default function MainModuleFactory (options?: unknown): Promise<MainModule>;
