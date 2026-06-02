import { TypedArray } from './Utils';
import { Deferred, deferred } from './Deferred';

const TASK_POLL_INTERVAL = 10;

interface Task {
    gl: WebGL2RenderingContext;
    sync: WebGLSync,
    deferred: Deferred<void>
}

let tasks: Task[] = [];
let taskBack: Task[] = [];
let inSchedule = false;

function pollTasks() {
    for (const task of tasks) {
        const res = task.gl.clientWaitSync(task.sync, 0, 0);
        if (res === task.gl.WAIT_FAILED) {
            task.deferred.reject(new Error('GL client sync failed'));
            continue;
        }
        if (res === task.gl.TIMEOUT_EXPIRED) {
            taskBack.push(task);
            continue;
        }
        task.deferred.resolve();
    }
    [tasks, taskBack] = [taskBack, tasks];
    taskBack.length = 0;
    inSchedule = false;
    taskInterval();
}

function taskInterval() {
    if (!inSchedule && tasks.length > 0) {
        inSchedule = true;
        setTimeout(pollTasks, TASK_POLL_INTERVAL);
    }
}

function scheduleTask(gl: WebGL2RenderingContext, sync: WebGLSync): Task {
    const task = {
        gl,
        sync,
        deferred: deferred<void>()
    };
    tasks.push(task);
    taskInterval();
    return task;
}

export async function getBufferSubDataAsync(gl: WebGL2RenderingContext, target: number, buffer: WebGLBuffer, srcByteOffset: number, dstBuffer: TypedArray, dstOffset?: number, length?: number) {
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)!;
    gl.flush();

    await scheduleTask(gl, sync).deferred.promise;
    gl.deleteSync(sync);

    gl.bindBuffer(target, buffer);
    gl.getBufferSubData(target, srcByteOffset, dstBuffer, dstOffset, length);
    gl.bindBuffer(target, null);
}
