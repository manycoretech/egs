import { Box3 } from '../../math/Box3';
import { Mesh } from './Mesh';
import { InstancedBufferGeometry } from '../../elements/geometries/containers/InstancedBufferGeometry';
import { InstancedBufferAttribute } from '../../elements/attributes/InstancedBufferAttribute';
import { Camera3D } from '../cameras/Camera3D';
import { logger } from '../../utils/Logger';
import { Matrix4 } from '../../math/Matrix4';
import { Raycaster, type Intersection } from '../tools/Raycaster';
import { Ray } from '../../math/Ray';
import { ContentBridge, hasManagedContentAPI } from '../../ContentAPI';
import { Vector3 } from '../../math/Vector3';
import { BufferGeometryBase } from '../../elements/geometries/containers/BufferGeometry';
import { Object3DChangeEvent } from '../Object3D';
import { Material } from '../../elements/materials/Material';

const tempMat = new Matrix4();
const tempRay = new Ray();
const tempVec3 = new Vector3();

/**
 * A special version of Mesh with instanced rendering supported.
 * Use InstancedMesh if you have to render a large number of objects with the same geometry and material but with different world transformations.
 * The usage of InstancedMesh will help you to reduce the number of draw calls and thus improve the overall rendering performance in your application.
 */
export class InstanceMesh extends Mesh<Material, InstancedBufferGeometry> {
    className() {
        return 'InstanceMesh';
    }

    private bbxMap = new Map<Mesh, Box3>();

    /**
     * @internal
     */
    proxyedMeshes: Mesh[] = [];
    instanceMatrixBuffer = new Float32Array();
    /**
     * @internal
     */
    get firstProxyedMesh() {
        return this.proxyedMeshes[0];
    }
    /**
     * A key mark let engine know this object need be rendered as instance,
     * which should not be changed by the users.
     * @internal
    */
    readonly isInstance = true;
    /**
     * Record the LOD level of last update.
     * @internal
    */
    oldLevelFactor = -1;
    /**
     * Record the frame id of last updating LOD level.
     * @internal
    */
    LODUpdateId = -1;
    /**
     * @internal
     */
    lodInfo = new Float32Array([1, 1, 0, 0, 0]);
    /**
     * @internal
     */
    instancedGeometry: BufferGeometryBase;
    /**
     * @internal
     * max value of the proxyed meshes...
     */
    maxScaleOnAxis = 1.0;

    constructor(meshes: Mesh[]) {
        super();
        if (meshes.length > 0) {
            this.updateSource(meshes);
        }
    }

    private updateInstanceMatrix = (o: Mesh) => {
        const visible = o.visible ? 1 : 0;
        const elements = o.matrixWorld._elements.map(v => v * visible);
        let needUpdate = false;
        const i = this.proxyedMeshes.indexOf(o);
        for (let j = 0; j < elements.length; j++) {
            if (elements[j] !== this.instanceMatrixBuffer[i * 16 + j]) {
                needUpdate = true;
                break;
            }
        }
        if (needUpdate) {
            this.instanceMatrixBuffer.set(o.matrixWorld._elements.map(v => v * visible), i * 16);
            ContentBridge.sceneNodeSyncMatrix(this);
            ContentBridge.sceneNodeUpdate(this);
        }
    };

    /**
     * Update the data which needs be changed according to the camera's state and
     * attributes of {@link Drawable.updateRenderInfo| Drawable} before drawing this object.
     * @param {Camera3D} camera the camera which is used in current frame.
     * @param {number} viewHeight the height of canvas.
     */
    updateRenderInfo(camera: Camera3D, viewHeight: number) {
        if (!this.firstProxyedMesh) {
            logger.unreachable('corrupt instance item');
            return;
        }
        super.updateRenderInfo(camera, viewHeight);
        this.z = Infinity;
        this.proxyedMeshes.forEach(mesh => {
            const bbx = this.bbxMap.get(mesh);
            if (!bbx) {
                return;
            }
            bbx.getCenterUnsafe(tempVec3);
            tempVec3.sub(camera.position);
            const e = camera.matrixWorld._elements;
            this.z = Math.min(this.z, -(tempVec3.x * e[8] + tempVec3.y * e[9] + tempVec3.z * e[10]));
        });
        this.z = Math.max(1e-6, this.z);
        this.firstProxyedMesh.updateRenderInfo(camera, viewHeight);
        this.frontFaceCW = this.firstProxyedMesh.frontFaceCW;
    }

