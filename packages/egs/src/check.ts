import { sendKtrackerEvent } from './utils/Logger';

function preCheckWASMRequirement() {
    return typeof WebAssembly !== 'undefined' &&
        typeof FinalizationRegistry !== 'undefined' &&
        typeof WebGL2RenderingContext !== 'undefined';
}

if (typeof CONFIG !== 'undefined' && CONFIG.ENABLE_EGS_WASM) {
    const env_support = preCheckWASMRequirement();
    if (!window.EGS_ENABLE_CONTENT_API && env_support) {
        window.EGS_ENABLE_CONTENT_API = true;
        window.EGS_WASM_NEED_PREPARE = true;
    }
    sendKtrackerEvent({
        eventType: 'egs_wasm_support',
        data: { v: 1 },
        labels: {
            support: String(env_support),
        },
    });
}
