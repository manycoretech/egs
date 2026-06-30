import { logger } from '../../../utils/Logger.js';
import { Box3 } from '../../../math/Box3.js';
import type { Matrix4 } from '../../../math/Matrix4.js';
import { Sphere } from '../../../math/Sphere.js';
import { Vector3 } from '../../../math/Vector3.js';
import { BufferAttribute } from '../../attributes/BufferAttribute.js';
import { InstancedBufferAttribute } from '../../attributes/InstancedBufferAttribute.js';
import type { BufferGeometry, LineList } from './BufferGeometry.js';
import { InstancedBufferGeometry } from './InstancedBufferGeometry.js';
import { ContentBridge } from '../../../ContentAPI.js';

const tempBox = new Box3();
const tempVector = new Vector3();
/**
 * This is a dedicated geometry for {@link FatLineSegments| FatLineSegments }.
 */
export class FatLineBufferGeometry extends InstancedBufferGeometry {
    /**
     * Used to check type of this or extended instance.
     * This value should not be changed by user.
     */
    isLineSegmentsGeometry = true;
    private _fallback_geometry: BufferGeometry<LineList>;

    get fallback(): BufferGeometry<LineList> {
        return this._fallback_geometry;
    }

    get instanceStart(): InstancedBufferAttribute<Float32Array> {
        return this.getAttribute('instanceStart') as any;
    }
    get instanceEnd(): InstancedBufferAttribute<Float32Array> {
        return this.getAttribute('instanceEnd') as any;
    }

    /**
     * Creates an instance of FatLineBufferGeometry. geometry layout must be LineSegment
     * @param {(BufferGeometry | WireframeBufferGeometry)} geometry
     * @param {boolean} [geometryLayoutIsLineSegment=false]
     * @memberof FatLineBufferGeometry
     */
    constructor(geometry: BufferGeometry<LineList>) {
        super();
        const positions = [-1, 2, 0, 1, 2, 0, -1, 1, 0, 1, 1, 0, -1, 0, 0, 1, 0, 0, -1, -1, 0, 1, -1, 0];
        const uvs = [-1, 2, 1, 2, -1, 1, 1, 1, -1, -1, 1, -1, -1, -2, 1, -2];
        const index = [0, 2, 1, 2, 3, 1, 2, 4, 3, 4, 5, 3, 4, 6, 5, 6, 7, 5];
        this._fallback_geometry = geometry;
        this.setIndex(index);
        this.addAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
        this.addAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
        this.setPositions(geometry.position.array as Float32Array);
        ContentBridge.bufferGeometrySetIsFatline(this);
    }
    /**
     * Apply the given matrix to vertexes data.
     * @return this object.
     */
    applyMatrix(matrix: Matrix4): FatLineBufferGeometry {
        const start = this.instanceStart;
        const end = this.instanceEnd;

        if (start !== undefined) {
            matrix.applyToBufferAttribute(start);
            matrix.applyToBufferAttribute(end);
        }

        if (this.boundingBox !== null) {
            this.computeBoundingBox();
        }
        if (this.boundingSphere !== null) {
            this.computeBoundingSphere();
        }
        return this;
    }
    /**
     * Build segmented line data by given data and update bounding.
     * @param { Float32Array } lineSegments the segments data store as Float32Array.
     * @return this object.
     */
    setPositions(lineSegments: Float32Array): FatLineBufferGeometry {
        this._fallback_geometry.addOrSetAttribute('position', lineSegments, 3);
        const instanceStart = [];
        const instanceEnd = [];
        for (let i = 0; i < lineSegments.length / 6; i++) {
            instanceStart.push(lineSegments[i * 6]);
            instanceStart.push(lineSegments[i * 6 + 1]);
            instanceStart.push(lineSegments[i * 6 + 2]);

            instanceEnd.push(lineSegments[i * 6 + 3]);
            instanceEnd.push(lineSegments[i * 6 + 4]);
            instanceEnd.push(lineSegments[i * 6 + 5]);
        }

        const instanceStartAtt = new InstancedBufferAttribute(new Float32Array(instanceStart), 3);
        const instanceEndAtt = new InstancedBufferAttribute(new Float32Array(instanceEnd), 3);
        this.addAttribute('instanceStart', instanceStartAtt); // xyz
        this.addAttribute('instanceEnd', instanceEndAtt); // xyz
        this.instancedCount = instanceStartAtt.count;

        this.computeBoundingBox();
        this.computeBoundingSphere();
        return this;
    }
    /**
     * Recalculate the bounding box for this geometry.
     */
    computeBoundingBox(): void {
        if (this.boundingBox === null) {
            this.boundingBox = new Box3();
        }

        const start = this.instanceStart;
        const end = this.instanceEnd;

        if (start !== undefined && end !== undefined) {
            this.boundingBox.setFromBufferAttribute(start);
            tempBox.setFromBufferAttribute(end);
            this.boundingBox.union(tempBox);
        }
    }
    /**
     * Recalculate the bounding sphere for this geometry.
     */
    computeBoundingSphere(): void {
        if (this.boundingSphere === null) {
            this.boundingSphere = new Sphere();
        }

        if (this.boundingBox === null) {
            this.computeBoundingBox();
        }

        const start = this.instanceStart;
        const end = this.instanceEnd;

        if (start !== undefined && end !== undefined) {
            const center = this.boundingSphere.center;
            this.boundingBox!.getCenter(center);
            let maxRadiusSq = 0;
            for (let i = 0, il = start.count; i < il; i++) {
                tempVector.fromBufferAttribute(start, i);
                maxRadiusSq = Math.max(maxRadiusSq, center.distanceToSquared(tempVector));
                tempVector.fromBufferAttribute(end, i);
                maxRadiusSq = Math.max(maxRadiusSq, center.distanceToSquared(tempVector));
            }

            this.boundingSphere.radius = Math.sqrt(maxRadiusSq);
            if (isNaN(this.boundingSphere.radius)) {
                logger.warn(
                    'EGS.LineSegmentsGeometry.computeBoundingSphere(): Computed radius is NaN. The instanced position data is likely to have NaN values.',
                    this,
                );
            }
        }
    }
    /**
     * Clear the current geometry's data in memory.
     */
    freeGPU() {
        super.freeGPU();
        this.fallback.freeGPU();
    }
}
