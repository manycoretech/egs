import { Vector3 } from './Vector3';
import { Sphere } from './Sphere';
import { Matrix4 } from './Matrix4';
import { Triangle } from './Triangle';
import { Plane } from './Plane';
import { BufferAttribute } from '../elements/attributes/BufferAttribute';
import { Box2 } from './Box2';
import { Object3D } from '../scene/Object3D';
import { TypeAssert } from '../scene/tools/TypeAssert';

/**
 * A 3D box represents by {@link min| min} and {@link max| max}.
 */
export class Box3 {
    /**
     * {@link Vector3| Vector3} representing the lower (x, y, z) boundary of the box.
     * @defaultValue ( + Infinity, + Infinity, + Infinity ).
     */
    min: Vector3;
    /**
     * {@link Vector3| Vector3} representing the upper (x, y, z) boundary of the box.
     * @defaultValue ( - Infinity, - Infinity, - Infinity ).
     */
    max: Vector3;
    /**
     * An array of {@link Plane| Planes} represents the six faces of the box.
     */
    planes: Plane[];
    /**
     * The position of eight box's vertexes.
     */
    corners: Vector3[];
    /**
     * Check the type whether it belongs to Box3.
     * This value should not be changed by user.
     */
    isBox3 = true;

    constructor(min?: Vector3, max?: Vector3) {
        this.min = min ?? new Vector3(+ Infinity, + Infinity, + Infinity);
        this.max = max ?? new Vector3(- Infinity, - Infinity, - Infinity);
        this.planes = [
            new Plane(new Vector3(-1, 0, 0), this.min.x),
            new Plane(new Vector3(0, -1, 0), this.min.y),
            new Plane(new Vector3(0, 0, -1), this.min.z),
            new Plane(new Vector3(1, 0, 0), -this.max.x),
            new Plane(new Vector3(0, 1, 0), -this.max.y),
            new Plane(new Vector3(0, 0, 1), -this.max.z),
        ];
        this.corners = [
            new Vector3(this.min.x, this.min.y, this.min.z),
            new Vector3(this.max.x, this.min.y, this.min.z),
            new Vector3(this.max.x, this.max.y, this.min.z),
            new Vector3(this.min.x, this.max.y, this.min.z),
            new Vector3(this.min.x, this.min.y, this.max.z),
            new Vector3(this.max.x, this.min.y, this.max.z),
            new Vector3(this.max.x, this.max.y, this.max.z),
            new Vector3(this.min.x, this.max.y, this.max.z),
        ];
    }
    /**
     * Sets the lower and upper (x, y, z) boundaries of this box.<br>
     * Please note that this method only copies the values from the given objects.
     * @param min {@link Vector3| Vector3} representing the lower (x, y, z) boundary of the box.
     * @param max {@link Vector3| Vector3} representing the lower upper (x, y, z) boundary of the box.
     */
    set(min: Vector3, max: Vector3): Box3 {
        this.min.copy(min);
        this.max.copy(max);
        return this;
    }
    /**
     * Sets the upper and lower bounds of this box to include all of the data in `array`.
     * @param array An array of position data that the resulting box will envelop.
     */
    setFromArray(array: ArrayLike<number>): Box3 {
        let minX = +Infinity;
        let minY = +Infinity;
        let minZ = +Infinity;

        let maxX = -Infinity;
        let maxY = -Infinity;
        let maxZ = -Infinity;

        for (let i = 0, l = array.length; i < l; i += 3) {
            const x = array[i];
            const y = array[i + 1];
            const z = array[i + 2];
            if (x < minX) {
                minX = x;
            }
            if (y < minY) {
                minY = y;
            }
            if (z < minZ) {
                minZ = z;
            }
            if (x > maxX) {
                maxX = x;
            }
            if (y > maxY) {
                maxY = y;
            }
            if (z > maxZ) {
                maxZ = z;
            }
        }
        this.min.set(minX, minY, minZ);
        this.max.set(maxX, maxY, maxZ);
        return this;
    }
    /**
     * Sets the upper and lower bounds of this box to include all of the data in {@link BufferAttribute| attribute}.
     * @param attribute A buffer attribute of position data that the resulting box will envelop.
     */
    setFromBufferAttribute(attribute: BufferAttribute): Box3 {
        let minX = +Infinity;
        let minY = +Infinity;
        let minZ = +Infinity;

        let maxX = -Infinity;
        let maxY = -Infinity;
        let maxZ = -Infinity;
        const array = attribute.array;
        const itemSize = attribute.itemSize;
        const count = attribute.count;

        let x: number;
        let y: number;
        let z: number;
        for (let i = 0; i < count; i++) {
            x = array[i * itemSize];
            y = array[i * itemSize + 1];
            z = array[i * itemSize + 2];

            if (x < minX) {
                minX = x;
            }
            if (y < minY) {
                minY = y;
            }
            if (z < minZ) {
                minZ = z;
            }
            if (x > maxX) {
                maxX = x;
            }
            if (y > maxY) {
                maxY = y;
            }
            if (z > maxZ) {
                maxZ = z;
            }
        }
        this.min.set(minX, minY, minZ);
        this.max.set(maxX, maxY, maxZ);
        return this;
    }
    /**
     * Sets the upper and lower bounds of this box by a part of attributes.
     * @param attribute A buffer attribute of position data that the resulting box will envelop.
     * @param start The start attributes of range.
     * @param count The count of attributes in range.
     */
    setFromBufferAttributeRange(attribute: BufferAttribute, start: number, count: number): Box3 {
        let minX = +Infinity;
        let minY = +Infinity;
        let minZ = +Infinity;

        let maxX = -Infinity;
        let maxY = -Infinity;
        let maxZ = -Infinity;

        for (let i = start, l = start + count; i < l; i++) {
            const x = attribute.getX(i);
            const y = attribute.getY(i);
            const z = attribute.getZ(i);
            if (x < minX) {
                minX = x;
            }
            if (y < minY) {
                minY = y;
            }
            if (z < minZ) {
                minZ = z;
            }
            if (x > maxX) {
                maxX = x;
            }
            if (y > maxY) {
                maxY = y;
            }
            if (z > maxZ) {
                maxZ = z;
            }
        }
        this.min.set(minX, minY, minZ);
        this.max.set(maxX, maxY, maxZ);
        return this;
    }
    /**
     * Sets the upper and lower bounds of this box by a part of vertexes' index.
     * @param positionAttribute A buffer of vertex data.
     * @param indexAttribute A buffer of vertex' index.
     * @param start The start indexes of range.
     * @param count The count of indexes in range.
     */
    setFromIndexBufferAttributeRange(positionAttribute: BufferAttribute, indexAttribute: BufferAttribute, start: number, count: number): Box3 {
        let minX = +Infinity;
        let minY = +Infinity;
        let minZ = +Infinity;

        let maxX = -Infinity;
        let maxY = -Infinity;
        let maxZ = -Infinity;

        for (let i = start, l = start + count; i < l; i++) {
            const p = indexAttribute.array[i];
            const x = positionAttribute.getX(p);
            const y = positionAttribute.getY(p);
            const z = positionAttribute.getZ(p);
            if (x < minX) {
                minX = x;
            }
            if (y < minY) {
                minY = y;
            }
            if (z < minZ) {
                minZ = z;
            }
            if (x > maxX) {
                maxX = x;
            }
            if (y > maxY) {
                maxY = y;
            }
            if (z > maxZ) {
                maxZ = z;
            }
        }

        this.min.set(minX, minY, minZ);
        this.max.set(maxX, maxY, maxZ);
        return this;
    }
    /**
     * Sets the upper and lower bounds of this box to include all of the points in {@link Array| points}.
     * @param points Array of {@link Vector3| Vector3s} that the resulting box will contain.
     */
    setFromPoints(_points: Vector3[]): Box3 {
        this.makeEmpty();
        for (let i = 0, il = _points.length; i < il; i++) {
            this.expandByPoint(_points[i]);
        }
        return this;
    }
    /**
     * Centers this box on {@link Vector3| center} and sets this box's width, height and depth to the values specified in {@link Vector3| size}.
     * @param center Desired center position of the box.
     * @param size Desired x, y and z dimensions of the box.
     */
    setFromCenterAndSize(_center: Vector3, size: Vector3): Box3 {
        const halfSize = tmpVec3.copy(size).multiplyScalar(0.5);
        this.min.copy(_center).sub(halfSize);
        this.max.copy(_center).add(halfSize);
        return this;
    }
    /**
     * Computes the world-axis-aligned bounding box of an {@link Object3D| Object3D} (including its children),
     * accounting for the object's, and children's, world transforms.
     * The function may result in a larger box than strictly necessary.
     * @param object {@link Object3D| Object3D} to compute the bounding box of.
     */
    setFromObject(object: Object3D): Box3 {
        this.makeEmpty();
        return this.expandByObject(object);
    }
    /**
     * Returns a new {@link Box3| Box3} with the same {@link min| min} and {@link max| max} as this clone.
     */
    clone(): Box3 {
        return new Box3().copy(this);
    }
    /**
     * Copies the {@link min| min} and {@link max| max} from {@link Box3| box} to this box.
     * @param box {@link Box3| Box3} to copy.
     */
    copy(box: Box3): Box3 {
        this.min.copy(box.min);
        this.max.copy(box.max);
        return this;
    }
    /**
     * Makes this box empty.
     */
    makeEmpty(): Box3 {
        this.min.x = this.min.y = this.min.z = + Infinity;
        this.max.x = this.max.y = this.max.z = - Infinity;
        return this;
    }
    /**
     * Returns true if this box includes zero points within its bounds.
     * Note that a box with equal lower and upper bounds still includes one point, the one both bounds share.
     */
    isEmpty(): boolean {
        // this is a more robust check for empty than ( volume <= 0 ) because volume can get positive with two negative axes
        return (this.max.x < this.min.x) || (this.max.y < this.min.y) || (this.max.z < this.min.z);
    }
    /**
     * Returns the center point of the box as a {@link Vector3| Vector3}.
     * @param target the result will be copied into this Vector3.
     */
    getCenter(target: Vector3): Vector3 {
        return this.isEmpty() ? target.set(0, 0, 0) : target.addVectors(this.min, this.max).multiplyScalar(0.5);
    }
    /**
     * Returns the center point of the box as a {@link Vector3| Vector3}.
     * this method returns the center whatever the values of box' {@link min| min} is over than {@link max| max}.
     * @param target the result will be copied into this Vector3.
     */
    getCenterUnsafe(target: Vector3) {
        target.addVectors(this.min, this.max).multiplyScalar(0.5);
    }
    /**
     * Returns the width, height and depth of this box.
     * @param target the result will be copied into this Vector3.
     */
    getSize(target?: Vector3): Vector3 {
        if (target === undefined) {
            target = new Vector3();
        }
        return this.isEmpty() ? target.set(0, 0, 0) : target.subVectors(this.max, this.min);
    }
    /**
     * Return the position of eight box's vertexes.
     */
    getCorners() {
        this.corners[0].set(this.min.x, this.min.y, this.min.z);
        this.corners[1].set(this.max.x, this.min.y, this.min.z);
        this.corners[2].set(this.max.x, this.max.y, this.min.z);
        this.corners[3].set(this.min.x, this.max.y, this.min.z);
        this.corners[4].set(this.min.x, this.min.y, this.max.z);
        this.corners[5].set(this.max.x, this.min.y, this.max.z);
        this.corners[6].set(this.max.x, this.max.y, this.max.z);
        this.corners[7].set(this.min.x, this.max.y, this.max.z);
        return this.corners;
    }
    /**
     * Return an array of planes of eight box's surface.
     */
    getPlanes() {
        this.planes[0].constant = this.min.x;
        this.planes[1].constant = this.min.y;
        this.planes[2].constant = this.min.z;
        this.planes[3].constant = -this.max.x;
        this.planes[4].constant = -this.max.y;
        this.planes[5].constant = -this.max.z;
        return this.planes;
    }
    /**
     * Expands the boundaries of this box to include {@link Vector3| point}.
     * @param point {@link Vector3| Vector3} that should be included in the box.
     */
    expandByPoint(point: Vector3): Box3 {
        this.min.min(point);
        this.max.max(point);
        return this;
    }
    /**
     * Expands this box equilaterally by {@link Vector3| vector}. The width of this box will be
     * expanded by the x component of {@link Vector3| vector} in both directions. The height of
     * this box will be expanded by the y component of {@link Vector3| vector} in both directions.
     * The depth of this box will be expanded by the z component of *vector* in both directions.
     * @param vector {@link Vector3| Vector3} to expand the box by.
     */
    expandByVector(vector: Vector3): Box3 {
        this.min.sub(vector);
        this.max.add(vector);
        return this;
    }
    /**
     * Expands each dimension of the box by scalar.
     * If negative, the dimensions of the box will be contracted.
     * @param scalar Distance to expand the box by.
     */
    expandByScalar(scalar: number): Box3 {
        this.min.addScalar(-scalar);
        this.max.addScalar(scalar);
        return this;
    }
    /**
     * Expands the boundaries of this box to include {@link Object3D| object} and its children,
     * accounting for the object's, and children's, world transforms.
     * The function may result in a larger box than strictly necessary.
     * @param object {@link Object3D| Object3D} to expand the box by.
     */
    expandByObject(object: Object3D): Box3 {
        // Computes the world-axis-aligned bounding box of an object (including its children),
        // accounting for both the object's, and children's, world transforms
        object.updateMatrixWorld(true);
        object.traverse(o => {
            if (!TypeAssert.isDrawable(o)) {
                return;
            }
            const geometry = o.geometry;
            const matrixList: Matrix4[] = [];
            if (TypeAssert.isInstanceMesh(o)) {
                const nodeMatrixWorld = o.matrixWorld;
                const proxyList = o.proxyedMeshes;
                for (let i = 0, l = proxyList.length; i < l; i++) {
                    matrixList.push(nodeMatrixWorld.clone().multiply(proxyList[i].matrixWorld));
                }
            } else {
                matrixList.push(o.matrixWorld);
            }
            if (TypeAssert.isGeometry(geometry)) {
                const vertices = geometry.vertices;
                for (let i = 0, l = vertices.length; i < l; i++) {
                    for (let j = 0; j < matrixList.length; j++) {
                        tmpVec3.copy(vertices[i]).applyMatrix4(matrixList[j]);
                        this.expandByPoint(tmpVec3);
                    }
                }
            } else if (TypeAssert.isBufferGeometry(geometry)) {
                const positions = geometry.getAttribute('position');
                if (!positions) {
                    return;
                }
                const positionArray = positions.array;
                for (let i = 0, l = positions.count; i < l; i++) {
                    for (let j = 0; j < matrixList.length; j++) {
                        tmpVec3.fromArray(positionArray, i * positions.itemSize).applyMatrix4(matrixList[j]);
                        this.expandByPoint(tmpVec3);
                    }
                }
            }
        });
        return this;
    }

