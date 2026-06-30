import { Vector3 } from '../../math/Vector3.js';
import { Matrix4 } from '../../math/Matrix4.js';
import { Ray } from '../../math/Ray.js';
import { Sphere } from '../../math/Sphere.js';
import type { Raycaster, Intersection } from '../tools/Raycaster.js';
import type { FatLineMaterial } from '../../elements/materials/mesh/FatLineMaterial.js';
import { FatLineBufferGeometry } from '../../elements/geometries/containers/FatLineBufferGeometry.js';
import { checkIntersectionLine } from './Line.js';
import { OutlineMode, Drawable } from './Drawable.js';
import type { Serializer, Deserializer } from '../../utils/Serialization.js';
import type { BufferGeometry, LineList } from '../../elements/geometries/containers/BufferGeometry.js';
import { computeLineDistancesForFatline } from '../../elements/geometries/operators/LineDistance.js';
import { DrawMode } from '../../utils/Constants.js';

const realScaleTemp = new Vector3();

const inverseMatrix = new Matrix4();
const ray = new Ray();
const sphere = new Sphere();
/**
 * This class is used to draw lines which has same width between each vertexes of Geometry on the surfaces. <br />
 */
export class FatLineSegments extends Drawable<FatLineMaterial, FatLineBufferGeometry> {
    /**
     * If require engine to draw this as Line instead of Mesh, set this to true.
     */
    static UseFallBack = false;
    /**
     * Check the type whether it belongs to FatLineSegments.
     * This value should not be changed by user.
     */
    isFatLineSegments = true;
    __isFatLineSegments = true;
    /**
     * The name of instance's class.
     */
    className() {
        return 'FatLineSegments';
    }

    constructor(geometry: FatLineBufferGeometry, material: FatLineMaterial) {
        super(geometry, material);

        this.outlineMode = OutlineMode.Disabled;
        this.castPlanarShadow = false;
        this.castShadow = false;
    }

    updateRenderEntity() {
        if (FatLineSegments.UseFallBack) {
            this._renderGeometry = this._geometry.fallback;
            this.drawMode = DrawMode.Lines;
        } else {
            this._renderGeometry = this._geometry;
        }
        this._renderMaterial = this._material;
    }

    /**
     * Get intersections between a casted {@link Ray| ray} and this Mesh.
     * The method {@link Raycaster.intersectObject| intersectObject()} will call this method, but the results are not ordered.
     * @param {Raycaster} raycaster the instance of Raycaster is used to get the data for calculation.
     * @param {Intersection} intersects the result will be stored here.
     */
    raycastJsImpl(raycaster: Raycaster, intersects: Intersection[]): void {
        if (FatLineSegments.UseFallBack) {
            super.raycast(raycaster, intersects);
            return;
        }

        const geometry = this.geometry;
        const start = geometry.instanceStart;
        const end = geometry.instanceEnd;
        if (!start || !end) {
            return;
        }

        const backupPrecision = raycaster.linePrecision;
        raycaster.linePrecision = Math.max(this.expectOnlyMaterial().fatLineWidth / 2, raycaster.linePrecision);
        const backupScreenSpaceEnable = raycaster.enableScreenSpaceTolerance;
        raycaster.enableScreenSpaceTolerance = true;

        sphere.copy(geometry.getBoundingSphere());
        sphere.applyMatrix4(this.matrixWorld);
        sphere.radius += Math.sqrt(raycaster.getScreenLineToleranceSq(raycaster.ray.directionDistance(sphere.center)));

        if (!raycaster.ray.intersectsSphere(sphere)) {
            raycaster.linePrecision = backupPrecision;
            raycaster.enableScreenSpaceTolerance = backupScreenSpaceEnable;
            return;
        }

        inverseMatrix.getInverse(this.matrixWorld);
        ray.copy(raycaster.ray).applyMatrix4(inverseMatrix);

        const screenPrecisionMaxSq = raycaster.getScreenLineToleranceSq(
            raycaster.ray.intersectSphereMaxDistance(sphere),
        );
        this.matrixWorld.getScale(realScaleTemp);
        const vStart = new Vector3();
        const vEnd = new Vector3();
        for (let i = 0, l = start.array.length / 3; i < l; i += 1) {
            vStart.set(start.getX(i), start.getY(i), start.getZ(i));
            vEnd.set(end.getX(i), end.getY(i), end.getZ(i));

            const result = checkIntersectionLine(
                vStart,
                vEnd,
                i,
                i,
                this,
                raycaster,
                ray,
                realScaleTemp,
                0,
                screenPrecisionMaxSq,
            );
            if (result) {
                intersects.push(result);
            }
        }

        raycaster.linePrecision = backupPrecision;
        raycaster.enableScreenSpaceTolerance = backupScreenSpaceEnable;
    }

    serialize(ctx: Serializer) {
        super.serialize(ctx);
        const data = ctx.serialize(this._geometry.fallback);
        ctx.putRaw('fallback', data);
    }

    deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        const sourceGeo = ctx.deserialize(ctx.readRaw('fallback')) as BufferGeometry<LineList>;
        if (sourceGeo.position.array.length === 0) {
            const instanceStart = this.geometry.getAttribute('instanceStart')?.array;
            const instanceEnd = this.geometry.getAttribute('instanceEnd')?.array;
            const data: number[] = [];
            if (instanceStart && instanceEnd && instanceStart.length === instanceEnd.length) {
                for (let i = 0, l = instanceStart.length; i < l; i += 3) {
                    data.push(
                        instanceStart[i],
                        instanceStart[i + 1],
                        instanceStart[i + 2],
                        instanceEnd[i],
                        instanceEnd[i + 1],
                        instanceEnd[i + 2],
                    );
                }
            }
            sourceGeo.addOrSetAttribute('position', new Float32Array(data), 3);
        }
        const realGeo = new FatLineBufferGeometry(sourceGeo);
        computeLineDistancesForFatline(realGeo);
        this.geometry = realGeo;
        // sourceGeo.destroy();
        this.updateRenderEntity();
    }
}
