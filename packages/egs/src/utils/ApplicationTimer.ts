import { logger } from './Logger';

class ApplicationTimer {
    startupTime: number;
    firstRenderStart: number;

    private timeoutHandle: any;

    constructor() {
        this.startupTime = performance.now();
        this.firstRenderStart = -1;
        this.timeoutHandle = setTimeout(this.onTimeout, 1000 * 60 * 10); // 10 minutes
    }

    private onTimeout = () => {
        logger.error('Application startup took longer than 10 minutes. Something is probably wrong.');
        this.timeoutHandle = undefined;
    };

    updateFirstRenderTime(time: number) {
        if (this.firstRenderStart < 0) {
            this.firstRenderStart = time;
            const delta = this.firstRenderStart - this.startupTime;
            logger.info(
                `First render began, app startup: ${this.startupTime}ms, render start: ${this.firstRenderStart}ms, delta: ${delta}ms`,
            );
            if (this.timeoutHandle) {
                clearTimeout(this.timeoutHandle);
            }
            if (delta > 1000 * 60 * 10) {
                logger.error('Render startup took more than 10 minutes!');
            }
        }
    }
}

export const applicationTimer = new ApplicationTimer();
