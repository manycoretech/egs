import {
    type TypedArray,
    type PickSubTypeProperty,
    isNumber,
    type ReadonlyMarked,
    type ReadOnlyMarkedCreatable,
} from './Utils';
import type { Object3D } from '../scene/Object3D';
import { logger } from './Logger';
import { TypeAssert } from '../scene/tools/TypeAssert';
import type { ReadonlyColor } from '../math/Color';
import type { ReadonlyMatrix3 } from '../math/Matrix3';
import type { ReadonlyVector2 } from '../EGS';

export interface SerializerableDelegated {
    serialize(serialize: Serializer): void;
    deserialize(ctx: Deserializer): void | Promise<any>;
}

export interface SerializerableDelegatedAsReference extends SerializerableDelegated, ClassNamePreserved {
    getUUID(): string;
}

export interface ClassNamePreserved {
    className(): string;
}

interface MutableSerializerableRaw {
    getSerializeData(): any;
    setSerializeData(value: any): void;
}

interface ReadonlySerializerableRaw extends ReadOnlyMarkedCreatable<any>, ReadonlyMarked<any> {
    getSerializeData(): any;
    clone(): MutableSerializerableRaw;
}

type SerializerableMath = ReadonlyVector2 | ReadonlyColor | ReadonlyMatrix3;

type SerializerableRaw = MutableSerializerableRaw | ReadonlySerializerableRaw | SerializerableMath;

type primitive = boolean | number | undefined | null | string;

type Serializerable = SerializerableRaw | SerializerableDelegated | primitive;

type ArrayOrSingle<T> = T | T[];

export type SerializerablePartKeys<T> = PickSubTypeProperty<T, ArrayOrSingle<Serializerable>>;

type SerializeResult =
    | {
          typeName?: string;
          data: any;
      }
    | any; // this is nonsense

interface CollectedBufferDescriptor {
    type: string;
    offset: number;
    length: number;
    index: number;
}

function isSerializerableRaw(item: Serializerable): item is SerializerableRaw {
    return item !== undefined && item !== null && (item as any).getSerializeData !== undefined;
}

function isObject(o: any): o is object {
    return typeof o === 'object' && o !== null; // js is awesome
}

export class Serializer<T extends Serializerable = any> {
    serializedResource: { [index: string]: any } = {};
    buffer: ArrayBuffer[] = [];
    byteLengthAll = 0;
    private serializeSource: T;
    private serializeTarget: any = {};
    private serializeTargetUuid: string;

    collectBuffer(data: TypedArray): CollectedBufferDescriptor {
        const offset = this.byteLengthAll;
        const index = this.buffer.length;
        const realBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        this.buffer.push(realBuffer as ArrayBuffer);
        this.byteLengthAll += data.byteLength;
        return {
            type: data.constructor.name, // this is safe, browser builtin type cant be erased in compilation;
            offset,
            length: data.byteLength,
            index,
        };
    }

    deepClone(value: any) {
        return JSON.parse(JSON.stringify(value));
    }

    // for some inner browser type of not convenient to impl SerializerAble
    putRaw(key: string, value: any) {
        this.serializeTarget[key] = value;
    }

    // write methods
    put(key: string, readKey = key) {
        // @ts-ignore
        const valueToSer = this.serializeSource[readKey];
        if (valueToSer === undefined) {
            logger.warn(`want serialize key <${key}>, but cant find it on object: `, this.serializeSource);
            return;
        }
        if (this.serializeTarget[key] !== undefined) {
            logger.warn(`<${key}> has been serialized before, it maybe a mistake`);
            return;
        }
        if (isObject(valueToSer)) {
            // object type
            if ((valueToSer as any).getSerializeData !== undefined) {
                this.serializeTarget[key] = (valueToSer as any).getSerializeData();
            } else {
                const serCustomObj = (v: SerializerableDelegated) => {
                    if (isNumber(v)) {
                        return v;
                    }

                    if (v.serialize !== undefined) {
                        const serResult = this.serialize(v);

                        return serResult;
                    } else {
                        // should warn by type constraint
                        logger.warn(
                            `<${key}> need serialize impl, the type constructor is <${valueToSer.constructor.name}>`,
                        );
                    }
                };

                if (Array.isArray(valueToSer)) {
                    this.serializeTarget[key] = valueToSer.map(v => serCustomObj(v));
                } else {
                    this.serializeTarget[key] = serCustomObj(valueToSer as any);
                }
            }
        } else {
            this.serializeTarget[key] = valueToSer;
        }
        return this;
    }

