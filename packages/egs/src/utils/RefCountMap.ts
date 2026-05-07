interface RefC<T> {
    item: T;
    count: number;
}

export class RefCountMap<K, V>{
    public map: Map<K, RefC<V>> = new Map();

    public onValueRemove = (_v: V) => { };

    public getValue(key: K) {
        const record = this.map.get(key);
        if (record) {
            return record.item;
        }
        return;
    }

    public add(key: K, value: V) {
        const old = this.map.get(key);
        if (old !== undefined) {
            old.count++;
        } else {
            this.map.set(key, {
                item: value, count: 1
            });
        }
    }

    public delete(key: K) {
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

    public forEach(v: (value: V) => any) {
        this.map.forEach(r => v(r.item));
    }

    public clear() {
        this.forEach(v => this.onValueRemove(v));
        this.map.clear();
    }
}