    updateSource(meshes: Mesh[]) {
        const contentAPI = hasManagedContentAPI();
        if (contentAPI) {
            this.proxyedMeshes.forEach(item => item.off(Object3DChangeEvent, this.updateInstanceMatrix));
        }
        const proxyedMeshes = this.proxyedMeshes = Array.from(new Set(meshes));
        if (contentAPI) {
            this.instanceMatrixBuffer = new Float32Array(proxyedMeshes.length * 16);
            for (let i = 0; i < proxyedMeshes.length; i++) {
                const item = proxyedMeshes[i];
                item.updateMatrixWorld();
                item.updateVisibility();
                const visible = item.netVisibility ? 1 : 0;
                this.instanceMatrixBuffer.set(item.matrixWorld._elements.map(v => v * visible), i * 16);
                item.on(Object3DChangeEvent, this.updateInstanceMatrix);
            }
        }

        const firstMesh = this.firstProxyedMesh;
        this.categoryId = firstMesh.categoryId;
        this.enableViewIndependentScale = firstMesh.enableViewIndependentScale;
        this.viewIndependentScale = firstMesh.viewIndependentScale;
        this.castPlanarShadow = firstMesh.castPlanarShadow;
        this.castShadow = firstMesh.castShadow;
        this.outlineShadingMode = firstMesh.outlineShadingMode;
        this.outlineRenderMode = firstMesh.outlineRenderMode;
        this.renderOrder = firstMesh.renderOrder;
        this.useOriginMaterialInTransparentMode = firstMesh.useOriginMaterialInTransparentMode;
        this.shouldUseGeometryGroupsWhenOnlyHasOneMaterial = firstMesh.shouldUseGeometryGroupsWhenOnlyHasOneMaterial;
        this.layers.mask = firstMesh.netLayer.mask;
        this.setMaterials(firstMesh.renderMaterial);

        const instanceGeometry = new InstancedBufferGeometry();
        const geometry = firstMesh.renderGeometry;
        const attributes = geometry.attributes;
        // create all the attributes for instance mesh, reuse the cpu data
        instanceGeometry.index = geometry.index;
        if (attributes.position) {
            instanceGeometry.addAttribute('position', attributes.position);
        }
        if (attributes.normal) {
            instanceGeometry.addAttribute('normal', attributes.normal);
        }
        if (attributes.uv) {
            instanceGeometry.addAttribute('uv', attributes.uv);
        }
        // map_index is used for merged pop buffer
        if (attributes.map_index) {
            instanceGeometry.addAttribute('map_index', attributes.map_index);
        }
        instanceGeometry.setGroups(geometry.getGroups()
            .map(v => ({ count: v.count, materialIndex: v.materialIndex, start: v.start })));
        this.geometry = instanceGeometry;
        this.instancedGeometry = geometry;
        this.updateRenderEntity();
    }

