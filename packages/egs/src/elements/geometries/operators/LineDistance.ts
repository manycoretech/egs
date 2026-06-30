import { logger } from '../../../utils/Logger.js';
import type { BufferGeometry, LineList, LineStrip } from '../containers/BufferGeometry.js';
import { Vector3 } from '../../../math/Vector3.js';
import { BufferAttribute } from '../../attributes/BufferAttribute.js';
import type { FatLineBufferGeometry } from '../../../elements/geometries/containers/FatLineBufferGeometry.js';
import { InstancedBufferAttribute } from '../../../elements/attributes/InstancedBufferAttribute.js';

const start = new Vector3();
const end = new Vector3();

/**
 * Computes the distance between two vertexes, store to new {@link attributes| attributes} lineDistance.
 * The distance is used to determine the length of line, this is necessary for drawing segmented line.
 */
export function computeLineDistances(geometry: BufferGeometry<LineList | LineStrip>): void {
    // we assume non-indexed geometry
    if (geometry.index === null) {
        const positionAttribute = geometry.getAttribute('position');
        if (positionAttribute !== undefined) {
            const lineDistances = [0];
            for (let i = 1, l = positionAttribute.count; i < l; i++) {
                start.fromBufferAttribute(positionAttribute, i - 1);
                end.fromBufferAttribute(positionAttribute, i);
                lineDistances[i] = lineDistances[i - 1];
                lineDistances[i] += start.distanceTo(end);
            }
            geometry.addAttribute('lineDistance', new BufferAttribute(new Float32Array(lineDistances), 1));
        }
    } else {
        logger.invalidInput(
            'EGS.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.',
        );
    }
}

export function computeLineDistancesForFatline(geometry: FatLineBufferGeometry) {
    computeLineDistances(geometry.fallback);

    const instanceStart = geometry.instanceStart!;
    const instanceEnd = geometry.instanceEnd!;
    const lineDistanceStart = new Float32Array(instanceStart.count);
    const lineDistanceEnd = new Float32Array(instanceStart.count);
    for (let i = 0; i < instanceStart.count; i++) {
        start.fromBufferAttribute(instanceStart, i);
        end.fromBufferAttribute(instanceEnd, i);
        lineDistanceStart[i] = i === 0 ? 0 : lineDistanceEnd[i - 1];
        lineDistanceEnd[i] = lineDistanceStart[i] + start.distanceTo(end);
    }

    geometry.addAttribute('instanceDistanceStart', new InstancedBufferAttribute(lineDistanceStart, 1));
    geometry.addAttribute('instanceDistanceEnd', new InstancedBufferAttribute(lineDistanceEnd, 1));
}
