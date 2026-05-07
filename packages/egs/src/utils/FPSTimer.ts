import { ValueCounter } from './ValueCounter';
import { EventDispatcher, EventType } from '../utils/EventDispatcher';
import { DEFAULT_RAF_FUNCTION } from './Utils';

export const TickEvent = new EventType();

export class FPSTimer extends EventDispatcher {
    frameId = 0;
    private requestAnimationFrame = DEFAULT_RAF_FUNCTION.requestAnimationFrame;
    private cancelAnimationFrame = DEFAULT_RAF_FUNCTION.cancelAnimationFrame;
    private enabled: boolean = false;
    private defaultTickCounter = new ValueCounter();
    private activeTickCounter = new ValueCounter();
    private lastTickTime = 0;
    private lastRequestID = 0;

    get lastFrameTime(): number {
        return this.activeTickCounter.getLast();
    }

    setupAnimationFunction(requestAnimationFrame: typeof globalThis.requestAnimationFrame, cancelAnimationFrame: typeof globalThis.cancelAnimationFrame) {
        const enabled = this.enabled;
        this.stop();
        this.requestAnimationFrame = requestAnimationFrame;
        this.cancelAnimationFrame = cancelAnimationFrame;
        if (enabled) {
            this.start();
        }
    }

    resetDefaultAnimationFunction() {
        this.setupAnimationFunction(DEFAULT_RAF_FUNCTION.requestAnimationFrame, DEFAULT_RAF_FUNCTION.cancelAnimationFrame);
    }

    start(): void {
        if (this.enabled) {
            return;
        }
        this.enabled = true;
        this.lastTickTime = 0;
        this.lastRequestID = this.requestAnimationFrame(this.tick);
    }

    stop(): void {
        if (!this.enabled) {
            return;
        }
        this.enabled = false;
        this.cancelAnimationFrame(this.lastRequestID);
    }

    destroy(): void {
        this.stop();
        this.tick = undefined!;
        this.clearAllListeners();
    }

    tick = (now: number) => {
        if (!this.enabled) {
            return;
        }
        this.frameId++;
        const t = now - this.lastTickTime;
        this.lastTickTime = now;
        this.defaultTickCounter.set(t);
        this.emit(TickEvent);
        if (this.tick) {
            this.lastRequestID = this.requestAnimationFrame(this.tick);
        }
    };

    pick(): void {
        this.activeTickCounter.set(this.defaultTickCounter.getLast());
    }

    getAverageFrameTime(): number {
        return this.activeTickCounter.getAverage();
    }

    reset(): void {
        this.defaultTickCounter.clear();
        this.activeTickCounter.clear();
    }
}