    private updateTransforms(): void {
        const { proxyedMeshes, geometry, instancedGeometry, worldBoundingBox, bbxMap } = this;

        // drop gpu data
        this.geometry.freeAllGpuResourceOwned();

        const instanceCount = proxyedMeshes.length;
        const mcol0 = new Float32Array(instanceCount * 3);
        const mcol1 = new Float32Array(instanceCount * 3);
        const mcol2 = new Float32Array(instanceCount * 3);
        const mcol3 = new Float32Array(instanceCount * 3);
        // gl_InstanceID unsupported in webgl1
        const instanceId = new Float32Array(instanceCount);

        bbxMap.clear();
        worldBoundingBox.makeEmpty();
        this.maxScaleOnAxis = 0;

        const elements = tempMat._elements;
        for (let i = 0; i < instanceCount; i++) {
            const mesh = proxyedMeshes[i];

            if (!mesh.netVisibility) {
                continue;
            }

            mesh.updateMatrixWorld();
            mesh.updateVisibility();
            tempMat.multiplyMatrices(this.matrixWorld, mesh.matrixWorld);

            mcol0[i * 3] = elements[0];
            mcol0[i * 3 + 1] = elements[1];
            mcol0[i * 3 + 2] = elements[2];
            mcol1[i * 3] = elements[4];
            mcol1[i * 3 + 1] = elements[5];
            mcol1[i * 3 + 2] = elements[6];
            mcol2[i * 3] = elements[8];
            mcol2[i * 3 + 1] = elements[9];
            mcol2[i * 3 + 2] = elements[10];
            mcol3[i * 3] = elements[12];
            mcol3[i * 3 + 1] = elements[13];
            mcol3[i * 3 + 2] = elements[14];
            instanceId[i] = i + 1;

            this.maxScaleOnAxis = Math.max(this.maxScaleOnAxis, tempMat.getMaxScaleOnAxis());
            const tempBox = instancedGeometry.getBoundingBox().clone().applyMatrix4(tempMat);
            worldBoundingBox.union(tempBox);
            bbxMap.set(mesh, tempBox);
        }
        if (this.maxScaleOnAxis === 0) {
            this.maxScaleOnAxis = 1;
        }

        geometry.addAttribute('mcol0', new InstancedBufferAttribute(mcol0, 3));
        geometry.addAttribute('mcol1', new InstancedBufferAttribute(mcol1, 3));
        geometry.addAttribute('mcol2', new InstancedBufferAttribute(mcol2, 3));
        geometry.addAttribute('mcol3', new InstancedBufferAttribute(mcol3, 3));
        if (!hasManagedContentAPI()) {
            geometry.addAttribute('instanceId', new InstancedBufferAttribute(instanceId, 1));
        }
        geometry.instancedCount = instanceCount;
        worldBoundingBox.getBoundingSphere(this.worldBoundingSphere);

        // update the instance matrix buffer for wasm
        if (hasManagedContentAPI()) {
            proxyedMeshes.forEach(m => this.updateInstanceMatrix(m));
        }
    }

    /**
     * Update the rendering date from this instance.
    */
    updateRenderEntity() {
        this.oldLevelFactor = -1;
        this.updateTransforms();
        super.updateRenderEntity();
    }

    /**
     * Clear the rendering data of engine.
    */
    updateInstance() {
        this.resetRenderEntity();
        this.updateRenderEntity();
    }

    raycastJsImpl(raycaster: Raycaster, intersects: Intersection[]) {
        const r = raycaster.ray;
        raycaster.ray = tempRay.copy(r).applyMatrix4(tempMat.getInverse(this.matrixWorld));
        this.proxyedMeshes.forEach((mesh, index) => {
            const itemIntersects: Intersection[] = [];
            mesh.raycast(raycaster, itemIntersects);
            itemIntersects.forEach(itemIntersect => {
                itemIntersect.instanceIndex = index;
                itemIntersect.object = this;
                intersects.push(itemIntersect);
            });
        });
        raycaster.ray = r;
    }

    destroy() {
        if (hasManagedContentAPI()) {
            this.proxyedMeshes.forEach(item => item.off(Object3DChangeEvent, this.updateInstanceMatrix));
        }
        super.destroy();
    }

    clone(recursive?: boolean): InstanceMesh {
        const result = new InstanceMesh(this.proxyedMeshes);
        const geom = result.geometry;
        result.copy(this, recursive);
        result.geometry = geom;
        return result;
    }
}
