import { DEFAULT_RAF_FUNCTION } from './Utils.js';

type TickerCallback<T> = (this: T, dt: number) => any;

/**
 * A Ticker class that runs an update loop that other objects listen to.
 * This class is composed around listeners meant for execution on the next requested animation frame.
 * Animation frames are requested only when necessary, e.g. When the ticker is started and the emitter has listeners.
 */
export class Ticker {
    /**
     * Whether or not this ticker should invoke the method {@link start} automatically when a listener is added.
     */
    autoStart = true;
    private requestAnimationFrame = DEFAULT_RAF_FUNCTION.requestAnimationFrame;
    private cancelAnimationFrame = DEFAULT_RAF_FUNCTION.cancelAnimationFrame;
    /**
     * The last time {@link update} was invoked.
     * This value is also reset internally outside of invoking update, but only when a new animation frame is requested.
     * If the platform supports DOMHighResTimeStamp, this value will have a precision of 1 µs.
     */
    private _lastTime = -1;
    /**
     * Whether or not this ticker has been started.
     */
    private _started = false;
    /**
     * The first listener.
     * All new listeners added are chained on this.
     */
    private _head = new TickerListener(() => {}, null, Infinity);
    /**
     * Internal current frame request ID.
     */
    private _requestId: number | null = null;
    /**
     * Internal tick method bound to ticker instance.
     * @param time Time since last tick.
     */
    private _tick: (time: number) => any;

    constructor() {
        this._tick = (time: number): void => {
            this._requestId = null;

            if (this._started) {
                // Invoke listeners now
                this.update(time);
                // Listener side effects may have modified ticker state.
                if (this._started && this._requestId === null && this._head.next) {
                    this._requestId = this.requestAnimationFrame(this._tick);
                }
            }
        };
    }
    /**
     * Conditionally requests a new animation frame.
     */
    private _requestIfNeeded(): void {
        if (this._requestId === null && this._head.next) {
            // ensure callbacks get correct delta
            this._lastTime = performance.now();
            this._requestId = this.requestAnimationFrame(this._tick);
        }
    }
    /**
     * Conditionally cancels a pending animation frame.
     */
    private _cancelIfNeeded(): void {
        if (this._requestId !== null) {
            this.cancelAnimationFrame(this._requestId);
            this._requestId = null;
        }
    }
    /**
     * Conditionally requests a new animation frame.
     */
    private _startIfPossible(): void {
        if (this._started) {
            this._requestIfNeeded();
        } else if (this.autoStart) {
            this.start();
        }
    }
    /**
     * Register a handler for tick events. Calls continuously unless it is removed or the ticker is stopped.
     * @param fn The listener function to be added for updates.
     * @param context The listener context.
     * @param priority The priority for emitting.
     * @return This instance of a ticker.
     */
    add<T = any>(fn: TickerCallback<T>, context: T, priority = 0): this {
        return this._addListener(new TickerListener(fn, context, priority));
    }
    /**
     * Add a handler for the tick event which is only execute once.
     * @param fn The listener function to be added for updates.
     * @param context The listener context.
     * @param priority The priority for emitting.
     * @return This instance of a ticker.
     */
    addOnce<T = any>(fn: TickerCallback<T>, context: T, priority = 0): this {
        return this._addListener(new TickerListener(fn, context, priority, true));
    }
    /**
     * Internally adds the event handler so that it can be sorted by priority.
     * Priority allows certain handler (user, AnimatedSprite, Interaction) to be run before the rendering.
     * @param listener Current listener being added.
     * @return This instance of a ticker.
     */
    private _addListener(listener: TickerListener): this {
        // For attaching to head
        let current = this._head.next;
        let previous = this._head;

        // Add the first item
        if (!current) {
            listener.connect(previous);
        } else {
            // Go from highest to lowest priority
            while (current) {
                if (listener.priority > current.priority) {
                    listener.connect(previous);
                    break;
                }
                previous = current;
                current = current.next;
            }

            // Not yet connected
            if (!listener.previous) {
                listener.connect(previous);
            }
        }

        this._startIfPossible();

        return this;
    }
    /**
     * Removes any handlers matching the function and context parameters.
     * If no handlers are left after removing, then it cancels the animation frame.
     * @param fn The listener function to be removed
     * @return This instance of a ticker.
     */
    remove<T = any>(fn: TickerCallback<T>, context: T): this {
        let listener = this._head.next;

        while (listener) {
            // We found a match, lets remove it
            // no break to delete all possible matches
            // incase a listener was added 2+ times
            if (listener.match(fn, context)) {
                listener = listener.destroy();
            } else {
                listener = listener.next;
            }
        }

        if (!this._head.next) {
            this._cancelIfNeeded();
        }

        return this;
    }
    /**
     * Starts the ticker. If the ticker has listeners.
     * Stops the ticker. If the ticker has requested a new animation frame is requested at this point.
     */
    start(): void {
        if (!this._started) {
            this._started = true;
            this._requestIfNeeded();
        }
    }
    /**
     * An animation frame it is canceled at this point.
     */
    stop(): void {
        if (this._started) {
            this._started = false;
            this._cancelIfNeeded();
        }
    }
    /**
     * Destroy the ticker and don't use after this.
     * Calling this method removes all references to internal events.
     */
    destroy(): void {
        this.stop();

        let listener = this._head.next;

        while (listener) {
            listener = listener.destroy(true);
        }

        this._head.destroy();
        this._head = null!;
    }
    /**
     * Triggers an update. An update entails setting.
     * @param currentTime the current time of execution
     */
    update(currentTime = performance.now()): void {
        let deltaTime: number;

        if (currentTime > this._lastTime) {
            // Save uncapped elapsedMS for measurement
            deltaTime = currentTime - this._lastTime;

            // Cache a local reference, in-case ticker is destroyed
            // during the emit, we can still check for head.next
            const head = this._head;

            // Invoke listeners added to internal emitter
            let listener = head.next;

            while (listener) {
                listener = listener.emit(deltaTime);
            }

            if (!head.next) {
                this._cancelIfNeeded();
            }
        }

        this._lastTime = currentTime;
    }

