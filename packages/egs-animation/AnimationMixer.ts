import { EventDispatcher, Matrix3, type MeshPhongMaterial, type Object3D, type ReadonlyMatrix3 } from '@qunhe/egs';
import { AnimationAction } from './AnimationAction';
import type { AnimationClip } from './type';
import type { PropertyMixer } from './PropertyMixer';

/**
 * The class is a player for animations on a particular object called root
 */
export class AnimationMixer extends EventDispatcher {
    private root: Object3D;
    private actions: AnimationAction[] = [];
    private propertyMixerMap = new Map<string, PropertyMixer>();
    private materialSet = new Set<MeshPhongMaterial>();
    private accuIndex = 0;
    private useCache = true;

    /**
     * Constructor
     * @param root animation target.
     * @param useCache optional, default is true. By default, animationAction will be cached with root id and name when clipAction.
     */
    constructor(root: Object3D, useCache: boolean = true) {
        super();
        this.root = root;
        this.useCache = useCache;
    }

    /**
     * Generating {@link AnimationAction} from {@link AnimationClip}.
     * Calling With the same clip name and root, it will always return the same action instance.
     * @param clip
     * @param root optional, default is the root of {@link AnimationMixer}.
     * It is used for searching animation target.
     * @returns
     */
    clipAction(clip: AnimationClip, root: Object3D = this.root): AnimationAction {
        const { actions, propertyMixerMap, materialSet } = this;
        const actionId = AnimationAction.createId(root, clip);
        if (this.useCache) {
            const prev = actions.find(action => action.id === actionId);
            if (prev) {
                return prev;
            }
        }
        const action = new AnimationAction(root, clip, { propertyMixerMap, materialSet }, this);
        actions.push(action);

        return action;
    }

    /**
     * Advance the mixer time and update animation
     * @param deltaTime delta time in seconds
     */
    update(deltaTime: number) {
        const { actions } = this;
        const accuIndex = (this.accuIndex ^= 1);
        for (let i = 0; i < actions.length; i++) {
            const action = actions[i];
            if (!action.active) {
                continue;
            }
            action.update(deltaTime, accuIndex);
        }
        this.apply();
    }

    /**
     * Set the mixer to a specific time and update animation
     * @param time time in seconds
     */
    setTime(time: number) {
        const { actions } = this;
        for (let i = 0; i < actions.length; i++) {
            const action = actions[i];
            action.time = 0;
        }
        this.update(time);
    }

    private apply() {
        const mixers = Array.from(this.propertyMixerMap.values());
        for (let i = 0; i < mixers.length; i++) {
            const mixer = mixers[i];
            mixer.apply(this.accuIndex);
        }
        this.materialSet.forEach(material => {
            if (material.metaData.uvTransformDirty) {
                const { position, scale, rotation } = material.metaData;
                // TODO: to avoid creating new matrix
                const uvTransform = new Matrix3();
                uvTransform.setUVTransform(position.x, position.y, scale.x, scale.y, rotation, 0, 0);
                material.uvTransform = uvTransform as unknown as ReadonlyMatrix3;
                material.notifyMaterialPropertyChanged();
                material.metaData.uvTransformDirty = false;
            }
        });
    }
}
