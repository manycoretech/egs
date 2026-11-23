// TypeScript bindings for emscripten-generated code.  Automatically generated at compile time.
declare namespace RuntimeExports {
    let HEAPU8: Uint8Array;
}
interface WasmModule {
}

export interface ClassHandle {
  isAliasOf(other: ClassHandle): boolean;
  delete(): void;
  deleteLater(): this;
  isDeleted(): boolean;
  // @ts-ignore - If targeting lower than ESNext, this symbol might not exist.
  [Symbol.dispose](): void;
  clone(): this;
}
export interface ZstdDecompressor extends ClassHandle {
  readonly input_ptr: number;
  readonly input_capacity: number;
  readonly output_ptr: number;
  at_frame_boundary(): boolean;
  next_output(): number;
  begin_input(_0: number, _1: number, _2: boolean): void;
  error_name(): string;
}

interface EmbindModule {
  ZstdDecompressor: {
    withOutputChunkSize(_0: number): ZstdDecompressor;
  };
}

export type MainModule = WasmModule & typeof RuntimeExports & EmbindModule;
export default function MainModuleFactory (options?: unknown): Promise<MainModule>;
