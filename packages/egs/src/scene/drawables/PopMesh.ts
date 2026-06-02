import { Nullable } from '../../utils/Utils';
import { Mesh } from './Mesh';
import { MeshPhongMaterial } from '../../elements/materials/mesh/MeshPhongMaterial';
import { PopBufferGeometry } from '../../elements/geometries/containers/PopBufferGeometry';
import { drawableState } from '../../ContentAPI';

/**
 * This is a spacial mesh to draw content in one WebGL Drawcall.
 */
export class PopMesh extends Mesh<MeshPhongMaterial, PopBufferGeometry> {
    /**
     * Check the type whether it belongs to PopMesh.
     */
    readonly isPopMesh = true;
    /**
     * The type of this instance.
     */
    readonly type = 'PopMesh';
    /**
     * Record the LOD level of last update.
    */
    oldLevelFactor = -1;
    /**
     * Record the frame id of last updating LOD level.
    */
    LODUpdateId = -1;
    /**
     * a unique key of the Mesh. When this Mesh is merged, this key will be update.
    */
    popMergeCacheKey: Nullable<string> = null;
    /**
     * Switch of LOD.
     */
    @drawableState()
    isLODEnabled = true;
    /**
     * The name of instance's class.
     */
    className() {
        return 'PopMesh';
    }

    /**
     * @internal
     */
    lodInfo = new Float32Array([1, 1, 0, 0, 0]);

    constructor(geometry: PopBufferGeometry, material: MeshPhongMaterial[]) {
        super(geometry, material);
        this.shouldUseGeometryGroupsWhenOnlyHasOneMaterial = true;
    }

    /**
     * This is an override method to update render data for optimization.
     * This method is used to assign data from {@link geometry| geometry } and {@link material| material } to
     * {@link renderGeometry| renderGeometry } and {@link renderMaterial| renderMaterial }.
     */
    updateRenderEntity() {
        this.oldLevelFactor = -1;
        if (this.geometryChanged || this.materialChanged // this make sure we only care about geo mat change
            || this._renderGeometry === null || this._renderMaterial === null
        ) {
            const scene = this.scene;
            if (scene) {
                const re = scene.renderProxyManager.mergePopMesh(this);
                if (re !== null) {
                    this._renderGeometry = re.geometry;
                    this._renderMaterial = re.material;
                    this.geometry.freeGPU();
                    this.forEachMaterial(m => m.freeGPU());
                } else {
                    this._renderGeometry = this.geometry;
                    this._renderMaterial = this._material;
                }
            } else {
                this._renderGeometry = this.geometry;
                this._renderMaterial = this._material;
            }

        }
    }
    /**
     * Create a clone of this instance.
     */
    clone(): PopMesh {
        return new PopMesh(this.geometry, this._material.slice()).copy(this);
    }

}
