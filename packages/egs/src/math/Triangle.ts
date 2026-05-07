import { Vector3 } from './Vector3';
import { Vector2 } from './Vector2';
import { Box3 } from './Box3';
/**
 * A geometric triangle as defined by three {@link Vector3| Vector3} representing its three corners.
 */
export class Triangle {
    /**
     * The first corner of the triangle.
     * @defaultValue is (0, 0, 0).
     */
    public a: Vector3;
    /**
     * The second corner of the triangle.
     * @defaultValue is (0, 0, 0).
     */
    public b: Vector3;
    /**
     * The final corner of the triangle.
     * @defaultValue is (0, 0, 0).
     */
    public c: Vector3;

    constructor(a?: Vector3, b?: Vector3, c?: Vector3) {
        this.a = (a !== undefined) ? a : new Vector3();
        this.b = (b !== undefined) ? b : new Vector3();
        this.c = (c !== undefined) ? c : new Vector3();
    }
    /**
     * Calculate the {@link https://en.wikipedia.org/wiki/Normal_(geometry)| normal vector} of the triangle.
     */
    public static getNormal(a: Vector3, b: Vector3, c: Vector3, target: Vector3): Vector3 {
        target.subVectors(c, b);
        tmp1Vec3.subVectors(a, b);
        target.cross(tmp1Vec3);

        const targetLengthSq = target.lengthSq();
        if (targetLengthSq > 0) {
            return target.multiplyScalar(1 / Math.sqrt(targetLengthSq));
        }
        return target.set(0, 0, 0);
    }
    /**
     * Return a {@link https://en.wikipedia.org/wiki/Barycentric_coordinate_system| barycentric coordinate} from the given vector.
     */
    public static getBarycoord(point: Vector3, a: Vector3, b: Vector3, c: Vector3, target: Vector3): Vector3 {
        tmp1Vec3.subVectors(c, a);
        tmp2Vec3.subVectors(b, a);
        tmp3Vec3.subVectors(point, a);

        const dot00 = tmp1Vec3.dot(tmp1Vec3);
        const dot01 = tmp1Vec3.dot(tmp2Vec3);
        const dot02 = tmp1Vec3.dot(tmp3Vec3);
        const dot11 = tmp2Vec3.dot(tmp2Vec3);
        const dot12 = tmp2Vec3.dot(tmp3Vec3);
        const denom = (dot00 * dot11 - dot01 * dot01);

        // collinear or singular triangle
        if (denom === 0) {
            // arbitrary location outside of triangle?
            // not sure if this is the best idea, maybe should be returning undefined
            return target.set(- 2, - 1, - 1);
        }
        const invDenom = 1 / denom;
        const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
        const v = (dot00 * dot12 - dot01 * dot02) * invDenom;
        // barycentric coordinates must always sum to 1
        return target.set(1 - u - v, v, u);
    }
    /**
     * Returns true if the passed point, when projected onto the plane of the triangle, lies within the triangle.
     */
    public static containsPoint(point: Vector3, a: Vector3, b: Vector3, c: Vector3): boolean {
        Triangle.getBarycoord(point, a, b, c, tmp1Vec3);
        return (tmp1Vec3.x >= 0) && (tmp1Vec3.y >= 0) && ((tmp1Vec3.x + tmp1Vec3.y) <= 1);
    }
    /**
     * Calculate the uv value of given point by a,b,c and their uv.
     * @param target the result will be stored here.
     */
    public static getUV(point: Vector3, a: Vector3, b: Vector3, c: Vector3, uv1: Vector2, uv2: Vector2, uv3: Vector2, target: Vector2): Vector2 {
        this.getBarycoord(point, a, b, c, tmp1Vec3);
        target.set(0, 0);
        target.addScaledVector(uv1, tmp1Vec3.x);
        target.addScaledVector(uv2, tmp1Vec3.y);
        target.addScaledVector(uv3, tmp1Vec3.z);
        return target;
    }
    /**
     * Sets the triangle's {@link a| a}, {@link b| b} and {@link c| c} properties to the passed {@link Vector3| vector3}.<br>
     * Please note that this method only copies the values from the given objects.
     */
    public set(a: Vector3, b: Vector3, c: Vector3): Triangle {
        this.a.copy(a);
        this.b.copy(b);
        this.c.copy(c);
        return this;
    }
    /**
     * Sets the triangle's vectors to the vectors in the array.
     * @param points array of {@link Vector3| Vector3}.
     * @param i0 {@link Integer| Integer} index.
     * @param i1 {@link Integer| Integer} index.
     * @param i2 {@link Integer| Integer} index.
     */
    public setFromPointsAndIndices(points: Vector3[], i0: number, i1: number, i2: number): Triangle {
        this.a.copy(points[i0]);
        this.b.copy(points[i1]);
        this.c.copy(points[i2]);
        return this;
    }
    /**
     * Returns a new triangle with the same {@link a| a}, {@link b| b} and  {@link c| c} properties as this one.
     */
    public clone(): Triangle {
        return new Triangle().copy(this);
    }
    /**
     * Copies the values of the passed triangle's {@link a| a}, {@link b| b} and {@link c| c} properties to this triangle.
     */
    public copy(triangle: Triangle): Triangle {
        this.a.copy(triangle.a);
        this.b.copy(triangle.b);
        this.c.copy(triangle.c);
        return this;
    }
    /**
     * Return the area of the triangle.
     */
    public getArea(): number {
        tmp1Vec3.subVectors(this.c, this.b);
        tmp2Vec3.subVectors(this.a, this.b);
        return tmp1Vec3.cross(tmp2Vec3).length() * 0.5;
    }
    /**
     * Calculate the midpoint of the triangle.
     * @param target the result will be copied into this Vector3.
     */
    public getMidpoint(target: Vector3): Vector3 {
        return target.addVectors(this.a, this.b).add(this.c).multiplyScalar(1 / 3);
    }
    /**
     * Calculate the {@link https://en.wikipedia.org/wiki/Normal_(geometry)| normal vector } of the triangle.
     * @param target the result will be copied into this Vector3.
     */
    public getNormal(target: Vector3): Vector3 {
        return Triangle.getNormal(this.a, this.b, this.c, target);
    }
    /**
     * Use this triangle to calculate {@link Triangle.getBarycoord| barycentric coordinate}.
     */
    public getBarycoord(point: Vector3, target: Vector3): Vector3 {
        return Triangle.getBarycoord(point, this.a, this.b, this.c, target);
    }
    /**
     * Returns true if the passed point, when projected onto the plane of the triangle, lies within the triangle.
     * @param point {@link Vector3| Vector3} to check.
     */
    public containsPoint(point: Vector3): boolean {
        return Triangle.containsPoint(point, this.a, this.b, this.c);
    }
    /**
     * Use this triangle to calculate {@link Triangle.getUV| UV }.
     */
    public getUV(point: Vector3, uv1: Vector2, uv2: Vector2, uv3: Vector2, result: Vector2): Vector2 {
        return Triangle.getUV(point, this.a, this.b, this.c, uv1, uv2, uv3, result);
    }
    /**
     * Determines whether or not this triangle intersects {@link Box3| box}.
     * @param box Box to check for intersection against.
     */
    public intersectsBox(box: Box3): boolean {
        return box.intersectsTriangle(this);
    }
    /**
     * Returns true if the two triangles have identical {@link a| a}, {@link b| b} and {@link c| c} properties.
     */
    public equals(triangle: Triangle): boolean {
        return triangle.a.equals(this.a) && triangle.b.equals(this.b) && triangle.c.equals(this.c);
    }
    /**
     * Returns the closest point on the triangle to {@link Vector3| point}.
     */
    public closestPointToPoint(p: Vector3, target: Vector3): Vector3 {
        const a = this.a;
        const b = this.b;
        const c = this.c;
        let v;
        let w;

        // algorithm thanks to Real-Time Collision Detection by Christer Ericson,
        // published by Morgan Kaufmann Publishers, (c) 2005 Elsevier Inc.,
        // under the accompanying license; see chapter 5.1.5 for detailed explanation.
        // basically, we're distinguishing which of the voronoi regions of the triangle
        // the point lies in with the minimum amount of redundant computation.

        tmp1Vec3.subVectors(b, a);
        tmp2Vec3.subVectors(c, a);
        tmp4Vec3.subVectors(p, a);
        const d1 = tmp1Vec3.dot(tmp4Vec3);
        const d2 = tmp2Vec3.dot(tmp4Vec3);
        if (d1 <= 0 && d2 <= 0) {
            // vertex region of A; barycentric coords (1, 0, 0)
            return target.copy(a);
        }

        tmp5Vec3.subVectors(p, b);
        const d3 = tmp1Vec3.dot(tmp5Vec3);
        const d4 = tmp2Vec3.dot(tmp5Vec3);
        if (d3 >= 0 && d4 <= d3) {
            // vertex region of B; barycentric coords (0, 1, 0)
            return target.copy(b);
        }

        const vc = d1 * d4 - d3 * d2;
        if (vc <= 0 && d1 >= 0 && d3 <= 0) {
            v = d1 / (d1 - d3);
            // edge region of AB; barycentric coords (1-v, v, 0)
            return target.copy(a).addScaledVector(tmp1Vec3, v);
        }

        tmp6Vec3.subVectors(p, c);
        const d5 = tmp1Vec3.dot(tmp6Vec3);
        const d6 = tmp2Vec3.dot(tmp6Vec3);
        if (d6 >= 0 && d5 <= d6) {
            // vertex region of C; barycentric coords (0, 0, 1)
            return target.copy(c);
        }

        const vb = d5 * d2 - d1 * d6;
        if (vb <= 0 && d2 >= 0 && d6 <= 0) {
            w = d2 / (d2 - d6);
            // edge region of AC; barycentric coords (1-w, 0, w)
            return target.copy(a).addScaledVector(tmp2Vec3, w);
        }

        const va = d3 * d6 - d5 * d4;
        if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
            tmp3Vec3.subVectors(c, b);
            w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
            // edge region of BC; barycentric coords (0, 1-w, w)
            return target.copy(b).addScaledVector(tmp3Vec3, w); // edge region of BC
        }

        // face region
        const denom = 1 / (va + vb + vc);
        // u = va * denom
        v = vb * denom;
        w = vc * denom;
        return target.copy(a).addScaledVector(tmp1Vec3, v).addScaledVector(tmp2Vec3, w);
    }
}
const tmp1Vec3 = new Vector3();
const tmp2Vec3 = new Vector3();
const tmp3Vec3 = new Vector3();
const tmp4Vec3 = new Vector3();
const tmp5Vec3 = new Vector3();
const tmp6Vec3 = new Vector3();
