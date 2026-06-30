import { Matrix4 } from '../../math/Matrix4.js';
import { Ray } from '../../math/Ray.js';
import { Sphere } from '../../math/Sphere.js';
import { Vector3 } from '../../math/Vector3.js';
import { Vector2 } from '../../math/Vector2.js';
import type { Raycaster, Intersection } from '../tools/Raycaster.js';
import type { Nullable } from '../../utils/Utils.js';
import { Triangle } from '../../math/Triangle.js';
import type { LineSegments } from './LineSegments.js';
import { Drawable, OutlineMode } from './Drawable.js';
import type { Camera3D } from '../cameras/Camera3D.js';
import type { Material } from '../../elements/materials/Material.js';
import type { BufferAttribute } from '../../elements/attributes/BufferAttribute.js';
import { Face3 } from '../../math/Face3.js';
import { Side } from '../../utils/Constants.js';
import type { Deserializer, Serializer } from '../../utils/Serialization.js';
import type { TriangleList, BufferGeometry } from '../../elements/geometries/containers/BufferGeometry.js';
import { drawableState, ContentBridge } from '../../ContentAPI.js';
import { createMeshBVH } from '../../BVH/index.js';
import { GLOBAL_CONFIG } from '../../utils/GlobalConfig.js';

// inside class tmp parameters for checking intersection
const inverseMatrix = new Matrix4();
const ray = new Ray();
const sphere = new Sphere();

const vA = new Vector3();
const vB = new Vector3();
const vC = new Vector3();

const uvA = new Vector2();
const uvB = new Vector2();
const uvC = new Vector2();

const intersectionPoint = new Vector3();
const intersectionPointWorld = new Vector3();

function checkIntersection(
    object: Mesh,
    material: Material,
    raycaster: Raycaster,
    _ray: Ray,
    pA: Vector3,
    pB: Vector3,
    pC: Vector3,
    point: Vector3,
): Nullable<Intersection> {
    let intersect: Nullable<Vector3> = null;

    if (material.side === Side.BackSide) {
        intersect = _ray.intersectTriangle(pC, pB, pA, true, point);
    } else {
        intersect = _ray.intersectTriangle(pA, pB, pC, material.side !== Side.DoubleSide, point);
    }

    if (intersect === null) {
        return null;
    }

    intersectionPointWorld.copy(point);
    intersectionPointWorld.applyMatrix4(object.matrixWorld);

    const distance = raycaster.ray.origin.distanceTo(intersectionPointWorld);

    if (distance < raycaster.near || distance > raycaster.far) {
        return null;
    }

    return {
        distance,
        point: intersectionPointWorld.clone(),
        primitiveIndex: 0,
        object,
    };
}

function checkBufferGeometryIntersection(
    object: Mesh,
    material: Material,
    raycaster: Raycaster,
    _ray: Ray,
    position: BufferAttribute,
    uv: BufferAttribute,
    primitiveIndex: number,
    a: number,
    b: number,
    c: number,
): Nullable<Intersection> {
    vA.fromBufferAttribute(position, a);
    vB.fromBufferAttribute(position, b);
    vC.fromBufferAttribute(position, c);
    const intersection = checkIntersection(object, material, raycaster, _ray, vA, vB, vC, intersectionPoint);

    if (intersection) {
        if (uv) {
            uv.getVector2(a, uvA);
            uv.getVector2(b, uvB);
            uv.getVector2(c, uvC);
            intersection.uv = Triangle.getUV(intersectionPoint, vA, vB, vC, uvA, uvB, uvC, new Vector2());
        }

        const face = new Face3(a, b, c);
        Triangle.getNormal(vA, vB, vC, face.normal);

        intersection.face = face;
        intersection.primitiveIndex = intersection.faceIndex = primitiveIndex;
    }
    return intersection;
}

/**
 * This class is used to connect every three points into a triangle and draws every meshes as corresponding material in the scene.
 */
export class Mesh<
    M extends Material = Material,
    G extends BufferGeometry<TriangleList> = BufferGeometry<TriangleList>,
