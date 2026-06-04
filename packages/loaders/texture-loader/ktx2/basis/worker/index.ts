import type { TranscodeOptions } from '../transcoder';
import type { CompressTextureType } from '@qunhe/egs';
import { TaskType, TaskStatus, type TranscodeResult } from '../constants';

export function transcode(buffer: Uint8Array, supportedTypes: CompressTextureType[], options?: TranscodeOptions): Promise<TranscodeResult> {
    return import(
        /* webpackChunkName: "egs-transcoder-worker" */
        './pool'
    ).then(m => m.default.getWorker()).then(worker => new Promise<TranscodeResult>((resolve, reject) => {
        worker.onmessage = function (event: MessageEvent) {
            try {
                const { type, status, data } = event.data as { type: TaskType, status: TaskStatus, data: TranscodeResult };
                if (type !== TaskType.Transcode) {
                    reject(new Error('worker task type error'));
                    return;
                }
                if (status === TaskStatus.Fail) {
                    reject(new Error(data as any));
                    return;
                }
                if (status === TaskStatus.Success) {
                    resolve(data);
                    return;
                }
                reject(new Error('Unreachable!!!!'));
            } finally {
                worker.release();
            }
        };
        worker.postMessage({
            type: TaskType.Transcode,
            buffer,
            supportedTypes,
            options
        }, [buffer.buffer]);
    }));
}
