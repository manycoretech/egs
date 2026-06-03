import { ContentBridge, hasManagedContentAPI, ManagedContentBridge } from '../../ContentAPI';
import type { BufferGeometry, TriangleList } from '../../elements/geometries/containers/BufferGeometry';
import type { Material } from '../../elements/materials/Material';
import { Mesh } from './Mesh';
import { Matrix4 } from '../../math/Matrix4';
import { Vector4 } from '../../math/Vector4';
import { Box3 } from '../../math/Box3';
import { Vector3 } from '../../math/Vector3';
import type { Raycaster, Intersection } from '../tools/Raycaster';
import { Ray } from '../../math/Ray';
import { SkinningShaderComponent } from '../../renderer/shader/components/SkinningShaderComponent';
import { Texture2D } from '../../elements/textures/Texture2D';
import type { Nullable } from '../../utils/Utils';
import type { SourceTexture } from '../../elements/textures/SourceTexture';
import { TypeAssert } from '../tools/TypeAssert';

const tempMatrix = new Matrix4();
const tempBox = new Box3();

/**
 * This is a spacial mesh for skeletal mesh.
 */
export class SkinnedMesh<M extends Material = Material, T extends SourceTexture | Texture2D = Texture2D> extends Mesh {

    readonly isSkinnedMesh: boolean = true;

    boneMatricesTexture: Nullable<T> = null;
    boneMatricesBuffer: Nullable<Float32Array> = null;

    private boundingBox: Nullable<Box3> = null;
    private boneBoundingBoxes: Box3[] = [];

    /**
     * @internal
     */
    get boneTextureSize(): number {
        return this.boneMatricesTexture!.width;
    }

    /**
     * @internal
     */
    get boneCount(): number {
        return this.boneMatricesBuffer!.length / 16;
    }

    /**
     * @internal
     */
    get isBound(): boolean {
        return this.boneMatricesTexture !== null;
    }

    constructor(geometry?: BufferGeometry<TriangleList>, material?: M | M[]) {
        super(geometry, material);
        this.type = 'SkinnedMesh';
    }

    /**
     * Special raycast for skinned mesh
     */
    raycastJsImpl(raycaster: Raycaster, intersects: Intersection[]): void {
        if (this.isBound) {
            const boneBox = new Box3();
            const count = this.boneBoundingBoxes.length;
            const ray = new Ray().copy(raycaster.ray).applyMatrix4(tempMatrix.getInverse(this.matrixWorld));
            if (raycaster.ray.intersectBox(this.worldBoundingBox)) {
                for (let i = 0; i < count; ++i) {
                    this.getBoneMatrixAt(tempMatrix, i);
                    boneBox.copy(this.boneBoundingBoxes[i]).applyMatrix4(tempMatrix);
                    const point = ray.intersectBox(boneBox);
                    if (point !== null) {
                        point.applyMatrix4(this.matrixWorld);
                        const distance = raycaster.ray.origin.distanceTo(point);
                        if (distance >= raycaster.near && distance <= raycaster.far) {
                            intersects.push({
                                distance,
                                point,
                                object: this,
                                primitiveIndex: 0,
                            });
                        }
                    }
                }
            }
        } else {
            super.raycastJsImpl(raycaster, intersects);
        }
    }

    /**
     * Copy skinned mesh with shared skeleton.
     */
    copy(source: SkinnedMesh<M, T>, recursive?: boolean): this {
        super.copy(source, recursive);
        this.boneMatricesTexture = source.boneMatricesTexture;
        this.boneMatricesBuffer = source.boneMatricesBuffer;
        this.boneBoundingBoxes = source.boneBoundingBoxes;
        this.boundingBox = source.boundingBox;
        return this;
    }

    /**
     * Clone skinned mesh with shared skeleton.
     */
    clone(recursive?: boolean): SkinnedMesh<M, T> {
        return new SkinnedMesh<M, T>().copy(this, recursive);
    }

