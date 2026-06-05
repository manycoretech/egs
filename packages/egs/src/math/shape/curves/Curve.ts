import type { Vector } from '../../Vector';
import { Vector3 } from '../../Vector3';
import { Matrix4 } from '../../Matrix4';
import { _Math } from '../../Math';
import type { SerializerableDelegatedAsReference, Serializer, Deserializer } from '../../../utils/Serialization';
import { logger } from '../../../utils/Logger';
/**
 * An extensible curve object which contains methods for interpolation.
 */
export class Curve<T extends Vector> implements SerializerableDelegatedAsReference {
    /**
     * The type of this curve.
     */
    type: string;
    /**
     * Divide this curve into how many parts of segments
     */
    arcLengthDivisions: number;
    cacheArcLengths: number[];
    needsUpdate = false;

    private _uuid: string | null = null;
    get uuid() {
        if (this._uuid === null) {
            this._uuid = _Math.generateUUID();
        }
        return this._uuid;
    }
    set uuid(uuid) {
        this._uuid = uuid;
    }

    getUUID(): string {
        return this.uuid;
    }
    serialize(ctx: Serializer) {
        ctx.puts<Curve<any>>(['type', 'arcLengthDivisions']);
    }
    deserialize(ctx: Deserializer) {
        ctx.reads<Curve<any>>(['type', 'arcLengthDivisions']);
    }

    className(): string {
        return 'Curve';
    }

    constructor() {
        this.type = 'Curve';
        this.arcLengthDivisions = 200;
    }
    /**
     * Returns a vector for point t of the curve where t is between 0 and 1.
     */
    getPoint(_t: number, _optionalTarget?: T): T {
        logger.warn('EGS.Curve: .getPoint() not implemented.');
        return null as any;
    }
    /**
     * Returns a vector for point at relative position in curve according to arc length.
     */
    getPointAt(u: number, optionalTarget?: T): T {
        const t = this.getUtoTmapping(u);
        return this.getPoint(t, optionalTarget);
    }
    /**
     * Get sequence of points using getPoint(t).
     */
    getPoints(divisions?: number): T[] {
        if (divisions === undefined) {
            divisions = Curve.segmentsCount(this.getLength());
        }
        const points: T[] = [];
        for (let d = 0; d <= divisions; d++) {
            points.push(this.getPoint(d / divisions));
        }
        return points;
    }

