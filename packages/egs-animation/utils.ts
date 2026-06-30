import { Quaternion } from '@qunhe/egs';
import { type AnimationClip, Blend, InterpolationMode, type KeyframeTrack, type TypedArray } from './type.js';
import { LinearInterpolant } from './interpolants/LinearInterpolant.js';
import { DiscreteInterpolant } from './interpolants/DiscreteInterpolant.js';
import { CubicInterpolant } from './interpolants/CubicInterpolant.js';
import { QuaternionLinearInterpolant } from './interpolants/QuaternionLinearInterpolant.js';

const TrackPathReg = /^(?:([^[\]]+)\/)?([^[\]]+)?(?:\.([^[\].]+)(?:\[(.+)\])?)?\.([^[\].]+)(?:\[(.+)\])?$/;

const SupportedScopeNames = ['Materials'] as const;
const SupportedObjectNames = ['materials'] as const;
const SupportedPropertyNames = ['translation', 'rotation', 'scale', 'uvRotation', 'uvOffset', 'uvScale'] as const;

export interface TrackPath {
    scope?: (typeof SupportedScopeNames)[number];
    nodeName?: string;

    objectName?: (typeof SupportedObjectNames)[number];
    objectIndex?: string;

    propertyName: (typeof SupportedPropertyNames)[number];
    propertyIndex?: string;
}

/**
 * Matches strings in the following forms:
 *  -- <nodeName>.<property>
 *  -- <nodeName>.<property>[<accessor>]
 *  -- <nodeName>.<objectProperty>[<accessor>].<property>
 *  -- <nodeName>.<objectProperty>[<accessor>].<property>[<accessor>]
 *  -- <scope>/<nodeName>.<property>
 * -------------------------------------
 * <nodeName.property>: "7E5D79FF-BBFF-45AD-84E0-3E940E8AFB9B.quaternion" =>
 *  {
 *    nodeName : "7E5D79FF-BBFF-45AD-84E0-3E940E8AFB9B"
 *    objectName : undefined
 *    objectIndex : undefined
 *    propertyName : "quaternion"
 *    propertyIndex : undefined
 *  }
 */
export function parseTrackPath(path: string): TrackPath | undefined {
    const matches = TrackPathReg.exec(path);
    if (!matches) {
        throw new Error('EGS Animation: unsupported track path: ' + path);
    }

    const result: TrackPath = {
        scope: matches[1] as TrackPath['scope'],
        nodeName: matches[2],
        objectName: matches[3] as TrackPath['objectName'],
        objectIndex: matches[4],
        propertyName: matches[5] as TrackPath['propertyName'], // required
        propertyIndex: matches[6],
    };

    if (result.scope && !SupportedScopeNames.includes(result.scope)) {
        console.warn('EGS Animation: unsupported scope: ' + path);
        return undefined;
    }
    if (result.objectName) {
        console.warn('EGS Animation: unsupported objectName: ' + path);
        return undefined;
    }
    if (result.propertyName && !SupportedPropertyNames.includes(result.propertyName)) {
        console.warn('EGS Animation: unsupported propertyName: ' + path);
        return undefined;
    }
    if (result.propertyIndex) {
        console.warn('EGS Animation: unsupported propertyIndex: ' + path);
        return undefined;
    }

    return result;
}

type Interpolant =
    | typeof DiscreteInterpolant
    | typeof LinearInterpolant
    | typeof CubicInterpolant
    | typeof QuaternionLinearInterpolant;
export function createInterpolant(
    property: TrackPath['propertyName'],
    interpolation: InterpolationMode,
    times: TypedArray,
    values: TypedArray,
    result: any[],
    stride: number,
) {
    let InterpolantCtor: Interpolant;
    switch (interpolation) {
        case InterpolationMode.Linear:
            InterpolantCtor = LinearInterpolant;
            break;
        case InterpolationMode.Discrete:
            InterpolantCtor = DiscreteInterpolant;
            break;
        case InterpolationMode.Smooth:
            InterpolantCtor = CubicInterpolant;
            break;
    }
    switch (property) {
        case 'rotation': {
            switch (interpolation) {
                case InterpolationMode.Linear:
                    InterpolantCtor = QuaternionLinearInterpolant;
                    break;
                case InterpolationMode.Smooth:
                    InterpolantCtor = DiscreteInterpolant;
                    break;
            }
            break;
        }
    }

    const interpolant = new InterpolantCtor(times, values, stride, result);
    return interpolant;
}

