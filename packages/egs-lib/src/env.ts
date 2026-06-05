declare const CONFIG: {
    IS_DEV: boolean;
    IS_TESTING: boolean;
    IS_DEV_OR_TESTING: boolean;
};

let isDebugEnable: boolean | undefined | null;

// tools common CONFIG
try {
    if (isDebugEnable == null && (CONFIG.IS_DEV || CONFIG.IS_TESTING || CONFIG.IS_DEV_OR_TESTING)) {
        isDebugEnable = true;
    }
} catch {}

// NODE_ENV
try {
    if (isDebugEnable == null && process.env.NODE_ENV !== 'production') {
        isDebugEnable = true;
    }
} catch {}

// url parameter
try {
    if (isDebugEnable == null) {
        const urlParam = new URLSearchParams(location.search);
        if (urlParam.has('__enable_debug__')) {
            isDebugEnable = true;
        } else if (urlParam.has('__disable_debug__')) {
            isDebugEnable = false;
        }
    }
} catch {}

if (isDebugEnable == null) {
    isDebugEnable = false;
}

/**
 * must be static
 */
export const ENV = {
    isDebugEnable,
};
