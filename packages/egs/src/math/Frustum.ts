import { Plane } from './Plane';
import { Matrix4 } from './Matrix4';
import { Vector3 } from './Vector3';
import { Sphere } from './Sphere';
import type { Box3 } from './Box3';
import type { Object3D } from '../scene/Object3D';
import type { Sprite } from '../scene/drawables/Sprite';
import type { PerspectiveCamera } from '../scene/cameras/PerspectiveCamera';

/**
 * Viewing frustum represented by six clipping planes.
 */
export class Frustum {
    /**
     * Array of 6 {@link Plane| planes}.
     */
    planes: Plane[];
    /**
     * The eight vertex's position of frustum
     */
    corners: Vector3[];

    constructor(p0?: Plane, p1?: Plane, p2?: Plane, p3?: Plane, p4?: Plane, p5?: Plane) {
        this.planes = [
            (p0 !== undefined) ? p0 : new Plane(),
            (p1 !== undefined) ? p1 : new Plane(),
            (p2 !== undefined) ? p2 : new Plane(),
            (p3 !== undefined) ? p3 : new Plane(),
            (p4 !== undefined) ? p4 : new Plane(),
            (p5 !== undefined) ? p5 : new Plane()
        ];
        this.corners = [
            new Vector3(),
            new Vector3(),
            new Vector3(),
            new Vector3(),
            new Vector3(),
            new Vector3(),
            new Vector3(),
            new Vector3(),
        ];
        return this;
    }
    /**
     * Sets the frustum from the passed planes. No plane order is implied.
     * Note that this method only copies the values from the given objects.
     */
    set(p0: Plane, p1: Plane, p2: Plane, p3: Plane, p4: Plane, p5: Plane): Frustum {
        const planes = this.planes;
        planes[0].copy(p0);
        planes[1].copy(p1);
        planes[2].copy(p2);
        planes[3].copy(p3);
        planes[4].copy(p4);
        planes[5].copy(p5);
        return this;
    }
    /**
     * Return a new Frustum with the same parameters as this one.
     */
    clone(): Frustum {
        return new Frustum().copy(this);
    }
    /**
     * Copies the properties of the passed {@link Frustum| frustum} into this one.
     * @param frustum The frustum to copy.
     */
    copy(frustum: Frustum): Frustum {
        const planes = this.planes;
        for (let i = 0; i < 6; i++) {
            planes[i].copy(frustum.planes[i]);
        }
        return this;
    }
    /**
     * Return the {@link corners| corners}.
     */
    getCorners(): Vector3[] {
        return this.corners;
    }
    /**
     * Sets the frustum by a transform matrix.
     */
    setFromMatrix(m: Matrix4): Frustum {
        const planes = this.planes;
        const me = m._elements;
        const me0 = me[0], me1 = me[1], me2 = me[2], me3 = me[3],
            me4 = me[4], me5 = me[5], me6 = me[6], me7 = me[7],
            me8 = me[8], me9 = me[9], me10 = me[10], me11 = me[11],
            me12 = me[12], me13 = me[13], me14 = me[14], me15 = me[15];
        planes[0].setComponents(me3 - me0, me7 - me4, me11 - me8, me15 - me12).normalize();
        planes[1].setComponents(me3 + me0, me7 + me4, me11 + me8, me15 + me12).normalize();
        planes[2].setComponents(me3 + me1, me7 + me5, me11 + me9, me15 + me13).normalize();
        planes[3].setComponents(me3 - me1, me7 - me5, me11 - me9, me15 - me13).normalize();
        planes[4].setComponents(me3 - me2, me7 - me6, me11 - me10, me15 - me14).normalize();
        planes[5].setComponents(me3 + me2, me7 + me6, me11 + me10, me15 + me14).normalize();

        const corners = this.corners;
        const matrixInverse = new Matrix4().getInverse(m);
        corners[0] = new Vector3(-1, -1, -1).applyMatrix4(matrixInverse);
        corners[1] = new Vector3(1, -1, -1).applyMatrix4(matrixInverse);
        corners[2] = new Vector3(1, -1, 1).applyMatrix4(matrixInverse);
        corners[3] = new Vector3(-1, -1, 1).applyMatrix4(matrixInverse);
        corners[4] = new Vector3(-1, 1, -1).applyMatrix4(matrixInverse);
        corners[5] = new Vector3(1, 1, -1).applyMatrix4(matrixInverse);
        corners[6] = new Vector3(1, 1, 1).applyMatrix4(matrixInverse);
        corners[7] = new Vector3(-1, 1, 1).applyMatrix4(matrixInverse);
        return this;
    }
    /**
     * Checks whether the {@link Object3D| object}'s {@link BufferGeometry.boundingSphere| bounding} is intersecting the frustum.
     * Note that the object must have a {@link BufferGeometry| geometry} so that the bounding sphere can be calculated.
     */
    intersectsObject(object: Object3D): boolean {
        const geometry = (object as any).geometry;
        if (geometry.boundingSphere === null) {
            geometry.computeBoundingSphere();
        }
        tmpSphere.copy(geometry.boundingSphere).applyMatrix4(object.matrixWorld);
        return this.intersectsSphere(tmpSphere);
    }
    /**
     * Checks whether the {@link Sprite| sprite} is intersecting the frustum.
     */
    intersectsSprite(sprite: Sprite): boolean {
        tmpSphere.center.set(0, 0, 0);
        tmpSphere.radius = 0.7071067811865476;
        tmpSphere.applyMatrix4(sprite.matrixWorld);
        return this.intersectsSphere(tmpSphere);
    }
    /**
     * Return true if {@link Sphere| sphere} intersects with this frustum.
     * @param sphere {@link Sphere| Sphere} to check for intersection.
     */
    intersectsSphere(sphere: Sphere): boolean {
        const planes = this.planes;
        const center = sphere.center;
        const negRadius = - sphere.radius;
        for (let i = 0; i < 6; i++) {
            const distance = planes[i].distanceToPoint(center);
            if (distance < negRadius) {
                return false;
            }
        }
        return true;
    }
    /**
     * Return true if {@link Box3| box} intersects with this frustum.
     * @param box {@link Box3| Box3} to check for intersection.
     */
    intersectsBox(box: Box3): boolean {
        const planes = this.planes;
        const boxMaxX =  box.max.x;
        const boxMaxY = box.max.y;
        const boxMaxZ = box.max.z;
        const boxMinX =  box.min.x;
        const boxMinY = box.min.y;
        const boxMinZ = box.min.z;

        for (let i = 0; i < 6; i++) {
            const plane = planes[i];
            const normal = plane.normal;
            // corner at max distance
            tmpVec3.x = normal.x > 0 ? boxMaxX : boxMinX;
            tmpVec3.y = normal.y > 0 ? boxMaxY : boxMinY;
            tmpVec3.z = normal.z > 0 ? boxMaxZ : boxMinZ;
            if (plane.distanceToPoint(tmpVec3) < 0) {
                return false;
            }
        }
        return true;
    }
    /**
     * Checks to see if the frustum contains the {@link Vector3| point}.
     * @param point {@link Vector3| Vector3} to test.
     */
    containsPoint(point: Vector3): boolean {
        const planes = this.planes;
        for (let i = 0; i < 6; i++) {
            if (planes[i].distanceToPoint(point) < 0) {
                return false;
            }
        }
        return true;
    }
    /**
     * Return a value to represent the closest distance between camera and box, if there are any part of bos inside the frustum.
     */
    getCameraClosestDistanceFromBoxes(camera: PerspectiveCamera, boxes: Box3[]) {
        const points = [];
        this.setFromMatrix(tmpMat4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
        cameraPos.setFromMatrixPosition(camera.matrixWorld);
        cameraDirection.set(camera.matrixWorld._elements[8], camera.matrixWorld._elements[9], camera.matrixWorld._elements[10]);

        const frustumCorners = this.corners;
        const frustumPlanes = this.planes;
        for (let i = 0; i < boxes.length; i++) {
            const box = boxes[i];
            const boxCorners = box.getCorners();
            const boxPlanes = box.getPlanes();
            // step 1, check all 8 points
            for (let j = 0; j < boxCorners.length; j++) {
                if (isPointInsideFrustum(boxCorners[j], this)) {
                    points.push(boxCorners[j]);
                }
            }

            // step 2, check each box plane and frustum plane
            boxFrustumIntersect(frustumCorners, frustumPlanes, boxCorners, boxPlanes, box, this, cameraPos, points);
        }

        let near = points.length === 0 ? 1 : Infinity;
        points.forEach((point) => {
            const distance = pointTmp.copy(cameraPos).sub(point).dot(cameraDirection);
            near = Math.min(near, distance);
        });
        return Math.max(1, near);
    }
}

const tmpVec3 = new Vector3();
const tmpSphere = new Sphere();

const cameraPos = new Vector3();
const cameraDirection = new Vector3();
const dotVec = new Vector3();
const intersectPt = new Vector3();

const tmpMat4 = new Matrix4();
const pointTmp = new Vector3();

// pure line, no start or end
class Line {
    constant = new Vector3();
    direction = new Vector3();