    /**
     * @internal
     */
    setupAnimationFunction(
        requestAnimationFrame: typeof globalThis.requestAnimationFrame,
        cancelAnimationFrame: typeof globalThis.cancelAnimationFrame,
    ) {
        const started = this._started;
        this.stop();
        this.requestAnimationFrame = requestAnimationFrame;
        this.cancelAnimationFrame = cancelAnimationFrame;
        if (started) {
            this.start();
        }
    }

    /**
     * @internal
     */
    resetDefaultAnimationFunction() {
        this.setupAnimationFunction(
            DEFAULT_RAF_FUNCTION.requestAnimationFrame,
            DEFAULT_RAF_FUNCTION.cancelAnimationFrame,
        );
    }

    private static _default: Ticker;
    /**
     * The default ticker instance for core timing functionality that shouldn't usually need to be paused.
     * @param currentTime the current time of execution
     */
    static get default() {
        if (!Ticker._default) {
            Ticker._default = new Ticker();
        }
        return Ticker._default;
    }
}

// Internal class for handling the priority sorting of ticker handlers.
class TickerListener<T = any> {
    // The current priority.
    priority: number;
    // The next item in chain.
    next: TickerListener | null;
    // The previous item in chain.
    previous: TickerListener | null;
    // The handler function to execute.
    private fn: TickerCallback<T>;
    // The calling to execute.
    private context: T;
    // If this should only execute once.
    private once: boolean;

    // `true` if this listener has been destroyed already.
    private _destroyed: boolean;

    // -fn The listener function to be added for one update
    // -context The listener context
    // -priority The priority for emitting
    // -once If the handler should fire once
    constructor(fn: TickerCallback<T>, context: T, priority = 0, once = false) {
        this.fn = fn;
        this.context = context;
        this.priority = priority;
        this.once = once;
        this.next = null;
        this.previous = null;
        this._destroyed = false;
    }

    // Simple compare function to figure out if a function and context match.
    // -fn The listener function to be added for one update
    // -context The listener context
    // -return `true` if the listener match the arguments
    match(fn: TickerCallback<T>, context: any = null): boolean {
        return this.fn === fn && this.context === context;
    }

    // Emit by calling the current function.
    // -deltaTime - time since the last emit.
    // -return Next ticker
    emit(deltaTime: number): TickerListener {
        if (this.fn) {
            if (this.context) {
                this.fn.call(this.context, deltaTime);
            } else {
                (this as TickerListener<any>).fn(deltaTime);
            }
        }

        const redirect = this.next!;

        if (this.once) {
            this.destroy(true);
        }

        // Soft-destroying should remove
        // the next reference
        if (this._destroyed) {
            this.next = null;
        }

        return redirect;
    }

    // Connect to the list.
    // -previous - Input node, previous listener
    connect(previous: TickerListener): void {
        this.previous = previous;
        if (previous.next) {
            previous.next.previous = this;
        }
        this.next = previous.next;
        previous.next = this;
    }

    // Destroy and don't use after this.
    // -hard `true` to remove the `next` reference, this
    //        is considered a hard destroy. Soft destroy maintains the next reference.
    // -return The listener to redirect while emitting or removing.
    destroy(hard = false): TickerListener {
        this._destroyed = true;
        this.fn = null!;
        this.context = null!;

        // Disconnect, hook up next and previous
        if (this.previous) {
            this.previous.next = this.next;
        }

        if (this.next) {
            this.next.previous = this.previous;
        }

        // Redirect to the next item
        const redirect = this.next!;

        // Remove references
        this.next = hard ? null : redirect;
        this.previous = null;

        return redirect;
    }
}