    /**
     * Bind skeleton to skinned mesh by bone texture in skeleton
     * @internal
     */
    bind(texture: T) {
        this.boneMatricesTexture = texture;
        if (texture instanceof Texture2D) {
            this.boneMatricesBuffer = (texture as Texture2D).source.main.source as Float32Array;
        } else if (TypeAssert.isSourceTexture(texture)) {
            this.boneMatricesBuffer = texture.getLevelLayerSource(0, 0) as Float32Array;
        }

        this.getMaterials().forEach((m) => {
            m.addComponent(new SkinningShaderComponent());
        });
        if ((hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData())) {
            ContentBridge.skinnedMeshSetSkeleton(this as any);
        } else {
            this.computeBoneBoundingBoxes();
        }
        this.update();
    }

    /**
     * Compute bone bounding boxes in local space for raycast
     */
    private computeBoneBoundingBoxes() {
        const boneCount = this.boneCount;
        const boneBoundingBoxes = Array.from({ length: boneCount }, () => new Box3());
        const position = this.geometry.attributes.position;
        const joints = this.geometry.attributes.joints;
        const weights = this.geometry.attributes.weights;
        const count = position.count;
        const vertex = new Vector3();
        for (let i = 0; i < count; ++i) {
            vertex.fromBufferAttribute(position, i);
            if (weights.getX(i) > Number.EPSILON) {
                boneBoundingBoxes[joints.getX(i)].expandByPoint(vertex);
            }
            if (weights.getY(i) > Number.EPSILON) {
                boneBoundingBoxes[joints.getY(i)].expandByPoint(vertex);
            }
            if (weights.getZ(i) > Number.EPSILON) {
                boneBoundingBoxes[joints.getZ(i)].expandByPoint(vertex);
            }
            if (weights.getW(i) > Number.EPSILON) {
                boneBoundingBoxes[joints.getW(i)].expandByPoint(vertex);
            }
        }
        this.boneBoundingBoxes = boneBoundingBoxes;
    }

    /**
     * Update local bboxes when bones change
     * @internal
     */
    updateLocalBounding() {
        if (this.isBound) {
            if (hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
                this.boundingBox = ManagedContentBridge.meshGetLocalBBox(this);
            } else {
                const localBox = new Box3();
                for (let i = 0; i < this.boneCount; ++i) {
                    tempBox.copy(this.boneBoundingBoxes[i]);
                    this.getBoneMatrixAt(tempMatrix, i);
                    localBox.union(tempBox.applyMatrix4(tempMatrix));
                }
                this.boundingBox = localBox;
            }
        } else {
            this.boundingBox = this.geometry.getBoundingBox();
        }
    }

    updateBoundings(): void {
        if (hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
            this.updateWorldMatrix(true, false);
        }
        this.worldBoundingBox.copy(this.getBoundingBox()).applyMatrix4(this.matrixWorld);
        this.worldBoundingBox.getBoundingSphere(this.worldBoundingSphere); // to opt
        this.worldBoundingDirty = false;
    }

    /**
     * Compute animated position
     */
    applyBoneTransform(index: number, vector: Vector3) {
        const geometry = this.geometry;

        const _joints = new Vector4();
        const _weights = new Vector4();
        const _basePosition = new Vector3();
        const _matrix4 = new Matrix4();
        const _vector3 = new Vector3();

        _joints.fromBufferAttribute(geometry.attributes.joints, index);
        _weights.fromBufferAttribute(geometry.attributes.weights, index);
        _basePosition.copy(vector);

        vector.set(0, 0, 0);
        for (let i = 0; i < 4; i++) {
            const weight = _weights.getComponent(i);
            if (weight !== 0) {
                const boneIndex = _joints.getComponent(i);
                this.getBoneMatrixAt(_matrix4, boneIndex);
                vector.addScaledVector(_vector3.copy(_basePosition).applyMatrix4(_matrix4), weight);
            }
        }
    }

    /**
     * Update bone matrices and local bounding
     */
    update() {
        // better way to get bone matrix in texture?
        ContentBridge.skinnedMeshSyncBoneMatrices(this);
        this.updateLocalBounding();
        this.updateBoundings();
        this.notifySceneChange();
    }

    /**
     * get local bbox which is not only related to geometry
     */
    getBoundingBox(): Box3 {
        if (this.boundingBox === null) {
            this.updateLocalBounding();
        }
        return this.boundingBox!;
    }

    private getBoneMatrixAt(matrix: Matrix4, index: number): void {
        matrix.fromArray(this.boneMatricesBuffer!, index * 16);
    }
}