> extends Drawable<M, G> {
    /**
     * Check the type whether it belongs to Mesh.
     * This value should not be changed by user.
     */
    isMesh = true;
    /**
     * Mark this mesh use origin material in transparent mode
     */
    @drawableState()
    useOriginMaterialInTransparentMode = false;
    /**
     * The type of this Object3D.
     */
    type = 'Mesh';
    /**
     * Bind edges to a mesh.
     * Since the material is same, so all the groups will be combined together here.
     */
    edges: Nullable<LineSegments> = null;
    _syncedEdgeThreshold = -1;

    private _instanceKey: Nullable<string> = null;
    /**
     * This key is used to identify the different instances with same data.
     * @remarks See {@link InstanceMesh| InstanceMesh} for more details
     */
    set instanceKey(value: Nullable<string>) {
        if (this._instanceKey === value) {
            return;
        }
        this.resetRenderEntity();
        this._instanceKey = value;
        ContentBridge.drawableSyncData(this, 'instanceKey', this.instanceKey);
    }
    get instanceKey() {
        return this._instanceKey;
    }

    private _mergeKey: Nullable<string> = null;
    /**
     * This key is used to merge different meshes which have same key into one WebGL Draw Call.
     */
    set mergeKey(value: Nullable<string>) {
        if (this._mergeKey === value) {
            return;
        }
        this.setGeometryChanged();
        this.setMaterialChanged();
        this._mergeKey = value;
        ContentBridge.drawableSyncData(this, 'mergeKey', this.mergeKey);
    }
    get mergeKey() {
        return this._mergeKey;
    }

    /**
     * The name of instance's class.
     */
    className() {
        return 'Mesh';
    }
    /**
     * Store the attributes of this class into string as serializing format.
     * @param {Serializer} ctx this parameter has not supported external Serializer yet.
     * It may cause that this method can not be used directly.
     * @internal
     */
    serialize(ctx: Serializer) {
        super.serialize(ctx);
        ctx.puts<Mesh>(['instanceKey', 'mergeKey']);
    }
    /**
     * Parse the data for this class from string according to serializing format.
     * @param {Deserializer} ctx this parameter has not supported external Deserializer yet.
     * It may cause that this method can not be used directly.
     * @internal
     */
    deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        ctx.reads<Mesh>(['instanceKey', 'mergeKey']);
    }
    constructor(geometry?: G, material?: M | M[]) {
        super(geometry, material);
        this.outlineMode = OutlineMode.Outlined;
        this.castPlanarShadow = true;
        this.castShadow = true;
    }
    /**
     * Update the data which need be changed according to the camera's state and
     * attributes of {@link Drawable.updateRenderInfo| Drawable} before drawing this object.
     * @param {Camera3D} camera the camera which is used in current frame.
     * @param {number} viewHeight the height of canvas.
     */
    updateRenderInfo(camera: Camera3D, viewHeight: number) {
        super.updateRenderInfo(camera, viewHeight);
        this.frontFaceCW = this.normalMatrix.determinant() < 0;
    }
    /**
     * If user change the data of geometry, use this method to refresh the data.
     */
    setGeometryChanged() {
        super.setGeometryChanged();
        if (this.edges) {
            this.edges.geometry.freeGPU();
            this.edges = null;
        }
    }
    /**
     * If user change the data of geometry, use this method to refresh referring data.
     * @remarks See {@link Drawable.onReferencedGeometryContentChange| onReferencedGeometryContentChange()} for more details.
     */
    onReferencedGeometryContentChange() {
        super.onReferencedGeometryContentChange();
        if (this.edges) {
            this.edges = null;
        }
    }

    /**
     * Copy the data to this object from source.
     * This method need override in derived classes to copy extended data.
     * @param {Mesh} source the data source.
     */
    copy(source: Mesh<M, G>, recursive?: boolean) {
        super.copy(source, recursive);
        return this;
    }
    /**
     * Return a clone of this object.
     */
    clone(recursive?: boolean): Mesh<M, G> {
        return new Mesh(this.geometry, this._material).copy(this, recursive);
    }
    destroy() {
        super.destroy();
        if (this.edges) {
            this.edges.geometry.destroyAllResourcesOwned();
            this.edges.destroy();
            this.edges = null;
        }
    }
    /**
     * Get intersections between a casted {@link Ray| ray} and this Mesh.
     * The method {@link Raycaster.intersectObject| intersectObject()} will call this method, but the results are not ordered.
     * @param {Raycaster} raycaster the instance of Raycaster is used to get the data for calculation.
     * @param {Intersection} intersects the result will be stored here.
     */
    raycastJsImpl(raycaster: Raycaster, intersects: Intersection[]) {
        const geometry = this.geometry;
        const material = this._material;
        const matrixWorld = this.matrixWorld;

        if (material === undefined) {
            return;
        }

        sphere.copy(geometry.getBoundingSphere());
        sphere.applyMatrix4(matrixWorld);

        if (raycaster.ray.intersectsSphere(sphere) === false) {
            return;
        }

        inverseMatrix.getInverse(matrixWorld);
        ray.copy(raycaster.ray).applyMatrix4(inverseMatrix);

        // Check boundingBox before continuing
        if (ray.intersectsBox(geometry.getBoundingBox()) === false) {
            return;
        }

        // bvh
        if (GLOBAL_CONFIG.meshBVHEnabled) {
            if (!geometry.meshBVH) {
                createMeshBVH(this);
            }
            if (geometry.meshBVH) {
                geometry.meshBVH.pick(this, raycaster, ray, intersects);
                return;
            }
        }

        let intersection;
        let a, b, c;
        const index = geometry.index;
        const position = geometry.position;
        const uv = geometry.uv;
        const groups = geometry.getGroups();
        const drawRange = geometry.drawRange;
        let i, j, il, jl, group, groupMaterial, start, end;
        if (index !== null) {
            // indexed buffer geometry
            if (material.length === 1 && !this.shouldUseGeometryGroupsWhenOnlyHasOneMaterial) {
                start = Math.max(0, drawRange.start);
                end = Math.min(index.count, drawRange.start + drawRange.count);

                for (i = start, il = end; i < il; i += 3) {
                    a = index.getX(i);
                    b = index.getX(i + 1);
                    c = index.getX(i + 2);

                    intersection = checkBufferGeometryIntersection(
                        this,
                        material[0],
                        raycaster,
                        ray,
                        position as BufferAttribute,
                        uv as BufferAttribute,
                        Math.floor(i / 3),
                        a,
                        b,
                        c,
                    );

                    if (intersection) {
                        intersects.push(intersection);
                    }
                }
            } else {
                for (i = 0, il = groups.length; i < il; i++) {
                    group = groups[i];
                    groupMaterial = material[group.materialIndex];

                    start = Math.max(group.start, drawRange.start);
                    end = Math.min(group.start + group.count, drawRange.start + drawRange.count);

                    for (j = start, jl = end; j < jl; j += 3) {
                        a = index.getX(j);
                        b = index.getX(j + 1);
                        c = index.getX(j + 2);
                        intersection = checkBufferGeometryIntersection(
                            this,
                            groupMaterial,
                            raycaster,
                            ray,
                            position as BufferAttribute,
                            uv as BufferAttribute,
                            Math.floor(j / 3),
                            a,
                            b,
                            c,
                        );

                        // triTestCount++;

                        if (intersection) {
                            intersects.push(intersection);
                        }
                    }
                }
            }
        } else if (position !== undefined) {
            // non-indexed buffer geometry
            if (material.length === 1 && !this.shouldUseGeometryGroupsWhenOnlyHasOneMaterial) {
                start = Math.max(0, drawRange.start);
                end = Math.min(position.count, drawRange.start + drawRange.count);

                for (i = start, il = end; i < il; i += 3) {
                    a = i;
                    b = i + 1;
                    c = i + 2;

                    intersection = checkBufferGeometryIntersection(
                        this,
                        material[0],
                        raycaster,
                        ray,
                        position as BufferAttribute,
                        uv as BufferAttribute,
                        Math.floor(i / 3),
                        a,
                        b,
                        c,
                    );

                    if (intersection) {
                        intersects.push(intersection);
                    }
                }
            } else {
                for (i = 0, il = groups.length; i < il; i++) {
                    group = groups[i];
                    groupMaterial = material[group.materialIndex];
                    start = Math.max(group.start, drawRange.start);
                    end = Math.min(group.start + group.count, drawRange.start + drawRange.count);

                    for (j = start, jl = end; j < jl; j += 3) {
                        a = j;
                        b = j + 1;
                        c = j + 2;
                        intersection = checkBufferGeometryIntersection(
                            this,
                            groupMaterial,
                            raycaster,
                            ray,
                            position as BufferAttribute,
                            uv as BufferAttribute,
                            Math.floor(j / 3),
                            a,
                            b,
                            c,
                        );

                        if (intersection) {
                            intersects.push(intersection);
                        }
                    }
                }
            }
        }
    }
}
