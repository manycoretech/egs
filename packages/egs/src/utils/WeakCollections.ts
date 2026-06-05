let mapId = 0;
export class IterableWeakMap<K extends object, V> {
    private weakSet = new Set<WeakRef<K>>();
    private instanceId = mapId++;
    private finalizationRegistry = new FinalizationRegistry((key: WeakRef<K>) => {
        this.weakSet.delete(key);
    });

    set(key: K, value: V) {
        let weak = (key as any).$weak;
        if (!weak) {
            (key as any).$weak = weak = {
                ref: new WeakRef(key),
                values: [],
            };
        }
        if (!this.weakSet.has(weak.ref)) {
            this.weakSet.add(weak.ref);
            this.finalizationRegistry.register(key, weak.ref, key);
        }
        weak.values[this.instanceId] = value;
    }

    get(key: K): V | undefined {
        return (key as any)?.$weak?.values?.[this.instanceId];
    }

    delete(key: K) {
        const weak = (key as any).$weak;
        if (!weak) {
            return;
        }
        delete weak.values[this.instanceId];
        this.weakSet.delete(weak.ref);
        this.finalizationRegistry.unregister(key);
    }

    forEach(visitor: (v: V, k: K) => any) {
        this.weakSet.forEach(ref => {
            const rk = ref.deref();
            if (rk !== undefined) {
                visitor((rk as any)?.$weak?.values?.[this.instanceId], rk);
            } else {
                this.weakSet.delete(ref);
            }
        });
    }

    clear() {
        const list = Array.from(this.weakSet);
        this.weakSet.clear();
        for (const ref of list) {
            const key = ref.deref();
            if (key !== undefined) {
                this.finalizationRegistry.unregister(key);
                delete (key as any).$weak?.values?.[this.instanceId];
            }
        }
    }
}

export class IterableWeakSet<V extends object> {
    private map = new IterableWeakMap<V, 1>();

    add(value: V) {
        this.map.set(value, 1);
    }

    has(value: V): boolean {
        return this.map.get(value) !== undefined;
    }

    delete(value: V) {
        this.map.delete(value);
    }

    forEach(visitor: (v: V) => any) {
        this.map.forEach((_, v) => visitor(v));
    }

    clear() {
        this.map.clear();
    }
}
