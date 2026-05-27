import { ENV } from './env';

export const enum LogType {
    Unreachable = 'Unreachable',
    Unsupported = 'Unsupported',
    InvalidInput = 'InvalidInput',
    WebglError = 'WebglError',
    WebGpuError = 'WebGpuError',
}

export class Logger {
    static readonly MAX_EXCEPTION_SIZE = 1024;

    info(...param: any[]) {
        if (!ENV.isDebugEnable) {
            return;
        }
        // eslint-disable-next-line no-restricted-syntax
        console.log('EGS:', ...param);
    }

    warn(...param: any[]) {
        if (!ENV.isDebugEnable) {
            return;
        }
        // eslint-disable-next-line no-restricted-syntax
        console.warn('EGS:', ...param);
    }

    private exceptionCount: number = 0;
    error(content: string | Error, type: LogType = LogType.Unreachable) {
        if (!ENV.isDebugEnable && this.exceptionCount >= Logger.MAX_EXCEPTION_SIZE) {
            return;
        }
        const error: Error = typeof content === 'string' ? new Error(`EGS Exception: <${type}> ${content}`) : content;
        // eslint-disable-next-line no-restricted-syntax
        console.error(error);
    }

    // logic error
    unreachable(content: string) {
        this.error(content, LogType.Unreachable);
    }

    // platform issue
    unsupported(content: string) {
        this.error(content, LogType.Unsupported);
    }

    // user input invalid
    invalidInput(content: string) {
        this.error(content, LogType.InvalidInput);
    }

    // webgl error
    webglError(content: string) {
        this.error(content, LogType.WebglError);
    }

    webGpuError(content: string) {
        this.error(content, LogType.WebGpuError);
    }
}

export const logger = new Logger();
