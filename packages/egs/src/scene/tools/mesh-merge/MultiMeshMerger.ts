import { Mesh } from '../../drawables/Mesh.js';
import { TypeAssert } from '../TypeAssert.js';
import type { Drawable } from '../../drawables/Drawable.js';
import { DrawcallMerger, type MergeDrawcallSource } from './Merger.js';
import type { BufferGeometry } from '../../../elements/geometries/containers/BufferGeometry.js';
import type { Material } from '../../../elements/materials/Material.js';
import type { GeometryBase } from '../../../elements/geometries/containers/GeometryBase.js';
import { logger } from '../../../utils/Logger.js';
import { mergeBufferGeometries } from '../../../elements/geometries/operators/Index.js';

export class MultiMeshMerger extends DrawcallMerger<Mesh, Material, BufferGeometry> {
    downcastInputDrawable(input: Drawable): input is Mesh {
        return TypeAssert.isMesh(input);
    }

    downcastInputMaterial(_: Material): _ is Material {
        return true;
    }

    downcastInputGeometry(input: GeometryBase): input is BufferGeometry {
        return TypeAssert.isBufferGeometry(input);
    }

    decideNextDrawcall(drawcall: MergeDrawcallSource<Mesh, Material, BufferGeometry>): void {
        if (this.mergeGroup.length === 0) {
            this.mergeGroup.push([]);
        }
        const lastGroup = this.mergeGroup[this.mergeGroup.length - 1];
        lastGroup.push(drawcall);
    }

    extraCheck(inputs: Drawable[]) {
        const geometryLayout = inputs[0].geometry.getAttributeLayoutKey();
        for (let i = 0; i < inputs.length; i++) {
            const mesh = inputs[i];
            if (mesh.getMaterialCount() !== 1) {
                logger.unsupported('only support single material in pure mesh merge');
                return false;
            }
            if (mesh.geometry.getGroups().length > 1) {
                logger.unsupported('only support single group in pure mesh merge');
                return false;
            }
            if (mesh.geometry.getAttributeLayoutKey() !== geometryLayout) {
                logger.unsupported('geometry layout miss, refuse to merge');
                return false;
            }
        }
        return true;
    }

    mergeImpl(group: Array<MergeDrawcallSource<Mesh, Material, BufferGeometry>>): Mesh | null {
        const material = group[0].material as Material;
        const filtered = group.filter(g => g.drawable.netVisibility);
        if (filtered.length > 0) {
            const geometry = mergeBufferGeometries(
                filtered.map(g => g.geometry),
                true,
                filtered.map(g => g.drawable.matrixWorld),
            );
            return new Mesh(geometry, material);
        } else {
            return null;
        }
    }
}
