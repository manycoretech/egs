export class RefObjectMap<K, V> {
    map: Map<K, Set<V>> = new Map();

    clear() {
        this.map.clear();
    }

    has(key: K) {
        return this.map.has(key);
    }

    add(key: K, value: V) {
        const old = this.map.get(key);
        if (old !== undefined) {
            old.add(value);
        } else {
            this.map.set(key, new Set([value]));
        }
    }

    delete(key: K, value: V) {
        const old = this.map.get(key);
        if (old !== undefined) {
            old.delete(value);
            if (old.size === 0) {
                this.map.delete(key);
            }
        }
    }

    forEachValueByKey(key: K, visitor: (v: V) => void) {
        const set = this.map.get(key);
        if (set !== undefined) {
            set.forEach(visitor);
        }
    }
}
