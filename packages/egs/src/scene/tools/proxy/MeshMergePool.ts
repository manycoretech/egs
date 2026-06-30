import { ProxyOptimizer } from './ProxyOptimizer.js';
import { type Drawable, DrawableRenderMode } from '../../drawables/Drawable.js';
import { Mesh } from '../../drawables/Mesh.js';
import { MultiMeshMerger } from '../mesh-merge/MultiMeshMerger.js';
import { BufferGeometry } from '../../../elements/geometries/containers/BufferGeometry.js';

let DEFAULT_GEOMETRY: BufferGeometry | undefined;
const merger = new MultiMeshMerger();

export class MeshMergePool extends ProxyOptimizer<Mesh, Mesh> {
    readonly optimizerName = 'multi-merge';

    isSource(d: Drawable): d is Mesh {
        return !!(d as any).mergeKey && d.renderMode === DrawableRenderMode.Default;
    }

    createProxies(list: Mesh[]): Array<[Mesh, Mesh[]]> {
        if (!DEFAULT_GEOMETRY) {
            DEFAULT_GEOMETRY = new BufferGeometry();
        }
        const groupMap = new Map<string, Mesh[]>();
        for (let i = 0; i < list.length; i++) {
            const mesh = list[i];
            const key = `${mesh.mergeKey},${mesh.netLayer.mask}`;
            const group = groupMap.get(key);
            if (group) {
                group.push(mesh);
            } else {
                groupMap.set(key, [mesh]);
            }
        }

        const result: Array<[Mesh, Mesh[]]> = [];
        const groups = Array.from(groupMap.values());
        for (let i = 0; i < groups.length; i++) {
            const group = groups[i];
            if (group.length < 2) {
                continue;
            }
            const source = group[0];
            const mergeResult = merger.merge(group);
            const geometry = mergeResult && mergeResult.length > 0 ? mergeResult[0].geometry : DEFAULT_GEOMETRY!;
            const mesh = new Mesh(geometry, source.getMaterials()[0]);
            mesh.mergeKey = source.mergeKey;
            mesh.layers.mask = source.netLayer.mask;
            mesh.castShadow = source.castShadow;
            mesh.castPlanarShadow = source.castPlanarShadow;
            mesh.updateBoundings();
            result.push([mesh, group]);
        }
        return result;
    }

    isProxySource(p: Mesh, d: Mesh): boolean {
        return p.mergeKey === d.mergeKey && p.layers.mask === d.netLayer.mask;
    }

    updateProxy(p: Mesh, meshes: Mesh[]): void {
        const mergeResult = merger.merge(meshes);
        p.geometry = mergeResult && mergeResult.length > 0 ? mergeResult[0].geometry : DEFAULT_GEOMETRY!;
        p.updateBoundings();
    }

    dropProxyResource(p: Mesh): void {
        p.geometry.freeAllGpuResourceOwned();
    }
}
