# @qunhe/egs-splat-loader

Loads 3D Gaussian splat files for the EGS runtime.

## Building the zstd decoder

ESZ and SPZ v4 use the C++ decoder in `utils/zstd-wasm/src/`. With the Emscripten SDK active and CMake 3.20+ and Ninja on `PATH`, run these commands from this package directory.

```sh
pnpm build:wasm
pnpm build:release
```

`pnpm build:wasm` builds `zstd.js` and `zstd.d.ts` in `utils/zstd-wasm/build/` and installs them alongside `LICENSE.zstd` in `utils/zstd-wasm/`. To install the same build elsewhere, run `cmake --install utils/zstd-wasm/build --prefix <output-directory>`.

The `ZstdDecompressor` interface and its WASM adapter live in `utils/zstd-wasm/index.ts`. Each native decoder owns its input and output buffers. `feed` returns copied chunks and `feedView` passes a borrowed chunk to a synchronous callback. Call `free()` for immediate release. In runtimes with `FinalizationRegistry`, garbage collection also releases abandoned decoders.
