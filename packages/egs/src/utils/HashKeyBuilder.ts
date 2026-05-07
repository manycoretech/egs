import { Nullable } from './Utils';

export class HashKeyBuilder {
    private key = '';
    private static instance: HashKeyBuilder;

    public getKey() {
        return this.key;
    }

    public reset() {
        this.key = '';
        return this;
    }

    public bool(item: boolean) {
        this.key += item ? '1' : '0';
        return this;
    }

    public hasItem(item: Nullable<any>) {
        this.key += item !== null ? '1' : '0';
        return this;
    }

    public isTexture(t: any) {
        this.key += t.isTexture ? '1' : '0';
        return this;
    }

    public raw(item: any) {
        this.key += item;
        return this;
    }

    public static getInstance() {
        if (!HashKeyBuilder.instance) {
            HashKeyBuilder.instance = new HashKeyBuilder();
        }
        return HashKeyBuilder.instance.reset();
    }
}
