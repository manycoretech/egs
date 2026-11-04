export interface Deferred<T = void> {
    resolve: (value?: T | PromiseLike<T>) => void;
    reject: (reason?: any) => void;
    promise: Promise<T>;
}

function noop() {}

export function deferred<T = void>(): Deferred<T> {
    // use `Promise.withResolvers` when available
    if (Promise.withResolvers) {
        return Promise.withResolvers<T>();
    }
    let resolve: (value?: T | PromiseLike<T>) => void = noop;
    let reject: (reason?: any) => void = noop;
    const promise = new Promise<T>(function (resolveInner, rejectInner) {
        resolve = resolveInner;
        reject = rejectInner;
    });
    return {
        promise,
        resolve,
        reject,
    };
}
