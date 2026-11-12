# @qunhe/egs-splat-utils

`@qunhe/egs-splat-utils` provides common utilities for working with 3D Gaussian Splatting in the EGS runtime. It covers Splat data conversion, runtime traversal, state editing, dense bounding-box estimation, BVH spatial indexing, and LOD chunk loading.

This package is usually used together with `@qunhe/egs` and `@qunhe/egs-splat-loader`.

## Building the SIMD sorter

The C++20 source is in `simd/src/sort.cpp`, and `simd/CMakeLists.txt` defines the WebAssembly build.
Install the Emscripten SDK, CMake 3.20 or newer, and Ninja. Set `EMSDK_HOME` to the SDK root; CMake,
Ninja, and Python must be available on `PATH` (or set `EMSDK_PYTHON` to the SDK's Python executable).

From this package directory in PowerShell:

```powershell
$env:EMSDK_HOME = '/path/to/emsdk'
pnpm build:wasm
```

On Linux or macOS:

```sh
EMSDK_HOME=/path/to/emsdk pnpm build:wasm
```

The script locates `emcmake` under `EMSDK_HOME/upstream/emscripten`, configures CMake with
`-G Ninja -DCMAKE_BUILD_TYPE=Release`, and runs `ninja -C simd/build`. Emscripten generates
the ESM loader `sort-module.js`, its TypeScript declarations, and `sort-module.wasm`.
The script copies the loader and declarations to `simd/`, then uses `@internal/utils/array-buffer.js`
to embed the WASM in `simd/sort.wasm.js` and generate `simd/sort.wasm.d.ts` for the worker.
Like the texture transcoder, the worker dynamically imports the loader and embedded binary in
parallel, then compiles and instantiates the binary in Emscripten's `instantiateWasm` hook.
Each sorter reuses a buffer managed by Emscripten's `malloc` and `realloc` functions.
Emscripten maintains the heap views and memory growth. The raw WASM stays in the CMake build
directory; it is not copied to the source directory or published package.
The intermediate CMake build directory is ignored by Git.
