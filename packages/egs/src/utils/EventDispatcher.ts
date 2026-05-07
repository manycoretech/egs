import { _Math } from '../math/Math';
import { BaseElement } from './ElementBase';

export class EventType<Payload = never> {
    payload?: Payload;
    symbol = Symbol();

    constructor(public description: string = '') { }
}

export interface Listener<Payload = never> {
    (payload: Payload): void;
}
/**
 * JavaScript events for custom objects.
 */
export class EventDispatcher {
    public _uuid: string | null = null;
    get uuid() {
        if (this._uuid === null) {
            this._uuid = _Math.generateUUID();
        }
        return this._uuid;
    }
    set uuid(uuid) {
        this._uuid = uuid;
    }

    public _listeners: Map<Symbol, Listener[]> = new Map();
    /**
     * Adds a listener to an event type.
     * @param type The type of event to listen to.
     * @param listener The function that gets called when the event is fired.
     */
    public on<T>(type: EventType<T>, listener: Listener<T>) {
        let listeners = this._listeners.get(type.symbol);
        if (listeners === undefined) {
            this._listeners.set(type.symbol, []);
        }

        listeners = this._listeners.get(type.symbol)!;

        if (listeners.indexOf(listener) === - 1) {
            listeners.push(listener);
        }
    }
    /**
     * Only active the listener one times and then off {@link it| it}.
     */
    public once<T>(type: EventType<T>, listener: Listener<T>) {
        const remover = () => {
            this.off(type, listener);
            this.off(type, remover);
        };
        this.on(type, listener);
        this.on(type, remover);
    }
    /**
     * Checks if listener is added to an event type.
     */
    public has<T>(type: EventType<T>, listener: Listener<T>) {
        const listeners = this._listeners.get(type.symbol);
        return listeners !== undefined && listeners.indexOf(listener) !== - 1;
    }
    /**
     * Removes a listener from listening list.
     */
    public off<T>(type: EventType<T>, listener: Listener<T>) {
        const listeners = this._listeners.get(type.symbol);
        if (listeners !== undefined) {
            const index = listeners.indexOf(listener);
            if (index !== - 1) {
                listeners.splice(index, 1);
            }
        }
    }
    /**
     * Active the event and call the registered listener.
     */
    public emit(type: EventType<never>): void;
    public emit<T>(type: EventType<T>, payload: T): void;
    public emit(...args: any[]): void {
        const rawListeners = this._listeners.get(args[0].symbol);
        if (rawListeners !== undefined) {
            const listeners = rawListeners.slice();
            if (listeners !== undefined) {
                for (let i = 0, l = listeners.length; i < l; i++) {
                    listeners[i].call(this, args[1] as never);
                }
            }
        }
    }
    /**
     * Removes all listeners from listening list.
     */
    public clearAllListeners() {
        this._listeners.clear();
    }
}

export abstract class ElementEventDispatcher extends BaseElement implements EventDispatcher {
    _uuid: any = null;
    uuid: string;
    public _listeners: Map<Symbol, Listener[]> = new Map();
    public on<T>(_type: EventType<T>, _listener: Listener<T>): void {
    }
    public once<T>(_type: EventType<T>, _listener: Listener<T>): void {
    }
    public has<T>(_type: EventType<T>, _listener: Listener<T>): boolean {
        return false;
    }
    public off<T>(_type: EventType<T>, _listener: Listener<T>): void {
    }
    public emit(type: EventType<never>): void;
    public emit<T>(type: EventType<T>, payload: T): void;
    public emit(..._args: any[]): void {
    }
    public clearAllListeners(): void {
    }
}
applyMixins(ElementEventDispatcher, [EventDispatcher]);
Object.defineProperty(ElementEventDispatcher.prototype,
    'uuid', {
    get () {
        if (!this._uuid) {
            this._uuid = _Math.generateUUID();
        }
        return this._uuid;
    },
    set (uuid) {
        this._uuid = uuid;
    }
},
);

// https://www.tslang.cn/docs/handbook/mixins.html
function applyMixins(derivedCtor: any, baseCtors: any[]) {
    baseCtors.forEach(baseCtor => {
        Object.getOwnPropertyNames(baseCtor.prototype).forEach(name => {
            derivedCtor.prototype[name] = baseCtor.prototype[name];
        });
    });
}
