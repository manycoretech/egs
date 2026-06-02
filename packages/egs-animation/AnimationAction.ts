import { Drawable, EventType, Material, MeshPhongMaterial, Object3D, Vector2 } from '@qunhe/egs';
import { AnimationClip, Blend, Loop } from './type';
import { Interpolant } from './interpolants/Interpolant';
import { PropertyMixer } from './PropertyMixer';
import { parseTrackPath, createInterpolant } from './utils';
import { ISkinnedMesh } from './Skeleton';
import { AnimationMixer } from './AnimationMixer';

export interface ActionCtx {
    propertyMixerMap: Map<string, PropertyMixer>;
    materialSet: Set<MeshPhongMaterial>;
}

export const AnimationFinishEvent = new EventType<{action: AnimationAction}>();

/**
 * An instance schedules the playback of an animation stored in {@link AnimationClip}
 */
export class AnimationAction {
    static createId(root: Object3D, clip: AnimationClip) {
        return `${root.uuid}@${clip.name}`;
    }

    /**
     * Action id = `root.uuid@clip.name`
     */
    readonly id: string;
    /**
     * Name from {@link AnimationClip}
     */
    readonly name: string;
    /**
     * If set to `true`, the action is played. It will be automatically set to `false` when animation stops.
     */
    active: boolean = false; // to opt
    /**
     * If set to `true`, the playback of the action is paused.
     */
    paused: boolean = false;
    /**
     * If set to `true`, the animation will be paused on its last frame.
     * If set to `false`, the animation target will be reset to original state at the end.
     */
    pauseWhenFinished: boolean = true;
    /**
     * The degree of influence of this action for blending with other actions
     */
    weight: number = 1;
    /**
     * Weight factor for time, which can be set to negative.
     */
    speed: number = 1;
    /**
     * local time for this action
     */
    time: number = 0;

    private duration: number;
    private blend: Blend;
    private interpolants: Interpolant[] = [];
    private mixers: PropertyMixer[] = [];
    private animationMixer: AnimationMixer;

    /**
     * Return max time
     */
    get timeDuration() {
        return this.duration;
    }

    constructor(root: Object3D, clip: AnimationClip, ctx: ActionCtx, mixer: AnimationMixer) {
        const { propertyMixerMap, materialSet } = ctx;
        this.name = clip.name;
        this.animationMixer = mixer;
        this.id = AnimationAction.createId(root, clip);
        const { blend: blendMode, tracks } = clip;
        this.blend = blendMode ?? Blend.Normal;

        let duration = 0;
        for (let i = 0; i < tracks.length; i++) {
            const { path, times, values, interpolation } = tracks[i];
            const parsePath = parseTrackPath(path);
            if (!parsePath) {
                continue;
            }

            const { scope, nodeName, propertyName } = parsePath;

            let target: Object3D | Material = root;
            if (nodeName) {
                let nodeTarget: Object3D | Material | undefined;
                if (scope) {
                    const material = getMaterialByName(nodeName, root) as MeshPhongMaterial;
                    if (material !== undefined) {
                        nodeTarget = material;
                        if (!materialSet.has(material)) {
                            // Init
                            material.isOpacityTexUseIndependentUv = true;
                            material.metaData.position = new Vector2();
                            material.metaData.scale = new Vector2(1, 1);
                            material.metaData.rotation = 0;
                            material.metaData.uvTransformDirty = true;
                            materialSet.add(material);
                        }
                    }

                } else {
                    nodeTarget = getNodeByName(nodeName, target);
                }
                if (nodeTarget === undefined) {
                    console.warn('EGS Animation: can not find node: ', nodeName);
                    continue;
                }
                target = nodeTarget;
            }

            let itemSize: number;
            switch (propertyName) {
                case 'rotation':
                    itemSize = 4;
                    break;
                case 'scale':
                case 'translation':
                    itemSize = 3;
                    break;
                case 'uvOffset':
                case 'uvScale':
                    itemSize = 2;
                    break;
                case 'uvRotation':
                    itemSize = 1;
                    break;
            }
            if (itemSize !== (values.length / times.length)) {
                console.warn('EGS Animation: invalid itemSize');
                continue;
            }
            const mixerId = root.uuid + path;
            const mixer = propertyMixerMap.get(mixerId) ?? new PropertyMixer(target, propertyName, itemSize);
            propertyMixerMap.set(mixerId, mixer);
            this.mixers.push(mixer);
            const interpolant = createInterpolant(propertyName, interpolation, times, values, mixer.buffer, itemSize);
            this.interpolants.push(interpolant);
            duration = Math.max(duration, times[times.length - 1]);
        }
        this.duration = duration;
    }

