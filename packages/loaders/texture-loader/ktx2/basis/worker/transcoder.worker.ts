/// <reference lib="webworker" />

import { TaskType, TaskStatus } from '../constants';
import { transcode } from '../transcoder';

self.onmessage = async (event: MessageEvent) => {
    const type: TaskType = event.data.type;
    if (type === TaskType.Transcode) {
        try {
            const { buffer, supportedTypes, options } = event.data;
            const result = await transcode(buffer, supportedTypes, options);
            self.postMessage({ type: TaskType.Transcode, status: TaskStatus.Success, data: result }, [result.buffer]);
        } catch (error) {
            const message = error.message ?? error;
            self.postMessage({ type: TaskType.Transcode, status: TaskStatus.Fail, data: message });
        }
    }
};
