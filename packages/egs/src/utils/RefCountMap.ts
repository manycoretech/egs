interface RefC<T> {
    item: T;
    count: number;
}

export class RefCountMap<K, V>{
    map: Map<K, RefC<V>> = new Map();

    onValueRemove = (_v: V) => { };

    getValue(key: K) {
        const record = this.map.get(key);
        if (record) {
            return record.item;
        }
        return;
    }

    add(key: K, value: V) {
        const old = this.map.get(key);
        if (old !== undefined) {
            old.count++;
        } else {
            this.map.set(key, {
                item: value, count: 1
            });
        }
    }

    delete(key: K) {
        const old = this.map.get(key);
        if (old !== undefined) {
            if (old.count === 1) {
                this.map.delete(key);
                this.onValueRemove(old.item);
            } else {
                old.count--;
            }
        }
    }

    forEach(v: (value: V) => any) {
        this.map.forEach(r => v(r.item));
    }

    clear() {
        this.forEach(v => this.onValueRemove(v));
        this.map.clear();
    }
}
