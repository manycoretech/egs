import { InstanceMesh } from '../../drawables/InstanceMesh.js';
import type { Mesh } from '../../drawables/Mesh.js';
import { type Drawable, DrawableRenderMode } from '../../drawables/Drawable.js';
import type { DrawableSet } from './DrawableSet.js';
import { ProxyOptimizer } from './ProxyOptimizer.js';

export class InstancePool extends ProxyOptimizer<Mesh, InstanceMesh> {
    static isAvailable = true;

    readonly optimizerName = 'instance';

    setEnable(value: boolean, freeRenderables: DrawableSet) {
        super.setEnable(value && InstancePool.isAvailable, freeRenderables);
    }

    isSource(d: Drawable): d is Mesh {
        return !!(d as any).instanceKey && d.renderMode === DrawableRenderMode.Default;
    }

    createProxies(list: Mesh[]): Array<[InstanceMesh, Mesh[]]> {
        const groupMap = new Map<string, Mesh[]>();
        for (let i = 0; i < list.length; i++) {
            const mesh = list[i];
            const key = `${mesh.instanceKey},${mesh.netLayer.mask}`;
            const group = groupMap.get(key);
            if (group) {
                group.push(mesh);
            } else {
                groupMap.set(key, [mesh]);
            }
        }

        const result: Array<[InstanceMesh, Mesh[]]> = [];
        const groups = Array.from(groupMap.values());
        for (let i = 0; i < groups.length; i++) {
            const group = groups[i];
            if (group.length < 2) {
                continue;
            }
            const instanceMesh = new InstanceMesh(group);
            instanceMesh.sourceType = 'instance';
            instanceMesh.instanceKey = group[0].instanceKey;
            result.push([instanceMesh, group]);
        }
        return result;
    }

    isProxySource(p: InstanceMesh, d: Mesh): boolean {
        return p.instanceKey === d.instanceKey && p.layers.mask === d.netLayer.mask;
    }

    updateProxy(p: InstanceMesh, meshes: Mesh[]): void {
        p.proxyedMeshes = Array.from(meshes);
        p.updateInstance();
    }

    dropProxyResource(p: InstanceMesh): void {
        p.geometry.freeAllGpuResourceOwned();
    }
}
