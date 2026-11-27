addToLibrary({
    $startSortWorkers__deps: ['$PThread'],
    $startSortWorkers__docs: '/** @param {number} count @return {!Promise<number>} */',
    $startSortWorkers: async function (count) {
        try {
            for (let index = 0; index < count; ++index) {
                PThread.allocateUnusedWorker();
            }
            await Promise.all(
                PThread.unusedWorkers.map(
                    worker =>
                        new Promise((resolve, reject) => {
                            const ready = PThread.loadWasmModuleToWorker(worker);
                            const onerror = worker.onerror;
                            worker.onerror = reject;
                            ready.then(() => {
                                worker.onerror = onerror;
                                resolve();
                            }, reject);
                        }),
                ),
            );
            return count;
        } catch (error) {
            PThread.terminateAllThreads();
            console.warn('Splat sort helpers unavailable, using the sorting worker.', error);
            return 0;
        }
    },
});

if (EMIT_TSD) {
    LibraryManager.libraryDefinitions.HEAPU8 ??= { docs: '/** @type {!Uint8Array} */', snippet: null };
}
