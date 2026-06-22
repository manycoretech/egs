/* oxlint-disable */

declare global {
    const CONFIG: {
        ENABLE_EGS_WASM: boolean;
    };

    var EGS_ENABLE_CONTENT_API: boolean;
    var EGS_MODULE_INITIALIZED: boolean;
    var EGS_WASM_NEED_PREPARE: boolean;
    var EGS_WASM_PREPARED: boolean;
    var EGS_MANAGED_CONTENT_API_DISABLED: boolean;
    // this tag is to prevent the endless uncaught error after the fatal case(like oom) occurred.
    var EGS_WASM_FATAL_ERROR_OCCURRED: boolean;
    var EGS_ENABLE_WEBGPU: boolean;
    var EGS_WEBGL1_RENDERER_COUNT: number;
}

export {};
