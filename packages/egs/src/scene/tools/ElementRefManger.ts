import { type Material, MaterialPropertyChangeEvent } from '../../elements/materials/Material.js';
import type { Drawable } from '../drawables/Drawable.js';
import { RefObjectMap } from '../../utils/RefObjectMap.js';
import {
    type GeometryBase,
    GeometryShapeChanged,
    GeometryContentChanged,
} from '../../elements/geometries/containers/GeometryBase.js';

export class SceneElementRefManager {
    // ref count
    private lastSyncedDrawableRefMaterial: Map<Drawable, Material[]> = new Map();
    materialUsedByDrawable: RefObjectMap<Material, Drawable> = new RefObjectMap();

    private lastSyncedDrawableRefGeometry: Map<Drawable, GeometryBase> = new Map();
    private geometryUsedByDrawable: RefObjectMap<GeometryBase, Drawable> = new RefObjectMap();

    destroy() {
        this.lastSyncedDrawableRefMaterial.forEach((_, d) => {
            d.off(MaterialPropertyChangeEvent, this.onMaterialChanged);
        });
        this.lastSyncedDrawableRefGeometry.forEach((_, d) => {
            d.off(GeometryShapeChanged, this.onGeometryShapeChanged);
            d.off(GeometryContentChanged, this.onGeometryContentChanged);
        });
        this.lastSyncedDrawableRefMaterial.clear();
        this.lastSyncedDrawableRefGeometry.clear();
        this.materialUsedByDrawable.clear();
        this.geometryUsedByDrawable.clear();
    }

    private onMaterialChanged = (m: Material) => {
        this.materialUsedByDrawable.forEachValueByKey(m, d => {
            d.resetRenderEntity();
            d.notifySceneChange();
        });
    };

    private onGeometryShapeChanged = (g: GeometryBase) => {
        this.geometryUsedByDrawable.forEachValueByKey(g, d => {
            d.notifySceneChange();
            d.worldBoundingDirty = true;
        });
    };
    private onGeometryContentChanged = (g: GeometryBase) => {
        this.geometryUsedByDrawable.forEachValueByKey(g, d => {
            d.onReferencedGeometryContentChange();
        });
    };

    removeDrawableGeometryRef(d: Drawable) {
        const lastSynced = this.lastSyncedDrawableRefGeometry.get(d);
        if (lastSynced !== undefined) {
            lastSynced.off(GeometryShapeChanged, this.onGeometryShapeChanged);
            lastSynced.off(GeometryContentChanged, this.onGeometryContentChanged);
            this.geometryUsedByDrawable.delete(lastSynced, d);
            this.lastSyncedDrawableRefGeometry.delete(d);
        }
    }

    removeDrawableMaterialRef(d: Drawable) {
        const lastSynced = this.lastSyncedDrawableRefMaterial.get(d);
        if (lastSynced !== undefined) {
            lastSynced.forEach(m => {
                m.off(MaterialPropertyChangeEvent, this.onMaterialChanged);
                this.materialUsedByDrawable.delete(m, d);
            });
            this.lastSyncedDrawableRefMaterial.delete(d);
        }
    }

    createDrawableGeometryRef(d: Drawable) {
        if (!this.geometryUsedByDrawable.has(d.geometry)) {
            d.geometry.on(GeometryShapeChanged, this.onGeometryShapeChanged);
            d.geometry.on(GeometryContentChanged, this.onGeometryContentChanged);
        }
        this.lastSyncedDrawableRefGeometry.set(d, d.geometry);
        this.geometryUsedByDrawable.add(d.geometry, d);
    }

    createDrawableMaterialRef(d: Drawable) {
        this.lastSyncedDrawableRefMaterial.set(d, d.getMaterials().slice());
        d.forEachMaterial(m => {
            m.on(MaterialPropertyChangeEvent, this.onMaterialChanged);
            this.materialUsedByDrawable.add(m, d);
        });
    }
}