    toArray(path: number[] = [], divisions?: number) {
        const points = this.getPoints(divisions);
        points.reduce((pv: number[], cv) => {
            cv.toArray(pv);
            return pv;
        }, path);
        return path;
    }
    /**
     * Get sequence of equi-spaced points using getPointAt(u)
     */
    getSpacedPoints(divisions?: number): T[] {
        if (divisions === undefined) {
            divisions = 5;
        }
        const points: T[] = [];
        for (let d = 0; d <= divisions; d++) {
            points.push(this.getPointAt(d / divisions));
        }
        return points;
    }
    /**
     * Get total curve arc length
     */
    getLength(): number {
        const lengths = this.getLengths();
        return lengths[lengths.length - 1];
    }
    /**
     * Get list of cumulative segment lengths
     */
    getLengths(divisions?: number): number[] {
        if (divisions === undefined) {
            divisions = this.arcLengthDivisions;
        }

        if (this.cacheArcLengths && this.cacheArcLengths.length === divisions + 1 && !this.needsUpdate) {
            return this.cacheArcLengths;
        }

        this.needsUpdate = false;
        const cache: number[] = [];
        let current;
        let last = this.getPoint(0);
        let sum = 0;
        cache.push(0);

        for (let p = 1; p <= divisions; p++) {
            current = this.getPoint(p / divisions);
            sum += current.distanceTo?.(last) ?? 0;
            cache.push(sum);
            last = current;
        }
        this.cacheArcLengths = cache;
        return cache; // { sums: cache, sum: sum }; Sum is in the last element.
    }
    /**
     * Update the cumulative segment distance cache
     */
    updateArcLengths(): void {
        this.needsUpdate = true;
        this.getLengths();
    }
    /**
     * Given u ( 0 .. 1 ), get a t to find p. This gives you points which are equi distance
     */
    getUtoTmapping(u: number, distance?: number): number {
        const arcLengths = this.getLengths();
        let i = 0;
        const il = arcLengths.length;
        let targetArcLength; // The targeted u distance value to get

        if (distance) {
            targetArcLength = distance;
        } else {
            targetArcLength = u * arcLengths[il - 1];
        }

        // binary search for the index with largest value smaller than target u distance
        let low = 0,
            high = il - 1,
            comparison;
        while (low <= high) {
            i = Math.floor(low + (high - low) / 2); // less likely to overflow, though probably not issue here, JS doesn't really have integers, all numbers are floats
            comparison = arcLengths[i] - targetArcLength;
            if (comparison < 0) {
                low = i + 1;
            } else if (comparison > 0) {
                high = i - 1;
            } else {
                high = i;
                break;
                // DONE
            }
        }
        i = high;
        if (arcLengths[i] === targetArcLength) {
            return i / (il - 1);
        }

        // we could get finer grain at lengths, or use simple interpolation between two points
        const lengthBefore = arcLengths[i];
        const lengthAfter = arcLengths[i + 1];
        const segmentLength = lengthAfter - lengthBefore;

        // determine where we are between the 'before' and 'after' points
        const segmentFraction = (targetArcLength - lengthBefore) / segmentLength;

        // add that fractional amount to t
        return (i + segmentFraction) / (il - 1);
    }
    /**
     * Returns a unit vector tangent at t. If the subclassed curve do not implement its tangent derivation,
     * 2 points a small delta apart will be used to find its gradient which seems to give a reasonable approximation
     */
    getTangent(t: number): T {
        const delta = 0.0001;
        let t1 = t - delta;
        let t2 = t + delta;

        // Capping in case of danger

        if (t1 < 0) {
            t1 = 0;
        }
        if (t2 > 1) {
            t2 = 1;
        }

        const pt1 = this.getPoint(t1);
        const pt2 = this.getPoint(t2);

        const vec = pt2.clone().sub(pt1);
        return vec.normalize() as any;
    }
    /**
     * Returns tangent at equidistance point u on the curve.
     */
    getTangentAt(u: number): T {
        const t = this.getUtoTmapping(u);
        return this.getTangent(t);
    }
    /**
     * @remarks see {@link http://www.cs.indiana.edu/pub/techreports/TR425.pdf | Frenet Frames}
     */
    computeFrenetFrames(segments: number, closed: boolean): any {
        const normal = new Vector3();
        const tangents: Vector3[] = [];
        const normals = [];
        const biNormals = [];

        const vec = new Vector3();
        const mat = new Matrix4();

        let i, u, theta;

        // compute the tangent vectors for each segment on the curve
        for (i = 0; i <= segments; i++) {
            u = i / segments;
            tangents[i] = this.getTangentAt(u) as any;
            tangents[i].normalize();
        }

        // select an initial normal vector perpendicular to the first tangent vector,
        // and in the direction of the minimum tangent xyz component
        normals[0] = new Vector3();
        biNormals[0] = new Vector3();
        let min = Number.MAX_VALUE;
        const tx = Math.abs(tangents[0].x);
        const ty = Math.abs(tangents[0].y);
        const tz = Math.abs(tangents[0].z);

        if (tx <= min) {
            min = tx;
            normal.set(1, 0, 0);
        }

        if (ty <= min) {
            min = ty;
            normal.set(0, 1, 0);
        }

        if (tz <= min) {
            normal.set(0, 0, 1);
        }

        vec.crossVectors(tangents[0], normal).normalize();
        normals[0].crossVectors(tangents[0], vec);
        biNormals[0].crossVectors(tangents[0], normals[0]);

        // compute the slowly-varying normal and bi-normal vectors for each segment on the curve
        for (i = 1; i <= segments; i++) {
            normals[i] = normals[i - 1].clone();
            biNormals[i] = biNormals[i - 1].clone();
            vec.crossVectors(tangents[i - 1], tangents[i]);
            if (vec.length() > Number.EPSILON) {
                vec.normalize();
                theta = Math.acos(_Math.clamp(tangents[i - 1].dot(tangents[i]), -1, 1)); // clamp for floating pt errors
                normals[i].applyMatrix4(mat.makeRotationAxis(vec, theta));
            }
            biNormals[i].crossVectors(tangents[i], normals[i]);
        }

        // if the curve is closed, post-process the vectors so the first and last normal vectors are the same
        if (closed === true) {
            theta = Math.acos(_Math.clamp(normals[0].dot(normals[segments]), -1, 1));
            theta /= segments;
            if (tangents[0].dot(vec.crossVectors(normals[0], normals[segments])) > 0) {
                theta = -theta;
            }
            for (i = 1; i <= segments; i++) {
                // twist a little...
                normals[i].applyMatrix4(mat.makeRotationAxis(tangents[i], theta * i));
                biNormals[i].crossVectors(tangents[i], normals[i]);
            }
        }
        return {
            tangents,
            normals,
            biNormals,
        };
    }

    clone() {
        return new Curve<T>().copy(this);
    }

    copy(source: Curve<T>) {
        this.arcLengthDivisions = source.arcLengthDivisions;
        return this;
    }

    toJSON(): any {
        const data = {
            metadata: {
                version: 4.5,
                type: 'Curve',
                generator: 'Curve.toJSON',
            },
        } as any;

        data.arcLengthDivisions = this.arcLengthDivisions;
        data.type = this.type;
        return data;
    }

    fromJSON(json: any): Curve<T> {
        this.arcLengthDivisions = json.arcLengthDivisions;
        return this;
    }

    static adaptive = true;
    static maxLength = 10;
    static minSegments = 8;
    static maxSegments = 2048;
    static epsilon = 0.0001;

    static segmentsCount(length: number, defaultSegments = 20) {
        if (!Curve.adaptive || !length || isNaN(length)) {
            return defaultSegments;
        }

        let result = Math.ceil(length / this.maxLength);

        if (result < Curve.minSegments) {
            result = Curve.minSegments;
        } else if (result > Curve.maxSegments) {
            result = Curve.maxSegments;
        }

        return result;
    }
}
