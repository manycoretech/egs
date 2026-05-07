/**
 * Object for keeping track of time.
 */
export class Clock {
    /**
     * If set, starts the clock automatically when the first update is called.
     * @DefaultValue is true.
     */
    public autoStart: boolean;
    /**
     * Holds the time at which the clock's start method was last called.
     */
    public startTime: number;
    /**
     * Holds the time at which the clock's {@link start| start}, {@link getElapsedTime| getElapsedTime} or {@link getDelta| getDelta} methods were last called.
     */
    public oldTime: number;
    /**
     * Keeps track of the total time that the clock has been running.
     */
    public elapsedTime: number;
    /**
     * Whether the clock is running or not.
     */
    public running: boolean;

    constructor(autoStart?: boolean) {
        this.autoStart = (autoStart !== undefined) ? autoStart : true;

        this.startTime = 0;
        this.oldTime = 0;
        this.elapsedTime = 0;
        this.running = false;
    }
    /**
     * Starts clock.
     * Also sets the {@link startTime| startTime} and {@link oldTime| oldTime} to the current time, sets {@link elapsedTime| elapsedTime} to 0 and running to true.
     */
    public start(): void {
        this.startTime = (typeof performance === 'undefined' ? Date : performance).now(); // see #10732
        this.oldTime = this.startTime;
        this.elapsedTime = 0;
        this.running = true;
    }
    /**
     * Stops clock and sets {@link oldTime| oldTime} to the current time.
     */
    public stop(): void {
        this.getElapsedTime();
        this.running = false;
        this.autoStart = false;
    }
    /**
     * Get the seconds passed since the clock started and sets {@link oldTime| oldTime} to the current time.
     * If {@link autoStart| autoStart} is true and the clock is not running, also starts the clock.
     */
    public getElapsedTime(): number {
        this.getDelta();
        return this.elapsedTime;
    }
    /**
     * Get the seconds passed since the time {@link oldTime| oldTime} was set and sets oldTime to the current time.
     * If {@link autoStart| autoStart} is true and the clock is not running, also starts the clock.
     */
    public getDelta(): number {
        let diff = 0;
        if (this.autoStart && !this.running) {
            this.start();
            return 0;
        }

        if (this.running) {
            const newTime = (typeof performance === 'undefined' ? Date : performance).now();
            diff = (newTime - this.oldTime) / 1000;
            this.oldTime = newTime;
            this.elapsedTime += diff;
        }

        return diff;
    }
}
