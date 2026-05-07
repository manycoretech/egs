import { Clock, SkinnedMesh, EventType, Viewer, IViewerContext, __INNER__ } from '@qunhe/egs';
import { AnimationMixer } from './AnimationMixer';
import { ISkinnedMesh, Skeleton } from './Skeleton';

import ViewerPlugin = __INNER__.ViewerPlugin;

export const SkeletonUpdatedEvent = new EventType();

interface SkeletonBinding {
    mixer: AnimationMixer,
    meshes: SkinnedMesh[],
}

/**
 * A special viewer plugin responsible for animation and skeleton updating.
 */
export class AnimationPlugin implements ViewerPlugin {

    readonly clock = new Clock();
    private mixerList: AnimationMixer[] = [];
    private skeletonMap = new Map<Skeleton, SkeletonBinding>();
    private viewer: Viewer | null = null;

    init() { }
    destroy() { }

    beforeRendering() {
        const deltaTime = this.clock.getDelta();
        if (deltaTime === 0) {
            return;
        }
        for (let i = 0; i < this.mixerList.length; i++) {
            const mixer = this.mixerList[i];
            mixer.update(deltaTime);
        }
        this.skeletonMap.forEach((v, k) => {
            const needUpdate = k.update(isWASM(this.viewer));
            if (needUpdate) {
                v.meshes.forEach(item => item.update());
                v.mixer.emit(SkeletonUpdatedEvent);
            }
        });
    }

    afterRendering() { }

    /**
     * Register this animation plugin to the viewer.
     * @param viewer Viewer or IViewerContext
     */
    registerToViewer(viewer: IViewerContext | Viewer) {
        if (viewer instanceof Viewer) {
            this.viewer = viewer;
        } else {
            this.viewer = viewer.viewer;
        }
        this.viewer.registerPlugin(this);
    }

    /**
     * Register {@link AnimationMixer} into the plugin, then the animation will be updated along with rendering
     * @param mixer
     */
    add(mixer: AnimationMixer) {
        this.mixerList.push(mixer);
    }

    /**
     * Unregister {@link AnimationMixer}
     * @param mixer
     */
    remove(mixer: AnimationMixer) {
        this.mixerList = this.mixerList.filter(item => item !== mixer);
    }

    /**
     * Bind {@link SkinnedMesh} with skeleton and register in animation plugin, then the skeletal animation will be update along with skeleton change.
     * After binding, the {@link SkinnedMesh} can be considered as {@link ISkinnedMesh}
     * @param mesh
     * @param skeleton {@link Skeleton} to be bound
     * @param mixer {@link AnimationMixer} to be bound to listen for events
     */
    bindSkinned(mesh: SkinnedMesh, skeleton: Skeleton, mixer: AnimationMixer) {
        mesh.bind(skeleton.texture);
        const skeletonBinding = this.skeletonMap.get(skeleton) ?? { mixer, meshes:[] };
        skeletonBinding.meshes.push(mesh);
        this.skeletonMap.set(skeleton, skeletonBinding);
        (mesh as ISkinnedMesh).skeleton = skeleton;
    }

    /**
     * Unbind {@link SkinnedMesh}
     * @param mesh
     */
    unbindSkinned(mesh: SkinnedMesh) {
        const skeleton = (mesh as ISkinnedMesh).skeleton;
        if(skeleton !== undefined) {
            const skeletonBinding = this.skeletonMap.get(skeleton);
            if (skeletonBinding) {
                const index = skeletonBinding.meshes.indexOf(mesh);
                if (index !== -1) {
                    skeletonBinding.meshes.splice(index, 1);
                    if (skeletonBinding.meshes.length === 0) {
                        this.skeletonMap.delete(skeleton);
                    }
                }
            }
            (mesh as ISkinnedMesh).skeleton = undefined;
        }
    }
}

function isWASM(viewer: Viewer | null): boolean {
    if (viewer === null) {
        return false;
    }
    const backend = viewer.rendererBackend as string;
    return backend === 'WEBGPU_WASM' || backend === 'WEBGL2_WASM';
}