    update(point1: Vector3, point2: Vector3) {
        this.constant.copy(point1);
        const length = this.direction.copy(point2).sub(this.constant).length();
        if (length < 0.0001) {
            return false;
        } else {
            this.direction.normalize();
        }
        return true;
    }

    // https://www.cnblogs.com/xiangtingshen/p/12329951.html

    static lineIntersect(line1: Line, line2: Line, point: Vector3) {
        const startPointSeg = new Vector3().copy(line2.constant).sub(line1.constant);
        const vecS1 = new Vector3().copy(line1.direction).cross(line2.direction);
        const vecS2 = new Vector3().copy(startPointSeg).cross(line2.direction);
        const num2 = vecS2.dot(vecS1) / vecS1.lengthSq();
        point.copy(line1.constant).add(line1.direction.clone().multiplyScalar(num2));
    }
}

const lineFace2Face = new Line();
const lineLine2Line = new Line();

const BOX_EDGE_PAIRS = [[[3, 7], [7, 4], [4, 0], [0, 3]],
                        [[0, 4], [4, 5], [5, 1], [1, 0]],
                        [[0, 1], [1, 2], [2, 3], [3, 0]],
                        [[6, 2], [2, 1], [1, 5], [5, 6]],
                        [[2, 6], [6, 7], [7, 3], [3, 2]],
                        [[7, 6], [6, 5], [5, 4], [4, 7]]];

const FRUSTUM_EDGE_PAIRS = [[6, 2],
                            [7, 3],
                            [7, 6],
                            [3, 2]];

function isPointInsideFrustum(point: Vector3, frustum: Frustum) {
    let isInside = true;
    // ignore the near far plane for now
    for (let i = 0; i < 4; i++) {
        const dis = frustum.planes[i].distanceToPoint(point);
        // We set up the threshold value to -1 to prevent early culling
        if (isNaN(dis) || dis < -1) {
            isInside = false;
            break;
        }
    }
    return isInside;
}

function boxFrustumIntersect(frustumCorners: Vector3[], frustumPlanes: Plane[],
    boxCorners: Vector3[], boxPlanes: Plane[],
    box: Box3, frustum: Frustum, cameraPos: Vector3, points: Vector3[]) {
    const pointsTmp: Vector3[] = [];
    for (let i = 0; i < boxPlanes.length; i++) {
        const boxPlane = boxPlanes[i];
        for (let j = 0; j < 4; j++) {
            const frustumPlane = frustumPlanes[j];
            // parallel
            if (Math.abs(dotVec.copy(boxPlane.normal).dot(frustumPlane.normal)) > 0.99999) {
                continue;
            } else {
                setupLine(i, boxPlane, frustumPlane, box);
                lineInterestBoxPlane(i, boxCorners, pointsTmp);
                lineInterestFrustumPlane(j, frustumCorners, cameraPos, pointsTmp);
            }
        }
    }
    for (let i = 0; i < pointsTmp.length; i++) {
        if (isPointInsideFrustum(pointsTmp[i], frustum) && box.containsPoint(pointsTmp[i])) {
            points.push(pointsTmp[i]);
        }
    }
}

function setupLine(i: number, boxPlane: Plane, frustumPlane: Plane, box: Box3) {
    lineFace2Face.direction.set(boxPlane.normal.y * frustumPlane.normal.z - boxPlane.normal.z * frustumPlane.normal.y,
                                boxPlane.normal.z * frustumPlane.normal.x - boxPlane.normal.x * frustumPlane.normal.z,
                                boxPlane.normal.x * frustumPlane.normal.y - boxPlane.normal.y * frustumPlane.normal.x).normalize();

    switch (i) {
        case 0:
            lineFace2Face.constant.x = box.min.x;
            lineFace2Face.constant.y = 0;
            lineFace2Face.constant.z = -(frustumPlane.normal.x * lineFace2Face.constant.x + frustumPlane.constant) / frustumPlane.normal.z;
            break;
        case 1:
            lineFace2Face.constant.y = box.min.y;
            lineFace2Face.constant.x = 0;
            lineFace2Face.constant.z = -(frustumPlane.normal.y * lineFace2Face.constant.y + frustumPlane.constant) / frustumPlane.normal.z;
            break;
        case 2:
            lineFace2Face.constant.z = box.min.z;
            lineFace2Face.constant.x = 0;
            lineFace2Face.constant.y = -(frustumPlane.normal.z * lineFace2Face.constant.z + frustumPlane.constant) / frustumPlane.normal.y;
            break;
        case 3:
            lineFace2Face.constant.x = box.max.x;
            lineFace2Face.constant.y = 0;
            lineFace2Face.constant.z = -(frustumPlane.normal.x * lineFace2Face.constant.x + frustumPlane.constant) / frustumPlane.normal.z;
            break;
        case 4:
            lineFace2Face.constant.y = box.max.y;
            lineFace2Face.constant.x = 0;
            lineFace2Face.constant.z = -(frustumPlane.normal.y * lineFace2Face.constant.y + frustumPlane.constant) / frustumPlane.normal.z;
            break;
        case 5:
            lineFace2Face.constant.z = box.max.z;
            lineFace2Face.constant.x = 0;
            lineFace2Face.constant.y = -(frustumPlane.normal.z * lineFace2Face.constant.z + frustumPlane.constant) / frustumPlane.normal.y;
            break;
    }
}

function lineInterestBoxPlane(i: number, boxCorners: Vector3[], points: Vector3[]) {
    const edgePairs = BOX_EDGE_PAIRS[i];
    for (let j = 0; j < edgePairs.length; j++) {
        const pt1 = boxCorners[edgePairs[j][0]];
        const pt2 = boxCorners[edgePairs[j][1]];
        // line too short or parallel, skip
        if (lineLine2Line.update(pt1, pt2) && Math.abs(dotVec.copy(lineFace2Face.direction).dot(lineLine2Line.direction)) < 0.99999) {
            Line.lineIntersect(lineFace2Face, lineLine2Line, intersectPt);
            points.push(intersectPt.clone());
        }
    }
}

function lineInterestFrustumPlane(i: number, frustumCorners: Vector3[], cameraPos: Vector3, pointsTmp: Vector3[]) {
    const edgePairs = FRUSTUM_EDGE_PAIRS[i];
    for (let j = 0; j < edgePairs.length; j++) {
        const pt1 = cameraPos;
        const pt2 = frustumCorners[edgePairs[j]];

        // line too short or parallel, skip
        if (lineLine2Line.update(pt1, pt2) && Math.abs(dotVec.copy(lineFace2Face.direction).dot(lineLine2Line.direction)) < 0.99999) {
            Line.lineIntersect(lineFace2Face, lineLine2Line, intersectPt);
            pointsTmp.push(intersectPt.clone());
        }
    }
}
