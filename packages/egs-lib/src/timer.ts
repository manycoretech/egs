export function sleep(timeout: number) {
    return new Promise<void>(resolve => {
        setTimeout(resolve, timeout);
    });
}

export interface DebounceOptions {
    signal?: AbortSignal;
    edges?: Array<'leading' | 'trailing'>;
}

export interface DebouncedFunction<F extends (...args: any[]) => void> {
    (...args: Parameters<F>): void;
    schedule: () => void;
    cancel: () => void;
    flush: () => void;
}

export function debounce<F extends (...args: any[]) => void>(
    func: F,
    debounceMs: number,
    { signal, edges }: DebounceOptions = {}
): DebouncedFunction<F> {
    let pendingThis: any = undefined;
    let pendingArgs: Parameters<F> | null = null;

    const leading = edges != null && edges.includes('leading');
    const trailing = edges == null || edges.includes('trailing');

    const invoke = () => {
        if (pendingArgs !== null) {
            func.apply(pendingThis, pendingArgs);
            pendingThis = undefined;
            pendingArgs = null;
        }
    };

    const onTimerEnd = () => {
        if (trailing) {
            invoke();
        }

        cancel();
    };

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
        if (timeoutId != null) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            timeoutId = null;

            onTimerEnd();
        }, debounceMs);
    };

    const cancelTimer = () => {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    };

    const cancel = () => {
        cancelTimer();
        pendingThis = undefined;
        pendingArgs = null;
    };

    const flush = () => {
        invoke();
    };

    const debounced = function (this: any, ...args: Parameters<F>) {
        if (signal?.aborted) {
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        pendingThis = this;
        pendingArgs = args;

        const isFirstCall = timeoutId == null;

        schedule();

        if (leading && isFirstCall) {
            invoke();
        }
    };

    debounced.schedule = schedule;
    debounced.cancel = cancel;
    debounced.flush = flush;

    signal?.addEventListener('abort', cancel, { once: true });

    return debounced;
}

export interface ThrottleOptions {
    signal?: AbortSignal;
    edges?: Array<'leading' | 'trailing'>;
}

export interface ThrottledFunction<F extends (...args: any[]) => void> {
    (...args: Parameters<F>): void;
    cancel: () => void;
    flush: () => void;
}

export function throttle<F extends (...args: any[]) => void>(
    func: F,
    throttleMs: number,
    { signal, edges = ['leading', 'trailing'] }: ThrottleOptions = {}
): ThrottledFunction<F> {
    let pendingAt: number | null = null;

    const debounced = debounce(
        function (this: any, ...args: Parameters<F>) {
            pendingAt = Date.now();
            func.apply(this, args);
        },
        throttleMs,
        { signal, edges }
    );

    const throttled = function (this: any, ...args: Parameters<F>) {
        if (pendingAt == null) {
            pendingAt = Date.now();
        }

        if (Date.now() - pendingAt >= throttleMs) {
            pendingAt = Date.now();
            func.apply(this, args);

            debounced.cancel();
            debounced.schedule();
            return;
        }

        debounced.apply(this, args);
    };

    throttled.cancel = debounced.cancel;
    throttled.flush = debounced.flush;

    return throttled;
}