    puts<U>(keys: Array<SerializerablePartKeys<U>>) {
        keys.forEach(key => this.put(key as unknown as string));
    }

    serialize(s: any): SerializeResult {
        // backup state in call stack
        const perviousSerializeSource = this.serializeSource;
        const perviousSerializeTarget = this.serializeTarget;
        const perviousSerializeTargetUuid = this.serializeTargetUuid;

        const restore = () => {
            this.serializeSource = perviousSerializeSource;
            this.serializeTarget = perviousSerializeTarget;
            this.serializeTargetUuid = perviousSerializeTargetUuid;
        };

        this.serializeSource = s;
        this.serializeTarget = {};
        this.serializeTargetUuid = null!;
        let uuid;
        if (s.getUUID) {
            uuid = s.getUUID();
            // yes we have a reference type and ref it
            if (this.serializedResource[uuid] !== undefined) {
                const pre = this.serializedResource[uuid];
                restore();
                return {
                    typeName: pre.typeName,
                    data: uuid,
                };
            } else {
                // or let's serialize it
                this.serializeTargetUuid = uuid;
            }
        }
        s.serialize(this);
        uuid = this.serializeTargetUuid;
        if (uuid !== null) {
            // new found reference type has serialized ok, so just return ref
            let typeName = s.constructor.name; // use ctor name as fallback
            if (s.className === undefined) {
                logger.warn('SerializerableDelegatedAsReference should have className impl');
            } else {
                typeName = s.className();
            }
            this.serializedResource[uuid] = { typeName, data: this.serializeTarget };
            restore();
            return {
                typeName,
                data: uuid,
            };
        } else {
            // primitive type
            const result = this.serializeTarget;
            restore();
            return result;
        }
    }
}

// class database
export class SerializerMetaData {
    ctors = new Map<string, () => any>();

    registerCtor<T extends SerializerableDelegated>(key: string, builder: () => T) {
        this.ctors.set(key, builder);
    }
}

export class Deserializer {
    meta: SerializerMetaData;
    promisePool: Array<Promise<void>> = [];
    private rawData: any;
    private deSerializedResource: Map<string, any> = new Map();
    private serializedData: any;
    private deSerializeTarget: any;
    private buffers: ArrayBuffer[] = [];
    private getSliced: (tag: CollectedBufferDescriptor) => ArrayBuffer;

    constructor(json: any, buffers: ArrayBuffer[], meta: SerializerMetaData, isWholeBuffer = true) {
        this.buffers = buffers;
        this.rawData = json;
        this.meta = meta;
        this.getSliced = isWholeBuffer ? this.getAttributeFromWholeBuffer : this.getAttributeFromSplitBuffer;
    }

    getBuffer(tag: CollectedBufferDescriptor): TypedArray {
        const sliced = this.getSliced(tag);
        if (tag.type === 'Float32Array') {
            return new Float32Array(sliced);
        } else if (tag.type === 'Uint16Array') {
            return new Uint16Array(sliced);
        } else if (tag.type === 'Uint32Array') {
            return new Uint32Array(sliced);
        } else {
            throw 'cant find buffer in deserializer';
        }
    }

    readRaw(key: string) {
        return this.serializedData[key];
    }

    getData() {
        return this.serializedData;
    }

    // read methods
    read(key: string, writeKey = key): void | Promise<void> {
        const container = this.deSerializeTarget[writeKey];
        const valueToDeSer = this.serializedData[key];
        if (valueToDeSer === undefined) {
            logger.warn(`want deserialize key <${key}>, but cant find it on object: `, this.serializedData);
            return;
        }

        if (isSerializerableRaw(container)) {
            const value = (container as ReadOnlyMarkedCreatable<any>).clone();
            value.setSerializeData(valueToDeSer);
            this.deSerializeTarget[writeKey] = value; // trigger possible setter
            return;
        }

        const deSerObj = (d: any, c?: any) => {
            if (isNumber(d)) {
                return d;
            }
            if (d.typeName === undefined && !isObject(c)) {
                logger.warn(
                    `try to deserialize a none reference able object value, but container is not a object type`,
                );
                return;
            }
            if (isSerializerableRaw(c)) {
                const value = (c as ReadOnlyMarkedCreatable<any>).clone();
                value.setSerializeData(d);
                return value;
            } else {
                return this.deserialize(d, c);
            }
        };

        if (isObject(valueToDeSer)) {
            if (Array.isArray(valueToDeSer)) {
                const arr = valueToDeSer.map(d => deSerObj(d));
                if (arr[0] !== undefined && TypeAssert.isObject3D(arr[0])) {
                    // additional logic for scene tree build
                    arr.forEach(node => (this.deSerializeTarget as Object3D).add(node));
                } else {
                    this.deSerializeTarget[writeKey] = arr;
                }
            } else {
                const result = deSerObj(valueToDeSer, container);
                if (result instanceof Promise) {
                    const tempTarget = this.deSerializeTarget;
                    this.deSerializeTarget[writeKey] = null;
                    return result.then(c => {
                        tempTarget[writeKey] = c;
                    });
                } else {
                    this.deSerializeTarget[writeKey] = result;
                }
            }
        } else {
            this.deSerializeTarget[writeKey] = valueToDeSer;
        }
    }

