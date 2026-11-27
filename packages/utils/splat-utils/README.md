# @qunhe/egs-splat-utils

`@qunhe/egs-splat-utils` provides common utilities for working with 3D Gaussian Splatting in the EGS runtime. It covers Splat data conversion, runtime traversal, state editing, dense bounding-box estimation, BVH spatial indexing, and LOD chunk loading.

This package is usually used together with `@qunhe/egs` and `@qunhe/egs-splat-loader`.

## Building the SIMD sorter

The C++20 sorter lives in `sort-wasm/src/sort.cpp`, with headers in `sort-wasm/include/`. Activate the Emscripten SDK and make CMake 3.31 or newer and Ninja available on `PATH`. From this package directory, run

```sh
pnpm build:wasm
pnpm build:release
```

The C++ sorter allocates and reuses its own scratch buffer. The `sort-wasm/index.ts` adapter initializes the module per worker, copies centers into that buffer in chunks of 4096, and copies the visible indices back to the caller's ordering array. The worker falls back to JavaScript if WASM initialization fails.
