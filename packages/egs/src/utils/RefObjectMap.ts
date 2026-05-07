export class RefObjectMap<K, V>{
    public map: Map<K, Set<V>> = new Map();

    public clear() {
        this.map.clear();
    }

    public has(key: K) {
        return this.map.has(key);
    }

    public add(key: K, value: V) {
        const old = this.map.get(key);
        if (old !== undefined) {
            old.add(value);
        } else {
            this.map.set(key, new Set([value]));
        }
    }

    public delete(key: K, value: V) {
        const old = this.map.get(key);
        if (old !== undefined) {
            old.delete(value);
            if (old.size === 0) {
                this.map.delete(key);
            }
        }
    }

    public forEachValueByKey(key: K, visitor: (v: V) => void) {
        const set = this.map.get(key);
        if (set !== undefined) {
            set.forEach(visitor);
        }
    }

}