    reads<U>(keys: Array<SerializerablePartKeys<U>>): void | Promise<void> {
        const promiseAttrsList: Array<Promise<void>> = [];
        keys.forEach(key => {
            const p = this.read(key as unknown as string);
            if (p) {
                promiseAttrsList.push(p);
            }
        });
        if (promiseAttrsList.length > 0) {
            const tempTarget = this.deSerializeTarget;
            const temp = Promise.all(promiseAttrsList).then(() => {
                if (tempTarget.notifyRecompileShader) {
                    // A hack way to refresh material
                    tempTarget.notifyRecompileShader();
                }
            });
            this.promisePool.push(temp);
            return temp;
        }
    }

    readCustom(key: string) {
        return this.serializedData[key];
    }

    readRawFromSource(id: string) {
        return this.rawData.resource[id].data;
    }
    deserialize<T extends SerializerableDelegated & Partial<ClassNamePreserved>>(
        seredData: any,
        container?: T,
    ): T | Promise<T> {
        let realSeredData = seredData;
        if (seredData.typeName !== undefined) {
            // oh this is a ref type
            realSeredData = realSeredData.data;

            if (typeof seredData.data === 'string') {
                // handle the root scene case
                const rt = this.deSerializedResource.get(seredData.data);
                if (rt !== undefined) {
                    // if we get a deserialized, just return
                    return rt;
                } else {
                    // or lets deserialize it
                    realSeredData = this.rawData.resource[seredData.data].data;
                    if (realSeredData === undefined) {
                        logger.warn('cant find referenced deserialized data');
                        return undefined as unknown as T;
                    }
                    if (!this.meta.ctors.has(seredData.typeName)) {
                        logger.warn(`cant find constructor <${seredData.typeName}>`);
                        return undefined as unknown as T;
                    }
                }
            }

            if (!container || (container.className && container.className() !== seredData.typeName)) {
                const ctor = this.meta.ctors.get(seredData.typeName);
                if (ctor === undefined) {
                    logger.unreachable(`cant find constructor ${seredData.typeName}`);
                    return undefined as unknown as T;
                }
                container = ctor(); // create default container;
            }
        }

        if (container === undefined) {
            logger.warn('missing container for deserialize');
            return undefined as unknown as T;
        }

        if (container.deserialize === undefined) {
            logger.warn('missing deserialize impl');
            return undefined as unknown as T;
        }

        // backup state in call stack
        const perviousSerializedData = this.serializedData;
        const perviousDeSerializeTarget = this.deSerializeTarget;

        this.serializedData = realSeredData;
        this.deSerializeTarget = container;
        const re = container.deserialize(this);

        this.serializedData = perviousSerializedData;
        this.deSerializeTarget = perviousDeSerializeTarget;

        if (seredData.typeName !== undefined) {
            // reference type
            this.deSerializedResource.set(seredData.data, container);
        }
        if (re instanceof Promise) {
            return re.then(() => container!);
        }
        return container;
    }

    deserializeObjectsById(rootId: string[]): Object3D[] {
        return rootId.map(id => {
            const seredData = this.rawData.resource[id];
            const container = this.meta.ctors.get(seredData.typeName)!();
            this.deserialize(seredData, container);
            return container;
        });
    }

    async loadResourceAsync(onload: () => void) {
        await Promise.all(this.promisePool).then(() => {
            onload();
        });
    }

    private getAttributeFromWholeBuffer = (tag: CollectedBufferDescriptor) => {
        return this.buffers[0].slice(tag.offset, tag.offset + tag.length);
    };

    private getAttributeFromSplitBuffer = (tag: CollectedBufferDescriptor) => {
        return this.buffers[tag.index];
    };
}
