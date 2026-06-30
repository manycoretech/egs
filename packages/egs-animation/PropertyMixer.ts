import { Quaternion, type Object3D, type Material } from '@qunhe/egs';
import { multiplyQuaternionsFlat, type TrackPath } from './utils.js';
import { Blend } from './type.js';

/**
 * buffer layout: [ incoming | accu0 | accu1 | orig | addAccu | (optional work) ]
 *
 * interpolators can use data then goes to 'incoming'
 *
 * 'accu0' and 'accu1' are used frame-interleaved for
 * the cumulative result and are compared to detect changes
 *
 * 'orig' stores the original state of the property
 *
 * 'add' is used for additive cumulative results
 *
 * 'work' is optional and is only present for quaternion types.
 * It is used to store intermediate quaternion multiplication results
 */

const ORIG_INDEX = 3;
const ADD_INDEX = 4;
const WORK_INDEX = 5;

function lerp(buffer: number[], dstOffset: number, srcOffset: number, t: number, stride: number) {
    const s = 1 - t;
    for (let i = 0; i < stride; i++) {
        const j = dstOffset + i;
        buffer[j] = buffer[j] * s + buffer[srcOffset + i] * t;
    }
}

function lerpAdditive(buffer: any, dstOffset: number, srcOffset: number, t: number, stride: number) {
    for (let i = 0; i < stride; i++) {
        const j = dstOffset + i;
        buffer[j] = buffer[j] + buffer[srcOffset + i] * t;
    }
}

function slerp(buffer: number[], dstOffset: number, srcOffset: number, t: number) {
    Quaternion.slerpFlat(buffer, dstOffset, buffer, dstOffset, buffer, srcOffset, t);
}

function slerpAdditive(buffer: any, dstOffset: number, srcOffset: number, t: number, stride: number) {
    const workOffset = WORK_INDEX * stride;
    // Store result in intermediate buffer offset
    multiplyQuaternionsFlat(buffer, workOffset, buffer, dstOffset, buffer, srcOffset);
    // Slerp to the intermediate result
    Quaternion.slerpFlat(buffer, dstOffset, buffer, dstOffset, buffer, workOffset, t);
}

function setIdentity(buffer: number[], stride: number) {
    const startIndex = ADD_INDEX * stride;
    const endIndex = startIndex + stride;
    for (let i = startIndex; i < endIndex; i++) {
        buffer[i] = 0;
    }
}

function setIdentityQuaternion(buffer: number[], stride: number) {
    setIdentity(buffer, stride);
    buffer[ADD_INDEX * stride + 3] = 1;
}

interface IMixer {
    setIdentity(buffer: number[], stride: number): void;
    mix(buffer: number[], dstOffset: number, srcOffset: number, t: number, stride: number): void;
    mixAdditive(buffer: number[], dstOffset: number, srcOffset: number, t: number, stride: number): void;
    back(buffer: number[], offset: number): void;
    apply(buffer: number[], offset: number): void;
}

function createRotationMixer(target: Object3D): IMixer {
    return {
        mix: slerp,
        mixAdditive: slerpAdditive,
        setIdentity: setIdentityQuaternion,
        apply: (buffer: number[], offset: number) => {
            const q = target.quaternion;
            const x = buffer[offset];
            const y = buffer[offset + 1];
            const z = buffer[offset + 2];
            const w = buffer[offset + 3];
            if (q.x === x && q.y === y && q.z === z && q.w === w) {
                return;
            }
            q.set(x, y, z, w);
        },
        back: (buffer: number[], offset: number) => {
            target.quaternion.toArray(buffer, offset);
        },
    };
}

function createUvRotationMixer(target: Material): IMixer {
    return {
        mix: lerp,
        mixAdditive: lerpAdditive,
        setIdentity,
        apply: (buffer: number[], offset: number) => {
            const q = target.metaData.rotation;
            const x = buffer[offset];
            if (q === x) {
                return;
            }
            target.metaData.rotation = x;
            target.metaData.uvTransformDirty = true;
        },
        back: (buffer: number[], offset: number) => {
            buffer[offset] = target.metaData.rotation;
        },
    };
}

function createScaleMixer(target: Object3D): IMixer {
    return {
        mix: lerp,
        mixAdditive: lerpAdditive,
        setIdentity,
        apply: (buffer: number[], offset: number) => {
            const s = target.scale;
            const x = buffer[offset];
            const y = buffer[offset + 1];
            const z = buffer[offset + 2];
            if (s.x === x && s.y === y && s.z === z) {
                return;
            }
            s.set(x, y, z);
        },
        back: (buffer: number[], offset: number) => {
            target.scale.toArray(buffer, offset);
        },
    };
}

