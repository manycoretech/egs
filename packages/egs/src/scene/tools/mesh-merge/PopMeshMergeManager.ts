import { RefCountMap } from '../../../utils/RefCountMap';
import { PopMesh } from '../../drawables/PopMesh';
import { Nullable } from '../../../utils/Utils';
import { _Math } from '../../../math/Math';
import { MergedMeshPhongMaterial } from '../../../elements/materials/mesh/MergedMeshPhongMaterial';
import { PopBufferGeometry } from '../../../elements/geometries/containers/PopBufferGeometry';
import { MeshPhongMaterial } from '../../../elements/materials/mesh/MeshPhongMaterial';
import { PopMeshMerger } from './PopMeshMerger';

const merger = new PopMeshMerger();
function mergePopMesh(mesh: PopMesh): Nullable<MergedMeshData> {
    const mergeResult = merger.merge([mesh]);
    if (mergeResult === null) {
        return null;
    }
    const result = mergeResult[0];
    return {
        geometry: result.geometry,
        material: result.getMaterials() as MergedMeshPhongMaterial[]
    };
}

export interface MergedMeshData {
    geometry: PopBufferGeometry;
    material: MergedMeshPhongMaterial[];
}

export class PopMeshMergeManager {
    private _enabled: boolean = false;
    public checkMap: RefCountMap<string, MergedMeshData> = new RefCountMap(); // map to merged mesh;

    constructor() {
        this.checkMap.onValueRemove = combine => {
            combine.geometry.destroy();
            combine.geometry.removeAndDestroyAttribute('map_index');
            combine.geometry.removeAndDestroyAttribute('uv');
            combine.geometry.index.destroy();
            combine.material.forEach((m: MergedMeshPhongMaterial) => {
                m.destroy();
                m.dataTexture.destroy();
            });
        };
    }

    get enabled() {
        return this._enabled;
    }

    set enabled(value: boolean) {
        this._enabled = value;
        if (!value) {
            this.clear();
        }
    }

    private calculateKey(popMesh: PopMesh) {
        function getSingleMatKey(m: MeshPhongMaterial) {
            return [
                m.side, m.transparent, m.opacity,
                m.polygonOffset, m.polygonOffsetFactor, m.polygonOffsetUnits,
                m.blending, m.blendDst, m.blendDstAlpha, m.blendEquation, m.blendEquationAlpha, m.blendSrc, m.blendSrcAlpha,
                m.color.getSerializeData(),
                ...(m.texture ? [m.texture.uuid, m.uvTransform.getSerializeData()] : []),
            ].join('-');
        }

        const key = popMesh.geometry.uuid + popMesh.getMaterials().map(getSingleMatKey).join('');
        popMesh.popMergeCacheKey = key;
        return key;
    }

    private shouldMerge(mesh: PopMesh): boolean {
        if (!mesh.scene) {
            return false;
        }
        if (mesh.geometry.getGroups().length <= 1) {
            return false;
        }
        if (this.hasAnyComponent(mesh)) {
            return false;
        }

        if (this.hasPolygonOffset(mesh) && !this.checkMaterialsPolygonOffset(mesh)) {
            return false;
        }

        if (mesh.getMaterials().some(m => !m.visible)) {
            return false;
        }

        if (mesh.getMaterials().some(m => m.isOpacityTexUseIndependentUv)) {
            return false;
        }
        return true;
    }

    private hasAnyComponent(mesh: PopMesh): boolean {
        let has = false;
        mesh.forEachMaterial(m => has = has || m.getComponents().length > 0);
        return has;
    }

    private hasPolygonOffset(mesh: PopMesh): boolean {
        let has = false;
        mesh.forEachMaterial(m => has = has || m.polygonOffset);
        return has;
    }

    /**
     * verify the material array of input mesh have same polygonOffset value;
     * @param mesh PopMesh
     * @returns
     */
    private checkMaterialsPolygonOffset(mesh: PopMesh) {
        // every value must be the same as material[0]'s.
        const baseOffsetFactor = mesh.getMaterials()[0].polygonOffsetFactor;
        const baseOffsetUnits = mesh.getMaterials()[0].polygonOffsetUnits;
        const meshMaterials = mesh.getMaterials();
        for (let i = 1; i < meshMaterials.length; i++) {
            if (meshMaterials[i].polygonOffsetFactor !== baseOffsetFactor
                || meshMaterials[i].polygonOffsetUnits !== baseOffsetUnits
                || meshMaterials[i].polygonOffset === false) {
                return false;
            }
        }
        return true;
    }

    public merge(mesh: PopMesh): Nullable<MergedMeshData> {
        if (mesh.popMergeCacheKey !== null) {
            this.checkMap.delete(mesh.popMergeCacheKey);
            mesh.popMergeCacheKey = null;
        }

        if (!this.enabled) {
            return null;
        }

        if (!this.shouldMerge(mesh)) {
            mesh.popMergeCacheKey = null;
            return null;
        }

        const key = this.calculateKey(mesh);
        const preCreated = this.checkMap.getValue(key);
        if (preCreated) {
            this.checkMap.add(key, preCreated);
            return preCreated;
        }

        const newCreated = mergePopMesh(mesh);
        if (!newCreated) {
            return null;
        }
        this.checkMap.add(key, newCreated);
        return newCreated;
    }

    public clear(): void {
        this.checkMap.clear();
    }
}
