import type { Nullable } from './Utils';

export class HashKeyBuilder {
    private key = '';
    private static instance: HashKeyBuilder;

    getKey() {
        return this.key;
    }

    reset() {
        this.key = '';
        return this;
    }

    bool(item: boolean) {
        this.key += item ? '1' : '0';
        return this;
    }

    hasItem(item: Nullable<any>) {
        this.key += item !== null ? '1' : '0';
        return this;
    }

    isTexture(t: any) {
        this.key += t.isTexture ? '1' : '0';
        return this;
    }

    raw(item: any) {
        this.key += item;
        return this;
    }

    static getInstance() {
        if (!HashKeyBuilder.instance) {
            HashKeyBuilder.instance = new HashKeyBuilder();
        }
        return HashKeyBuilder.instance.reset();
    }
}