function createUvScaleMixer(target: Material): IMixer {
    return {
        mix: lerp,
        mixAdditive: lerpAdditive,
        setIdentity,
        apply: (buffer: number[], offset: number) => {
            const s = target.metaData.scale;
            const x = buffer[offset];
            const y = buffer[offset + 1];
            if (s.x === x && s.y === y) {
                return;
            }
            s.set(x, y);
            target.metaData.uvTransformDirty = true;
        },
        back: (buffer: number[], offset: number) => {
            target.metaData.scale.toArray(buffer, offset);
        },
    };
}

function createTranslationMixer(target: Object3D): IMixer {
    return {
        mix: lerp,
        mixAdditive: lerpAdditive,
        setIdentity,
        apply: (buffer: number[], offset: number) => {
            const s = target.position;
            const x = buffer[offset];
            const y = buffer[offset + 1];
            const z = buffer[offset + 2];
            if (s.x === x && s.y === y && s.z === z) {
                return;
            }
            s.set(x, y, z);
        },
        back: (buffer: number[], offset: number) => {
            target.position.toArray(buffer, offset);
        },
    };
}

function createUvOffsetMixer(target: Material): IMixer {
    return {
        mix: lerp,
        mixAdditive: lerpAdditive,
        setIdentity,
        apply: (buffer: number[], offset: number) => {
            const s = target.metaData.position;
            const x = buffer[offset];
            const y = buffer[offset + 1];
            if (s.x === x && s.y === y) {
                return;
            }
            s.set(x, y);
            target.metaData.uvTransformDirty = true;
        },
        back: (buffer: number[], offset: number) => {
            target.metaData.position.toArray(buffer, offset);
        },
    };
}

export class PropertyMixer {
    readonly buffer: number[];

    private stride: number;
    private cumulativeWeight = 0;
    private cumulativeWeightAdditive = 0;
    private mixer: IMixer;

    constructor(target: Object3D | Material, property: TrackPath['propertyName'], stride: number) {
        switch (property) {
            case 'rotation':
                this.buffer = new Array<number>(stride * 6);
                this.mixer = createRotationMixer(target as Object3D);
                break;
            case 'scale':
                this.buffer = new Array<number>(stride * 5);
                this.mixer = createScaleMixer(target as Object3D);
                break;
            case 'translation':
                this.buffer = new Array<number>(stride * 5);
                this.mixer = createTranslationMixer(target as Object3D);
                break;
            case 'uvRotation':
                this.buffer = new Array<number>(stride * 5);
                this.mixer = createUvRotationMixer(target as Material);
                break;
            case 'uvScale':
                this.buffer = new Array<number>(stride * 5);
                this.mixer = createUvScaleMixer(target as Material);
                break;
            case 'uvOffset':
                this.buffer = new Array<number>(stride * 5);
                this.mixer = createUvOffsetMixer(target as Material);
                break;
        }

        this.stride = stride;

        // remember the state of the bound property and copy it to both accus
        const { buffer, mixer } = this;
        const offset = stride * ORIG_INDEX;
        mixer.back(buffer, offset);
        // accu[0..1] := orig -- initially detect changes against the original
        for (let i = stride; i < offset; i++) {
            buffer[i] = buffer[offset + (i % stride)];
        }
        // Add to identity for additive
        mixer.setIdentity(buffer, stride);
    }

    update(blend: Blend, weight: number, accuIndex: number) {
        const { stride, buffer, mixer } = this;

        if (blend === Blend.Additive) {
            const offset = stride * ADD_INDEX;
            if (this.cumulativeWeightAdditive === 0) {
                // add = identity
                mixer.setIdentity(buffer, stride);
            }
            // add := add + incoming * weight
            mixer.mixAdditive(buffer, offset, 0, weight, stride);
            this.cumulativeWeightAdditive += weight;
            return;
        }

        const offset = (accuIndex + 1) * stride;
        let currentWeight = this.cumulativeWeight;
        if (currentWeight === 0) {
            // accuN := incoming * weight
            for (let i = 0; i < stride; ++i) {
                buffer[offset + i] = buffer[i];
            }
            currentWeight = weight;
        } else {
            // accuN := accuN + incoming * weight
            currentWeight += weight;
            mixer.mix(buffer, offset, 0, weight / currentWeight, stride);
        }
        this.cumulativeWeight = currentWeight;
    }

    // apply the state of 'accu<i>' to the binding when accus differ
    apply(accuIndex: number) {
        const { buffer, stride, mixer, cumulativeWeight: weight, cumulativeWeightAdditive: weightAdditive } = this;
        this.cumulativeWeight = 0;
        this.cumulativeWeightAdditive = 0;
        const offset = (accuIndex + 1) * stride;
        if (weight < 1) {
            // accuN := accuN + original * ( 1 - cumulativeWeight )
            mixer.mix(buffer, offset, stride * ORIG_INDEX, 1 - weight, stride);
        }
        if (weightAdditive > 0) {
            // accuN := accuN + additive accuN
            mixer.mixAdditive(buffer, offset, ADD_INDEX * stride, 1, stride);
        }

        mixer.apply(buffer, offset);
    }
}
