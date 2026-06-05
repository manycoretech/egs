import type { DrawableSet } from './DrawableSet';
import type { Drawable } from '../../drawables/Drawable';
import { DynamicAnalyser } from './DynamicAnalyser';
import type { RenderProxyManager } from './RenderProxyManager';
import type { DrawableList } from '../DrawcallList';
import { logger } from '../../../utils/Logger';

export class ProxyItemModification<T extends Drawable> {
    // this sets is exclusive;
    added: Set<T> = new Set();
    changed: Set<T> = new Set();
    // see applyModification
    invalidChanged: Set<T> = new Set();
    delete: Set<T> = new Set();

    get isNothingChanged() {
        return this.added.size === 0 && this.changed.size === 0 && this.delete.size === 0;
    }

    notifyChanged(item: T) {
        if (this.added.has(item) || this.delete.has(item)) {
            return;
        }
        this.changed.add(item);
    }

    notifyDelete(item: T) {
        this.added.delete(item);
        this.changed.delete(item);
        this.delete.add(item);
    }

    notifyNew(item: T) {
        this.delete.delete(item);
        this.changed.delete(item);
        this.added.add(item);
    }

    reset() {
        this.added.clear();
        this.changed.clear();
        this.delete.clear();
        this.invalidChanged.clear();
    }
}

export abstract class ProxyOptimizer<T extends Drawable, P extends Drawable> {
    abstract readonly optimizerName: string;

    dynamicAnalyser = new DynamicAnalyser<P>();
    private proxyed = new Map<P, ProxyItemModification<T>>();
    private proxyMap = new Map<T, P>();
    private sourceMap = new Map<P, Set<T>>();
    private isDirty: boolean = false;

    constructor(manger: RenderProxyManager) {
        this.dynamicAnalyser.onStaticFrameDirty = () => {
            manger.staticFrameDirtyId++;
        };
    }

    // decide this new item should be checked
    abstract isSource(d: Drawable): d is T;
    // define how to create new proxy from new collection
    abstract createProxies(list: T[]): Array<[P, T[]]>;
    // decide if this proxy can proxy the given drawable
    abstract isProxySource(p: P, d: T): boolean;
    // define how to update proxy, such as update gpu buffer, update proxyed key
    abstract updateProxy(p: P, list: T[]): void;
    // define how to handle drop proxy, such as dispose gpu, remove proxyed key
    abstract dropProxyResource(p: P): void;

    private _enabled = false;
    get enable() {
        return this._enabled;
    }
    setEnable(value: boolean, freeRenderables: DrawableSet) {
        if (this.enable === value) {
            return;
        }
        this._enabled = value;
        if (value) {
            this.isDirty = true;
            logger.info(`<${this.optimizerName}> waiting optimize.`);
        } else {
            this.maintain(freeRenderables);
            this.proxyed.forEach((_, p) => {
                this.dropProxy(p, freeRenderables);
            });
        }
    }

    private pickModification(obj: Drawable, f: (m: ProxyItemModification<T>, o: T, p: P) => void) {
        if (!this.enable) {
            return;
        }
        const proxy = this.proxyMap.get(obj as T);
        if (!proxy) {
            return;
        }
        const modification = this.proxyed.get(proxy)!;
        f(modification, obj as T, proxy);
        if (!this.isDirty) {
            this.isDirty = true;
            logger.info(`<${this.optimizerName}> waiting optimize.`);
        }
    }

    onObjectUpdate(obj: Drawable) {
        this.pickModification(obj, (m, o, p) => {
            m.notifyChanged(o);
            this.dynamicAnalyser.onObjectChange(p);
        });
    }

    onObjectDelete(obj: Drawable) {
        this.pickModification(obj, (m, o, p) => {
            m.notifyDelete(o);
            this.dynamicAnalyser.onObjectChange(p);
        });
    }

    private dropProxy(p: P, freeRenderables: DrawableSet): void {
        const source = Array.from(this.sourceMap.get(p)!);
        for (let i = 0; i < source.length; i++) {
            const item = source[i];
            freeRenderables.add(item);
            this.proxyMap.delete(item);
        }
        this.dynamicAnalyser.onObjectDelete(p);
        this.sourceMap.delete(p);
        this.proxyed.delete(p);
        this.dropProxyResource(p);
    }

    maintain(freeRenderables: DrawableSet, createProxyEnable: boolean = false): boolean {
        if (!this.enable || !(createProxyEnable || this.isDirty)) {
            return false;
        }
        this.isDirty = false;

        const time = performance.now();
        let originProxyCounts = 0;
        let proxyCreateCounts = 0;
        let proxyUpdateCounts = 0;
        let proxyDropCounts = 0;

        const canProxyRenderables: T[] = [];
        const used_flags: boolean[] = [];
        if (createProxyEnable) {
            freeRenderables.forEach(m => {
                if (this.isSource(m)) {
                    canProxyRenderables.push(m);
                }
            });
        }

        let isChanged = false;
        this.proxyed.forEach((m, p) => {
            for (let i = 0; i < canProxyRenderables.length; i++) {
                const item = canProxyRenderables[i];
                if (this.isProxySource(p, item)) {
                    m.notifyNew(item);
                    this.dynamicAnalyser.onObjectAdd(p);
                    used_flags[i] = true;
                }
            }

            if (m.isNothingChanged) {
                return;
            }
            isChanged = true;

            const source = this.sourceMap.get(p)!;
            m.added.forEach(item => source.add(item));
            m.delete.forEach(item => source.delete(item));
            m.changed.forEach(item => {
                if (!this.isProxySource(p, item)) {
                    m.invalidChanged.add(item);
                    source.delete(item);
                }
            });

            const applySuccess = source.size > 1;
            m.invalidChanged.forEach(o => {
                freeRenderables.add(o);
                this.proxyMap.delete(o);
            });
            m.delete.forEach(o => {
                freeRenderables.delete(o);
                this.proxyMap.delete(o);
            });
            if (applySuccess) {
                m.added.forEach(o => {
                    originProxyCounts++;
                    freeRenderables.delete(o);
                    this.proxyMap.set(o, p);
                });
                proxyUpdateCounts++;
                this.updateProxy(p, Array.from(source));
            } else {
                proxyDropCounts++;
                this.dropProxy(p, freeRenderables);
            }
            m.reset();
        });

        if (createProxyEnable) {
            const createdProxies = this.createProxies(canProxyRenderables.filter((_, i) => !used_flags[i]));
            for (let i = 0; i < createdProxies.length; i++) {
                const [p, source] = createdProxies[i];
                isChanged = true;
                proxyCreateCounts++;
                this.dynamicAnalyser.onObjectAdd(p);
                originProxyCounts += source.length;
                source.forEach(item => {
                    freeRenderables.delete(item);
                    this.proxyMap.set(item, p);
                });
                this.sourceMap.set(p, new Set(source));
                this.proxyed.set(p, new ProxyItemModification());
            }
        }

        if (isChanged) {
            logger.info(`<${this.optimizerName}> optimize finish.`, {
                time: performance.now() - time,
                origin: originProxyCounts,
                proxyCreate: proxyCreateCounts,
                proxyUpdate: proxyUpdateCounts,
                proxyDrop: proxyDropCounts,
            });
        }

        return isChanged;
    }

    generateDrawableList(list: DrawableList) {
        this.proxyed.forEach((_, p) => list.push(p));
    }

    generateDynamicList(list: DrawableList) {
        this.dynamicAnalyser.generateDynamicDrawcallList(list);
    }

    generateStaticList(list: DrawableList) {
        this.dynamicAnalyser.generateStaticDrawcallList(list);
    }
}