export function makeClipAdditive(
    targetClip: AnimationClip,
    referenceFrame: number = 0,
    referenceClip: AnimationClip = targetClip,
    fps: number = 30,
) {
    if (fps <= 0) {
        fps = 30;
    }

    const numTracks = referenceClip.tracks.length;
    const referenceTime = referenceFrame / fps;

    // Make each track's values relative to the values at the reference frame
    for (let i = 0; i < numTracks; ++i) {
        const referenceTrack = referenceClip.tracks[i];

        // Find the track in the target clip whose name and type matches the reference track
        const targetTrack = targetClip.tracks.find(function (track: KeyframeTrack) {
            return track.path === referenceTrack.path;
        });

        if (targetTrack === undefined) {
            continue;
        }

        const referenceOffset = 0;
        const result = parseTrackPath(referenceClip.tracks[i].path);
        if (!result) {
            continue;
        }
        let referenceValueSize = 1;
        switch (result.propertyName) {
            case 'rotation':
                referenceValueSize = 4;
                break;
            case 'scale':
            case 'translation':
                referenceValueSize = 3;
                break;
            case 'uvOffset':
            case 'uvScale':
                referenceValueSize = 2;
                break;
            case 'uvRotation':
                referenceValueSize = 1;
                break;
        }

        const targetOffset = 0;
        const targetValueSize = referenceValueSize;

        const lastIndex = referenceTrack.times.length - 1;
        let referenceValue: TypedArray | undefined;

        // Find the value to subtract out of the track
        if (referenceTime <= referenceTrack.times[0]) {
            // Reference frame is earlier than the first keyframe, so just use the first keyframe
            const startIndex = referenceOffset;
            const endIndex = referenceValueSize - referenceOffset;
            referenceValue = referenceTrack.values.slice(startIndex, endIndex);
        } else if (referenceTime >= referenceTrack.times[lastIndex]) {
            // Reference frame is after the last keyframe, so just use the last keyframe
            const startIndex = lastIndex * referenceValueSize + referenceOffset;
            const endIndex = startIndex + referenceValueSize - referenceOffset;
            referenceValue = referenceTrack.values.slice(startIndex, endIndex);
        }
        // todo referenceTime is between start and end
        if (referenceValue === undefined) {
            console.log('EGS Animation: unsupported referenceTime.');
            continue;
        }

        // Conjugate the quaternion
        if (result.propertyName === 'rotation') {
            const referenceQuat = new Quaternion().fromArray(referenceValue).normalize().conjugate();
            referenceQuat.toArray(referenceValue as unknown as number[]);
        }

        // Subtract the reference value from all of the track values
        const numTimes = targetTrack.times.length;
        for (let j = 0; j < numTimes; ++j) {
            const valueStart = j * targetValueSize + targetOffset;
            if (result.propertyName === 'rotation') {
                // Multiply the conjugate for quaternion track types
                multiplyQuaternionsFlat(
                    targetTrack.values,
                    valueStart,
                    referenceValue,
                    0,
                    targetTrack.values,
                    valueStart,
                );
            } else {
                const valueEnd = targetValueSize - targetOffset * 2;
                // Subtract each value for all other numeric track types
                for (let k = 0; k < valueEnd; ++k) {
                    targetTrack.values[valueStart + k] -= referenceValue[k];
                }
            }
        }
    }
    targetClip.blend = Blend.Additive;
    return targetClip;
}

export function subClip(sourceClip: AnimationClip, startFrame: number, endFrame: number, fps = 30) {
    const clip = sourceClip;
    const tracks = [];

    for (let i = 0; i < clip.tracks.length; ++i) {
        const track = clip.tracks[i];
        const valueSize = getTrackValueSize(track.path);

        const times = [];
        const values = [];

        for (let j = 0; j < track.times.length; ++j) {
            const frame = track.times[j] * fps;

            if (frame < startFrame || frame >= endFrame) {
                continue;
            }

            times.push(track.times[j]);

            for (let k = 0; k < valueSize; ++k) {
                values.push(track.values[j * valueSize + k]);
            }
        }

        if (times.length === 0) {
            continue;
        }

        track.times = new (track.times.constructor as any)(times);
        track.values = new (track.times.constructor as any)(values);

        tracks.push(track);
    }

    clip.tracks = tracks;

    // find minimum .times value across all tracks in the trimmed clip
    let minStartTime = Infinity;

    for (let i = 0; i < clip.tracks.length; ++i) {
        if (minStartTime > clip.tracks[i].times[0]) {
            minStartTime = clip.tracks[i].times[0];
        }
    }

    // shift all tracks such that clip begins at t=0
    for (let i = 0; i < clip.tracks.length; ++i) {
        for (let j = 0; j < clip.tracks[i].times.length; ++j) {
            clip.tracks[i].times[i] -= minStartTime;
        }
    }
}

function getTrackValueSize(path: string): number {
    const result = parseTrackPath(path);

    let itemSize = 1;
    if (!result) {
        return itemSize;
    }
    switch (result.propertyName) {
        case 'rotation':
            itemSize = 4;
            break;
        case 'scale':
        case 'translation':
            itemSize = 3;
            break;
        case 'uvOffset':
        case 'uvScale':
            itemSize = 2;
            break;
        case 'uvRotation':
            itemSize = 1;
            break;
    }
    return itemSize;
}

export function multiplyQuaternionsFlat(
    dst: any,
    dstOffset: any,
    src0: any,
    srcOffset0: any,
    src1: any,
    srcOffset1: any,
) {
    const x0 = src0[srcOffset0];
    const y0 = src0[srcOffset0 + 1];
    const z0 = src0[srcOffset0 + 2];
    const w0 = src0[srcOffset0 + 3];

    const x1 = src1[srcOffset1];
    const y1 = src1[srcOffset1 + 1];
    const z1 = src1[srcOffset1 + 2];
    const w1 = src1[srcOffset1 + 3];

    dst[dstOffset] = x0 * w1 + w0 * x1 + y0 * z1 - z0 * y1;
    dst[dstOffset + 1] = y0 * w1 + w0 * y1 + z0 * x1 - x0 * z1;
    dst[dstOffset + 2] = z0 * w1 + w0 * z1 + x0 * y1 - y0 * x1;
    dst[dstOffset + 3] = w0 * w1 - x0 * x1 - y0 * y1 - z0 * z1;

    return dst;
}