    private _satForAxes(axes: number[]): boolean {
        let i, j;
        for (i = 0, j = axes.length - 3; i <= j; i += 3) {
            testAxis.fromArray(axes, i);
            // project the aabb onto the separating axis
            const r = extents.x * Math.abs(testAxis.x) + extents.y * Math.abs(testAxis.y) + extents.z * Math.abs(testAxis.z);
            // project all 3 vertices of the triangle onto the separating axis
            const p0 = v0.dot(testAxis);
            const p1 = v1.dot(testAxis);
            const p2 = v2.dot(testAxis);
            // actual test, basically see if either of the most extreme of the triangle points intersects r
            if (Math.max(- Math.max(p0, p1, p2), Math.min(p0, p1, p2)) > r) {
                // points of the projected triangle are outside the projected half-length of the aabb
                // the axis is separating and we can exit
                return false;
            }
        }
        return true;
    }
    /**
     * @param triangle {@link Triangle| Triangle} to check for intersection against.
     * Determines whether or not this box intersects {@link Triangle| triangle}.
     */
    intersectsTriangle(triangle: Triangle): boolean {
        if (this.isEmpty()) {
            return false;
        }

        // compute box center and extents
        this.getCenter(center);
        extents.subVectors(this.max, center);

        // translate triangle to aabb origin
        v0.subVectors(triangle.a, center);
        v1.subVectors(triangle.b, center);
        v2.subVectors(triangle.c, center);

        // compute edge vectors for triangle
        f0.subVectors(v1, v0);
        f1.subVectors(v2, v1);
        f2.subVectors(v0, v2);

        // test against axes that are given by cross product combinations of the edges of the triangle and the edges of the aabb
        // make an axis testing of each of the 3 sides of the aabb against each of the 3 sides of the triangle = 9 axis of separation
        // axis_ij = u_i x f_j (u0, u1, u2 = face normals of aabb = x,y,z axes vectors since aabb is axis aligned)
        let axes = [
            0, - f0.z, f0.y, 0, - f1.z, f1.y, 0, - f2.z, f2.y,
            f0.z, 0, - f0.x, f1.z, 0, - f1.x, f2.z, 0, - f2.x,
            - f0.y, f0.x, 0, - f1.y, f1.x, 0, - f2.y, f2.x, 0
        ];
        if (!this._satForAxes(axes)) {
            return false;
        }

        // test 3 face normals from the aabb
        axes = [1, 0, 0, 0, 1, 0, 0, 0, 1];
        if (!this._satForAxes(axes)) {
            return false;
        }

        // finally testing the face normal of the triangle
        // use already existing triangle edge vectors here
        triangleNormal.crossVectors(f0, f1);
        axes = [triangleNormal.x, triangleNormal.y, triangleNormal.z];
        return this._satForAxes(axes);
    }
    /**
     * Return true if the specified {@link Vector3| point} lies within or on the boundaries of this box.
     * @param point {@link Vector3| Vector3} to check for inclusion.
     */
    containsPoint(point: Vector3): boolean {
        return point.x < this.min.x || point.x > this.max.x ||
            point.y < this.min.y || point.y > this.max.y ||
            point.z < this.min.z || point.z > this.max.z ? false : true;
    }
    /**
     * Return true if this box includes the entirety of {@link Box3| box}. If this and {@link Box3| box} are identical, this function also returns true.
     * @param box {@link Box3| Box3} to test for inclusion.
     */
    containsBox(box: Box3): boolean {
        return this.min.x <= box.min.x && box.max.x <= this.max.x &&
            this.min.y <= box.min.y && box.max.y <= this.max.y &&
            this.min.z <= box.min.z && box.max.z <= this.max.z;
    }
    /**
     * Return a point as a proportion of this box's width and height.
     * @param point {@link Vector3| Vector3}.
     * @param target the result will be copied into this Vector3.
     */
    getParameter(point: Vector3, target: Vector3): Vector3 {
        return target.set(
            (point.x - this.min.x) / (this.max.x - this.min.x),
            (point.y - this.min.y) / (this.max.y - this.min.y),
            (point.z - this.min.z) / (this.max.z - this.min.z)
        );
    }
    /**
     * {@link Box3| box} Box to check for intersection against.
     * Determines whether or not this box intersects {@link Box3| box}.
     */
    intersectsBox(box: Box3): boolean {
        // using 6 splitting planes to rule out intersections.
        return box.max.x < this.min.x || box.min.x > this.max.x ||
            box.max.y < this.min.y || box.min.y > this.max.y ||
            box.max.z < this.min.z || box.min.z > this.max.z ? false : true;
    }
    /**
     * Determines whether or not this box intersects {@link Sphere| sphere}.
     * @param sphere {@link Sphere| Sphere} to check for intersection against.
     */
    intersectsSphere(sphere: Sphere): boolean {
        // Find the point on the AABB closest to the sphere center.
        this.clampPoint(sphere.center, tmpVec3);

        // If that point is inside the sphere, the AABB and sphere intersect.
        return tmpVec3.distanceToSquared(sphere.center) <= (sphere.radius * sphere.radius);
    }
    /**
     * Determines whether or not this box intersects {@link Plane| plane}.
     * @param plane {@link Plane| Plane} to check for intersection against.
     */
    intersectsPlane(plane: Plane): boolean {
        // We compute the minimum and maximum dot product values. If those values
        // are on the same side (back or front) of the plane, then there is no intersection.
        let min, max;
        if (plane.normal.x > 0) {
            min = plane.normal.x * this.min.x;
            max = plane.normal.x * this.max.x;
        } else {
            min = plane.normal.x * this.max.x;
            max = plane.normal.x * this.min.x;
        }

        if (plane.normal.y > 0) {
            min += plane.normal.y * this.min.y;
            max += plane.normal.y * this.max.y;
        } else {
            min += plane.normal.y * this.max.y;
            max += plane.normal.y * this.min.y;
        }

        if (plane.normal.z > 0) {
            min += plane.normal.z * this.min.z;
            max += plane.normal.z * this.max.z;
        } else {
            min += plane.normal.z * this.max.z;
            max += plane.normal.z * this.min.z;
        }
        return (min <= - plane.constant && max >= - plane.constant);
    }
    /**
     * {@link https://en.wikipedia.org/wiki/Clamping_(graphics)| Clamps} the {@link Vector3| point} within the bounds of this box.
     * @param point {@link Vector3| Vector3} to clamp.
     * @param target the result will be copied into this Vector3.
     */
    clampPoint(point: Vector3, target: Vector3): Vector3 {
        return target.copy(point).clamp(this.min, this.max);
    }
    /**
     * If the {@link Vector3| point} lies inside of this box, the distance will be 0.
     * @param point {@link Vector3| Vector3} to measure distance to.
     * @return the distance from any edge of this box to the specified point.
     */
    distanceToPoint(point: Vector3): number {
        const clampedPoint = tmpVec3.copy(point).clamp(this.min, this.max);
        return clampedPoint.sub(point).length();
    }
    /**
     * Gets a {@link Sphere| Sphere} that bounds the box.
     * @param target the result will be copied into this Sphere.
     */
    getBoundingSphere(target: Sphere): Sphere {
        this.getCenter(target.center);
        target.radius = this.getSize(tmpVec3).length() * 0.5;
        return target;
    }
    /**
     * Computes the intersection of this and {@link Box3| box}, setting the upper bound of this box to the lesser
     * of the two boxes' upper bounds and the lower bound of this box to the greater of the two boxes'
     * lower bounds. If there's no overlap, makes this box empty.
     * @param Box to intersect with.
     */
    intersect(box: Box3): Box3 {
        this.min.max(box.min);
        this.max.min(box.max);
        // ensure that if there is no overlap, the result is fully empty, not slightly empty with non-inf/+inf
        // values that will cause subsequence intersects to erroneously return valid values.
        if (this.isEmpty()) {
            this.makeEmpty();
        }
        return this;
    }
    /**
     * Computes the union of this box and {@link Box3| box}, setting the upper bound of this box to the greater of the
     * two boxes' upper bounds and the lower bound of this box to the lesser of the two boxes' lower bounds.
     * @param box Box that will be unioned with this box.
     */
    union(box: Box3): Box3 {
        this.min.min(box.min);
        this.max.max(box.max);
        return this;
    }
    /**
     * If NaN exists in three values of min and max, return true.
     */
    hasNan(): boolean {
        return this.min.hasNan() || this.max.hasNan();
    }
    /**
     * Check the given box is valid and let this box can contain it.
     */
    unionSafe(box: Box3): Box3 {
        if (box.hasNan()) {
            return this;
        }
        this.min.min(box.min);
        this.max.max(box.max);
        return this;
    }
    /**
     * Transforms this Box3 with the supplied matrix.
     * @param matrix The {@link Matrix4| Matrix4} to apply.
     */
    applyMatrix4(matrix: Matrix4): Box3 {
        // transform of empty box is an empty box.
        if (this.isEmpty()) {
            return this;
        }
        // NOTE: I am using a binary pattern to specify all 2^3 combinations below
        points[0].set(this.min.x, this.min.y, this.min.z).applyMatrix4(matrix); // 000
        points[1].set(this.min.x, this.min.y, this.max.z).applyMatrix4(matrix); // 001
        points[2].set(this.min.x, this.max.y, this.min.z).applyMatrix4(matrix); // 010
        points[3].set(this.min.x, this.max.y, this.max.z).applyMatrix4(matrix); // 011
        points[4].set(this.max.x, this.min.y, this.min.z).applyMatrix4(matrix); // 100
        points[5].set(this.max.x, this.min.y, this.max.z).applyMatrix4(matrix); // 101
        points[6].set(this.max.x, this.max.y, this.min.z).applyMatrix4(matrix); // 110
        points[7].set(this.max.x, this.max.y, this.max.z).applyMatrix4(matrix); // 111
        this.setFromPoints(points);
        return this;
    }
    /**
     * Adds {@link Vector3| offset} to both the upper and lower bounds of this box, effectively moving this box {@link Vector3| offset} units in 3D space.
     * @param offset Direction and distance of offset.
     */
    translate(offset: Vector3): Box3 {
        this.min.add(offset);
        this.max.add(offset);
        return this;
    }
    /**
     * Return true if this box and {@link Box3| box} share the same lower and upper bounds.
     * @param box Box to compare with this one.
     */
    equals(box: Box3): boolean {
        return box.min.equals(this.min) && box.max.equals(this.max);
    }
    /**
     * Return the Bounding on plane XY.
     */
    toBox2(box2 = new Box2()) {
        box2.min.set(this.min.x, this.min.y);
        box2.max.set(this.max.x, this.max.y);
        return box2;
    }
}
const tmpVec3 = new Vector3();
const points = [
    new Vector3(), new Vector3(), new Vector3(), new Vector3(),
    new Vector3(), new Vector3(), new Vector3(), new Vector3()
];
const v0 = new Vector3();
const v1 = new Vector3();
const v2 = new Vector3();

// triangle edge vectors
const f0 = new Vector3();
const f1 = new Vector3();
const f2 = new Vector3();

const testAxis = new Vector3();
const center = new Vector3();
const extents = new Vector3();
const triangleNormal = new Vector3();
