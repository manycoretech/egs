import * as child_process from 'node:child_process';
import * as os from 'node:os';
import * as path from 'node:path';

interface Worker {
    process: child_process.ChildProcess,
    piped: boolean
}

const workers: Worker[] = [];
const splitRegex = /\r?\n/;

function pauseStdout() {
    for (const worker of workers) {
        if (!worker.piped) {
            continue;
        }
        worker.process.stdout?.pause();
    }
}

function resumeStdout() {
    for (const worker of workers) {
        if (!worker.piped) {
            continue;
        }
        worker.process.stdout?.resume();
    }
}

function pauseStderr() {
    for (const worker of workers) {
        if (!worker.piped) {
            continue;
        }
        worker.process.stderr?.pause();
    }
}

function resumeStderr() {
    for (const worker of workers) {
        if (!worker.piped) {
            continue;
        }
        worker.process.stderr?.resume();
    }
}

process.stdout.on('drain', resumeStdout);
process.stderr.on('drain', resumeStderr);

interface ExecOptions {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    ioPrefix?: string;
    pipe?: boolean;
}

export interface ExecResult {
    process: child_process.ChildProcess;
    promise: Promise<void>;
}

const DEFAULT_EXEC_OPTIONS: Required<ExecOptions> = {
    cwd: process.cwd(),
    env: process.env,
    ioPrefix: '',
    pipe: true
};

function writeOutput(data: string, ioPrefix: string, stream: NodeJS.WriteStream, writeStartPrefix: boolean) {
    const r = data.split(splitRegex);
    const additionNL = r[r.length - 1] === '';
    if (additionNL) {
        r.splice(r.length - 1, 1);
    }
    let output = (writeStartPrefix ? ioPrefix : '') + r.join(os.EOL + ioPrefix);
    if (additionNL) {
        output += os.EOL;
    }
    return stream.write(output);
}

function bindAndPromisify(p: child_process.ChildProcess, ioPrefix: string, pipe: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
        function onError(error: any) {
            reject(error);
            cleanUp();
        }
        let needStdOutWriteStartPrefix = true;
        let needStdErrWriteStartPrefix = true;
        function onStdoutData(data: string) {
            if (!pipe) {
                return;
            }
            if (!writeOutput(data, ioPrefix, process.stdout, needStdOutWriteStartPrefix)) {
                pauseStdout();
            }
            needStdOutWriteStartPrefix = data[data.length - 1] === '\n';
        }
        function onStderrData(data: string) {
            if (!pipe) {
                return;
            }
            if (!writeOutput(data, ioPrefix, process.stderr, needStdErrWriteStartPrefix)) {
                pauseStderr();
            }
            needStdErrWriteStartPrefix = data[data.length - 1] === '\n';
        }
        function onExit(code?: number, signal?: any) {
            try {
                if (code != null) {
                    if (code === 0) {
                        resolve();
                        return;
                    } else {
                        reject(new Error(`Process exited with code ${code}`));
                        return;
                    }
                }
                if (signal) {
                    reject(new Error(`Process exited with signal ${signal}`));
                    return;
                }
            } finally {
                cleanUp();
            }
        }
        function cleanUp() {
            p.removeListener('error', onError);
            p.removeListener('exit', onExit);
            cleanUpIO();
            const idx = workers.findIndex(item => item.process === p);
            if (idx !== -1) {
                workers.splice(idx, 1);
            }
        }
        function cleanUpIO() {
            if (!pipe) {
                return;
            }
            p.stdout?.removeListener('data', onStdoutData);
            p.stdout?.removeListener('error', cleanUpIO);
            p.stdout?.removeListener('end', cleanUpIO);

            p.stderr?.removeListener('data', onStderrData);
            p.stderr?.removeListener('error', cleanUpIO);
            p.stderr?.removeListener('end', cleanUpIO);
        }
        p.on('error', onError);
        p.on('exit', onExit);
        if (pipe) {
            p.stdout?.on('data', onStdoutData);
            p.stdout?.on('error', cleanUpIO);
            p.stdout?.on('end', cleanUpIO);
            p.stdout?.setEncoding('utf-8');

            p.stderr?.on('data', onStderrData);
            p.stderr?.on('error', cleanUpIO);
            p.stderr?.on('end', cleanUpIO);
            p.stderr?.setEncoding('utf-8');
        }
        workers.push({
            process: p,
            piped: pipe
        });
    });
}

export function execCommand(command: string, options: ExecOptions = DEFAULT_EXEC_OPTIONS): ExecResult {
    const process = child_process.exec(command, {
        cwd: options.cwd ?? DEFAULT_EXEC_OPTIONS.cwd,
        env: options.env ?? DEFAULT_EXEC_OPTIONS.env,
    });
    return {
        process,
        promise: bindAndPromisify(process, options.ioPrefix ?? DEFAULT_EXEC_OPTIONS.ioPrefix, options.pipe ?? DEFAULT_EXEC_OPTIONS.pipe),
    };
}

export function echoAndExecCommand(command: string, options: ExecOptions = DEFAULT_EXEC_OPTIONS) {
    console.log(`${options.ioPrefix ?? DEFAULT_EXEC_OPTIONS.ioPrefix}${command}`);
    return execCommand(command, options);
}

interface SpawnOptions extends ExecOptions {
    shell?: boolean | string
}

const DEFAULT_SPAWN_OPTIONS: Required<SpawnOptions> = {
    ...DEFAULT_EXEC_OPTIONS,
    shell: false
};

export function spawnProcess(command: string, args: string[], options: SpawnOptions = DEFAULT_SPAWN_OPTIONS) {
    const process = child_process.spawn(command, args, {
        cwd: options.cwd ?? DEFAULT_SPAWN_OPTIONS.cwd,
        env: options.env ?? DEFAULT_SPAWN_OPTIONS.env,
        shell: options.shell ?? DEFAULT_SPAWN_OPTIONS.shell,
    });

    return {
        process,
        promise: bindAndPromisify(process, options.ioPrefix ?? DEFAULT_SPAWN_OPTIONS.ioPrefix, options.pipe ?? DEFAULT_SPAWN_OPTIONS.pipe),
    };
}

export function echoAndSpawnProcess(command: string, args: string[], options: SpawnOptions = DEFAULT_SPAWN_OPTIONS) {
    console.log(`${options.ioPrefix ?? DEFAULT_SPAWN_OPTIONS.ioPrefix}${command} ${args.join(' ')}`);
    return spawnProcess(command, args, options);
}

export {
    workers
};

export function $(cmd: string, dir: string, inherit = true) {
    const cwd = dir ? path.resolve(process.cwd(), dir) : process.cwd();
    console.info(`<${cwd}> ${cmd}`);
    const result = child_process.execSync(cmd, {
        cwd,
        env: process.env,
        stdio: inherit ? 'inherit' : undefined,
    });
    return inherit ? void 0 : result.toString();
}