    private loop: Loop = Loop.Repeat;
    private loopCounts: number = 0;
    private repetitions: number = Infinity;

    /**
     * Configures the loop settings for this action
     * @param mode {@link Loop} mode
     * @param repetitions number of repetitions
     * @returns
     */
    setLoop(mode: Loop, repetitions: number) {
        this.loop = mode;
        this.repetitions = repetitions;
        return this;
    }

    /**
     * Reset action
     * @returns
     */
    reset() {
        this.active = false;
        this.paused = false;
        this.time = 0;
        this.loopCounts = 0;
        return this;
    }

    update(deltaTime: number, accuIndex: number) {
        if (!this.active) {
            return;
        }

        const { deactivateNext, time } = this.updateTime(this.paused ? 0 : deltaTime);
        const { blend, weight, interpolants, mixers } = this;
        for (let i = 0; i < interpolants.length; i++) {
            const interpolant = interpolants[i];
            const mixer = mixers[i];
            interpolant.evaluate(time);
            mixer.update(blend, weight, accuIndex);
        }
        if (deactivateNext) {
            if (this.pauseWhenFinished) {
                this.paused = true;
            } else {
                this.active = false;
            }
        }
    }

    private updateTime(deltaTime: number): {deactivateNext: boolean, time: number} {
        const { duration, repetitions } = this;
        if (repetitions <= 0) {
            return {deactivateNext: true, time: this.time};
        }

        if (deltaTime === 0) {
            return {deactivateNext: false, time: this.time};
        }

        let deactivateNext: boolean = false;
        let time = this.time + deltaTime * this.speed;

        // once loop
        if (this.loop === Loop.Once) {
            if (time > duration) {
                time = duration;
                deactivateNext = true;
                this.animationMixer.emit(AnimationFinishEvent, {action: this});
            }
            if (time < 0) {
                time = 0;
                deactivateNext = true;
                this.animationMixer.emit(AnimationFinishEvent, {action: this});
            }
            this.time = time;
            return {deactivateNext, time};
        }

        // repeat loop or pingpong loop
        if (time > duration || time < 0) {
            const loopDelta = Math.floor(time / duration);
            this.loopCounts += loopDelta;
            time -= duration * loopDelta;
        }
        if (this.loopCounts >= repetitions) {
            time = duration;
            deactivateNext = true;
            this.animationMixer.emit(AnimationFinishEvent, {action: this});
        }
        this.time = time;
        if (this.loop === Loop.PingPong && (this.loopCounts % 2 === 1)) {
            time = duration - time;
        }
        return {deactivateNext, time};
    }
}

function getMaterialByName(name: string, node: Object3D): Material | undefined {
    if(node instanceof Drawable) {
        const materials = node.getMaterials();
        for(let i = 0, l = materials.length; i < l; i++ ) {
            if(materials[i].name === name) {
                return materials[i];
            }
        }
    }
    for (let i = 0, l = node.children.length; i < l; i++) {
        const child = node.children[i];
        const object = getMaterialByName(name, child);
        if (object !== undefined) {
            return object;
        }
    }
    return undefined;
}

function getNodeByName(name: string, node: Object3D): Object3D | undefined {
    if (node.name === name) { return node; }
    for (let i = 0, l = node.children.length; i < l; i++) {
        const child = node.children[i];
        const object = getNodeByName(name, child);
        if (object !== undefined) {
            return object;
        }
    }
    const skeleton = (node as ISkinnedMesh).skeleton;
    if(skeleton !== undefined) {
        const object = getNodeByName(name, skeleton.rootBone);
        if (object !== undefined) {
            return object;
        }
    }
    return undefined;
}
