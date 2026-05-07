"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function (o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function () { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function (o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function (o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function (o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function (o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.workers = void 0;
exports.execCommand = execCommand;
exports.echoAndExecCommand = echoAndExecCommand;
exports.spawnProcess = spawnProcess;
exports.echoAndSpawnProcess = echoAndSpawnProcess;
exports.$ = $;
const child_process = __importStar(require("node:child_process"));
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
const workers = [];
exports.workers = workers;
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
const DEFAULT_EXEC_OPTIONS = {
    cwd: process.cwd(),
    env: process.env,
    ioPrefix: '',
    pipe: true
};
function writeOutput(data, ioPrefix, stream, writeStartPrefix) {
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
function bindAndPromisify(p, ioPrefix, pipe) {
    return new Promise((resolve, reject) => {
        function onError(error) {
            reject(error);
            cleanUp();
        }
        let needStdOutWriteStartPrefix = true;
        let needStdErrWriteStartPrefix = true;
        function onStdoutData(data) {
            if (!pipe) {
                return;
            }
            if (!writeOutput(data, ioPrefix, process.stdout, needStdOutWriteStartPrefix)) {
                pauseStdout();
            }
            needStdOutWriteStartPrefix = data[data.length - 1] === '\n';
        }
        function onStderrData(data) {
            if (!pipe) {
                return;
            }
            if (!writeOutput(data, ioPrefix, process.stderr, needStdErrWriteStartPrefix)) {
                pauseStderr();
            }
            needStdErrWriteStartPrefix = data[data.length - 1] === '\n';
        }
        function onExit(code, signal) {
            try {
                if (code != null) {
                    if (code === 0) {
                        resolve();
                        return;
                    }
                    else {
                        reject(new Error(`Process exited with code ${code}`));
                        return;
                    }
                }
                if (signal) {
                    reject(new Error(`Process exited with signal ${signal}`));
                    return;
                }
            }
            finally {
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
function execCommand(command, options = DEFAULT_EXEC_OPTIONS) {
    const process = child_process.exec(command, {
        cwd: options.cwd ?? DEFAULT_EXEC_OPTIONS.cwd,
        env: options.env ?? DEFAULT_EXEC_OPTIONS.env,
    });
    return {
        process,
        promise: bindAndPromisify(process, options.ioPrefix ?? DEFAULT_EXEC_OPTIONS.ioPrefix, options.pipe ?? DEFAULT_EXEC_OPTIONS.pipe),
    };
}
function echoAndExecCommand(command, options = DEFAULT_EXEC_OPTIONS) {
    console.log(`${options.ioPrefix ?? DEFAULT_EXEC_OPTIONS.ioPrefix}${command}`);
    return execCommand(command, options);
}
const DEFAULT_SPAWN_OPTIONS = {
    ...DEFAULT_EXEC_OPTIONS,
    shell: false
};
function spawnProcess(command, args, options = DEFAULT_SPAWN_OPTIONS) {
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
function echoAndSpawnProcess(command, args, options = DEFAULT_SPAWN_OPTIONS) {
    console.log(`${options.ioPrefix ?? DEFAULT_SPAWN_OPTIONS.ioPrefix}${command} ${args.join(' ')}`);
    return spawnProcess(command, args, options);
}

function $(cmd, dir, inherit = true) {
    const cwd = dir ? path.resolve(process.cwd(), dir) : process.cwd();
    console.info(`<${cwd}> ${cmd}`);
    const result = child_process.execSync(cmd, {
        cwd,
        env: process.env,
        stdio: inherit ? 'inherit' : undefined,
    });
    return inherit ? void 0 : result.toString();
}
