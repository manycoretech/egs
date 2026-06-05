import { Box3 } from '../math/Box3';
import { Euler } from '../math/Euler';
import { Matrix4 } from '../math/Matrix4';
import { Quaternion } from '../math/Quaternion';
import { Vector3 } from '../math/Vector3';
import { WatchedVector3 } from '../math/WatchedVector3';
import type { Scene3D } from '../scene/Scene3D';
import { EventType, ElementEventDispatcher, type Listener } from '../utils/EventDispatcher';
import type { Deserializer, Serializer, SerializerableDelegatedAsReference } from '../utils/Serialization';
import type { Nullable } from '../utils/Utils';
import { Layers, LayerChangeEvent } from './tools/Layers';
import { TypeAssert } from './tools/TypeAssert';
import { ContentBridge, hasManagedContentAPI, ManagedContentBridge } from '../ContentAPI';

export const Object3DChangeEvent = new EventType();

const position = new Vector3();
const quaternion = new Quaternion();
const scale = new Vector3();

const x = new Vector3(1, 0, 0);
const y = new Vector3(0, 1, 0);
const z = new Vector3(0, 0, 1);

const m1 = new Matrix4();
const target = new Vector3();

function linkRotation(rotation: Euler, _quaternion: Quaternion, onChange: Function) {
    rotation.onChange(() => {
        _quaternion.setFromEuler(rotation, false);
        onChange();
    });
    _quaternion.onChange(() => {
        rotation.setFromQuaternion(_quaternion, undefined, false);
        onChange();
    });
}

let object3DId = 0;
// use number should be safe, if not use bigint.
let worldMatrixUpdateId = 0;
/**
 * This class is a base class of every objects which can be added into scene tree for the 3d rendering.
 * As a basic class, it has implemented event listening and serialization for every objects of scene.
 * Each object has position, rotation and scale attribute to represent the spatial transform in a 3D coordinate.
 */
export class Object3D extends ElementEventDispatcher implements SerializerableDelegatedAsReference {
    /**
     * Every objects in 3D space must have a default up direction.
     * @defaultValue `Vector3(0, 1, 0)`
     */
    static DefaultUp = new Vector3(0, 1, 0);
    /**
     * Unique number for each object3D instance.
     */
    id: number;
    /**
     * Reserved attribute
     */
    categoryId = 'unmarked';
    /**
     * Record the object rendered as instance or other type.
     */
    sourceType = 'common';
    /**
     * The scene which this object belong to.
     */
    scene: Nullable<Scene3D> = null;
    /**
     * The number is the frame id which this object is changed or participates change of scene graph.
     * If this value equals to frame id - 1,
     * @defaultValue `-1` means no change happen
     */
    updateDirtyId: number = -1;
    /**
     * The name of this object, it is empty if useless.
     */
    name = '';
    /**
     * Used to check type of this or extended instance.
     * This value should not be changed by user.
     */
    isObject3D = true;
    /**
     * The name of instance's class.
     */
    className() {
        return 'Object3D';
    }
    /**
     * Object's parent node in the scene graph. An object can have at most one parent.
     */
    parent: Nullable<Object3D> = null;
    /**
     * Array with object's children.
     * @remarks See {@link Group| Group } for information on manually grouping objects.
     */
    children: Object3D[] = [];
    /**
     * This is used by the lookAt method, for example, to determine the orientation of the result.
     * Default is {@link Object3D.DefaultUp| DefaultUp }.
     */
    up = Object3D.DefaultUp.clone();
    /**
     * Record when this object's world matrix last updated.
     */
    worldMatrixUpdateTimestamp: number = 0;
    /**
     * Record whether the object's any {@link attribute| attribute } is updated.
     */
    transformChanged = true;
    visibleChanged = true;
    /**
     * The global transform of the object. If the Object3D has no parent, then it's identical to the local transform matrix.
     */
    matrixWorld = new Matrix4();
    /**
     * When this is set, it calculates the matrixWorld in that frame and resets this property to false.
     * @defaultValue `false`
     */
    matrixWorldNeedsUpdate = false;

    private _netLayer: Layers | undefined;
    /**
     * @internal
     */
    get netLayer(): Layers {
        if (this._netLayer) {
            return this._netLayer;
        }
        let layer: number = (this.netGroupLayer || this.layers).mask;
        if (!this.layers.isDefault) {
            layer &= this.layers.mask;
        }
        this._netLayer = new Layers();
        this._netLayer.mask = layer;
        return this._netLayer;
    }
    private _netInteractionLayer: Layers | undefined;
    /**
     * @internal
     */
    get netInteractionLayer(): Layers {
        if (this._netInteractionLayer) {
            return this._netInteractionLayer;
        }
        let layer: number = (this.interactionLayers || this.netLayer).mask;
        if (this.netGroupLayer) {
            layer &= this.netGroupLayer.mask;
        }
        this._netInteractionLayer = new Layers();
        this._netInteractionLayer.mask = layer;
        return this._netInteractionLayer;
    }

    /**
     * The layer membership of the object. The object is only visible if it has at least one layer in common with the Camera in use.
     */
    private _layer = new Layers();
    get layers() {
        return this._layer;
    }
    set layers(v: Layers) {
        this._layer.off(LayerChangeEvent, this.onLayerChange);
        this._layer = v;
        v.on(LayerChangeEvent, this.onLayerChange);
        this.onLayerChange(0);
    }

    private onLayerChange: Listener<number> = _m => {
        this._netLayer = undefined;
        this.notifySceneChange();
        ContentBridge.sceneNodeSyncLayers(this);
    };

    // layer for interaction.
    private _interactionLayers?: Layers;
    get interactionLayers() {
        return this._interactionLayers;
    }
    set interactionLayers(v) {
        if (this._interactionLayers) {
            this._interactionLayers.off(LayerChangeEvent, this.onInteractionLayerChange);
        }
        this._interactionLayers = v;
        if (v) {
            v.on(LayerChangeEvent, this.onInteractionLayerChange);
        }
        this.onInteractionLayerChange(0);
    }

    private onInteractionLayerChange: Listener<number> = _m => {
        this._netInteractionLayer = undefined;
        this.notifySceneChange();
        ContentBridge.sceneNodeSyncLayers(this);
    };

    // layer for group.
    private _netGroupLayer?: Layers;
    /**
     * @internal
     */
    get netGroupLayer() {
        return this._netGroupLayer;
    }
    /**
     * @internal
     */
    set netGroupLayer(v: Layers | undefined) {
        this._netLayer = undefined;
        this._netInteractionLayer = undefined;
        this._netGroupLayer = v;
        this.notifySceneChange();
        ContentBridge.sceneNodeSyncLayers(this);
    }

    private _groupLayer?: Layers;
    get groupLayer(): Layers | undefined {
        return this._groupLayer;
    }
    set groupLayer(v: Layers | undefined) {
        if (this._groupLayer) {
            this._groupLayer.off(LayerChangeEvent, this.groupLayersListener);
        }
        this._groupLayer = v;
        if (v) {
            v.on(LayerChangeEvent, this.groupLayersListener);
        }
        this.groupLayersListener(0);
    }
    private groupLayersListener: Listener<number> = _v => {
        this.updateGroupLayer();
    };

    private updateGroupLayer(target?: Object3D[]) {
        if (!target) {
            const parentGroupLayer = this.parent?.netGroupLayer;
            let layer: Layers | undefined;
            if (this.groupLayer || parentGroupLayer) {
                layer = new Layers();
                layer.mask = (this.groupLayer ?? parentGroupLayer)!.mask & (parentGroupLayer ?? this.groupLayer)!.mask;
            }
            this.netGroupLayer = layer;
        }

        const objects = target ?? [this];
        for (let i = 0; i < objects.length; i++) {
            objects[i].traverse(o => {
                if (o === this) {
                    return true;
                }
                if (o.groupLayer) {
                    o.updateGroupLayer();
                    return false;
                }
                o.netGroupLayer = this.netGroupLayer;
                return true;
            });
        }
    }

    /**
     * Record if the object is really visible in rendering process. If the Object3D has no parent, it would be set by {@link visible| visible };
     */
    netVisibility = true;
    /**
     * When this is set, it calculates the model matrix in that frame and resets this property to false.
     * @defaultValue `false`
     */
    localMatrixNeedUpdate = false;
    private worldMatrixUpdateId = 0;

    private _visible = true;
    private _position = new WatchedVector3(0, 0, 0);
    private _rotation = new Euler();
    private _scale = new WatchedVector3(1, 1, 1);
    private _quaternion = new Quaternion(); // a vector of x,y,z and w
    protected _matrix = new Matrix4(); // model matrix

    constructor() {
        super();
        this.id = object3DId++;
        const dispatcher = () => {
            this.setMatrixDirty();
        };
        this._position.onChange = dispatcher;
        this._scale.onChange = dispatcher;
        linkRotation(this._rotation, this.quaternion, dispatcher);
        this.layers.on(LayerChangeEvent, this.onLayerChange);
        this.layers.isDefault = true;
        ContentBridge.sceneNodeCreate(this);
    }

    destroy() {
        super.destroy();
        ContentBridge.sceneNodeDestroy(this);
    }

    freeGPU() {
        ContentBridge.sceneNodeFreeGPU(this);
    }

    syncData() {
        ContentBridge.sceneNodeSyncData(this);
    }

    /**
     * A {@link Vector3| vector } representing the object's local position.
     */
    set position(_position: Vector3) {
        (this._position as Vector3).copy(_position);
    }
    get position() {
        return this._position;
    }
    /**
     * Object's local rotation, in radians.
     */
    set rotation(rotation: Euler) {
        this._rotation.copy(rotation);
    }
    get rotation() {
        return this._rotation;
    }
    /**
     * Object's local rotation as a Quaternion.
     * @remarks See {@link Quaternion| Quaternion} for more details.
     */
    set quaternion(_quaternion: Quaternion) {
        this._quaternion.copy(_quaternion);
    }
    get quaternion() {
        return this._quaternion;
    }
    /**
     * The object's local scale.
     * @defaultValue `Vector3( 1, 1, 1 )`
     */
    set scale(_scale: Vector3) {
        (this._scale as Vector3).copy(_scale);
    }
    get scale() {
        return this._scale;
    }
    /**
     * The local transform {@link Matrix4| matrix}.
     */
    get matrix() {
        this.updateMatrix();
        return this._matrix;
    }
    set matrix(value: Matrix4) {
        this._matrix = value;
        this._matrix.decompose(this.position, this.quaternion, this.scale);
        this.localMatrixNeedUpdate = false;
        this.matrixWorldNeedsUpdate = true;
        ContentBridge.sceneNodeSyncMatrix(this);
        this.notifySceneChange();
    }
    /**
     * Object gets rendered if true.
     * @defaultValue `true`
     */
    get visible() {
        return this._visible;
    }
    set visible(value: boolean) {
        if (value !== this._visible) {
            this._visible = value;
            this.notifySceneChange();
            ContentBridge.sceneNodeSyncData(this);
        }
    }
    /**
     * Scene will check the object's visibility in each render and make change {@link netVisibility| netVisibility }
     * based on its and parent's {@link visible| visible }.
     */
    updateVisibility(): boolean {
        if (this.parent === null) {
            if (this.netVisibility !== this.visible) {
                this.netVisibility = this.visible;
                this.scene!.onNodeChanged(this);
                this.visibleChanged = true;
            }
        } else {
            if (this.netVisibility !== (this.parent.netVisibility && this.visible)) {
                this.netVisibility = this.parent.netVisibility && this.visible;
                this.scene!.onNodeChanged(this);
                this.visibleChanged = true;
            }
        }
        return this.visibleChanged;
    }
    /**
     * Set marks of change to false include {@link attributeChanged| attribute }, {@link transformChanged| transform } and {@link visibleChanged| visible }.
     */
    clearChangeMark() {
        this.transformChanged = false;
        this.visibleChanged = false;
    }
    /**
     * If the local matrix is changed, use this method to manually refresh data in scene graph.
     * @tips It's better to use {@link notifySceneChange| notifySceneChange() } as an alternative.
     */
    setMatrixUpdated() {
        this.notifySceneChange();
    }
    /**
     * Use this method to manually refresh data in scene graph and draw again.
     * The engine may not notify every change of the scene.
     * If any effect is not changed with the parameters, use this may solve.
     */
    notifySceneChange() {
        this.emit(Object3DChangeEvent, this);
        if (this.scene !== null) {
            this.scene.onNodeChanged(this);
        }
    }
    /**
     * If the local matrix or world matrix is changed, use this method to make engine refresh data in scene graph automatically.
     * This method will set {@link matrixWorldNeedsUpdate| matrixWorldNeedsUpdate } and {@link localMatrixNeedUpdate| localMatrixNeedUpdate } to true.
     */
    setMatrixDirty() {
        this.matrixWorldNeedsUpdate = true;
        this.localMatrixNeedUpdate = true;
        this.notifySceneChange();
        ContentBridge.sceneNodeSyncMatrix(this);
        if (!this.parent) {
            ContentBridge.sceneNodeUpdate(this);
        }
    }
    /**
     * Change {@link matrixWorldNeedsUpdate| matrixWorldNeedsUpdate } and {@link worldMatrixUpdateTimestamp| worldMatrixUpdateTimestamp } state.
     * This method will refresh data of world matrix by {@link updateMatrixWorld| updateMatrixWorld }
     * @param {number} updateID This number is used to identify the render.
     */
    updateWorldRenderData(updateID: number): boolean {
        if (
            this.matrixWorldNeedsUpdate ||
            (this.parent !== null && this.parent.worldMatrixUpdateTimestamp === updateID)
        ) {
            if (this.scene !== null) {
                this.scene.onNodeChanged(this);
                this.transformChanged = true;
            }

            this.updateMatrixWorld(false);
            this.matrixWorldNeedsUpdate = false;
            this.worldMatrixUpdateTimestamp = updateID;

            if (TypeAssert.isDrawable(this)) {
                this.updateBoundings();
            }
            return true;
        }

        if (TypeAssert.isDrawable(this) && this.worldBoundingDirty) {
            this.updateBoundings();
        }

        return false;
    }
    /**
     * If there are zero or two negative numbers in xyz, return false, otherwise return true.
     */
    isFlipped() {
        this.updateWorldMatrix(true, false);
        const worldMatrix = this.matrixWorld;
        const te = worldMatrix._elements;
        return te[0] * te[5] * te[10] < 0;
    }
    /**
     * Converts the vector from local space to world space.
     * @param {Vector3} vector A vector represents a position in local (object) coordinate.
     */
    localToWorld(vector: Vector3) {
        if (hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
            this.updateWorldMatrix(true, false);
        }
        return vector.applyMatrix4(this.matrixWorld);
    }
    /**
     * Updates the vector from world space to local space.
     * @param {Vector3} vector A vector in world coordinate.
     */
    worldToLocal(vector: Vector3) {
        if (hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
            this.updateWorldMatrix(true, false);
        }
        return vector.applyMatrix4(m1.getInverse(this.matrixWorld));
    }
    /**
     * Applies the matrix transform to the object and updates the object's position, rotation and scale.
     * @param {Matrix4} matrix A matrix represents the information of transform.
     */
    applyMatrix(matrix: Matrix4) {
        this.matrix.multiplyMatrices(matrix, this.matrix);
        this.matrix.decompose(this.position, this.quaternion, this.scale);
        this.setMatrixUpdated();
    }
    /**
     * Applies the rotation represented by the quaternion to the object.
     * @param {Quaternion} q A Quaternion represents the information of rotation.
     */
    applyQuaternion(q: Quaternion) {
        this.quaternion.premultiply(q);
        return this;
    }
    /**
     * Calls {@link Quaternion.setFromAxisAngle| setFromAxisAngle }( axis, angle ) on the Quaternion.
     * @param {Vector3} axis A normalized vector in object space.
     * @param {number} angle Angle in radians.
     */
    setRotationFromAxisAngle(axis: Vector3, angle: number) {
        this.quaternion.setFromAxisAngle(axis, angle);
    }
    /**
     * Calls {@link Quaternion.setRotationFromEuler| setRotationFromEuler }(euler, true) on the Quaternion.
     * @param {Euler} euler Euler angle specifying rotation amount.
     */
    setRotationFromEuler(euler: Euler) {
        this.quaternion.setFromEuler(euler, true);
    }
    /**
     * Calls {@link Quaternion.setFromRotationMatrix| setFromRotationMatrix }(m) on the Quaternion.
     * @param {Matrix4} m Euler angle specifying rotation amount.
     */
    setRotationFromMatrix(m: Matrix4) {
        // assumes the upper 3x3 of m is a pure rotation matrix (i.e, unscaled)
        this.quaternion.setFromRotationMatrix(m);
    }
    /**
     * Copy the given quaternion to object's {@link Object3D.quaternion | quaternion }.
     * @param {Quaternion} q Euler angle specifying rotation amount.
     */
    setRotationFromQuaternion(q: Quaternion) {
        // assumes q is normalized
        this.quaternion.copy(q);
    }
    /**
     * Rotate an object along an axis in object space. The axis is assumed to be normalized.
     * @param {Vector3} axis A normalized vector in object space.
     * @param {number} angle Angle in radians.
     */
    rotateOnAxis(axis: Vector3, angle: number) {
        quaternion.setFromAxisAngle(axis, angle);
        this.quaternion.multiply(quaternion);
        return this;
    }
    /**
     * Rotate an object along an axis in world space. The axis is assumed to be normalized. Method Assumes no rotated parent.
     * @param {Vector3} axis A normalized vector in object space.
     * @param {number} angle Angle in radians.
     */
    rotateOnWorldAxis(axis: Vector3, angle: number) {
        quaternion.setFromAxisAngle(axis, angle);
        this.quaternion.premultiply(quaternion);
        return this;
    }
    /**
     * Rotates the object around x axis in local space.
     * @param {number} angle The angle to rotate in radians.
     */
    rotateX(angle: number) {
        return this.rotateOnAxis(x, angle);
    }
    /**
     * Rotates the object around x axis in local space.
     * @param {number} angle The angle to rotate in radians.
     */
    rotateY(angle: number) {
        return this.rotateOnAxis(y, angle);
    }
    /**
     * Rotates the object around x axis in local space.
     * @param {number} angle The angle to rotate in radians.
     */
    rotateZ(angle: number) {
        return this.rotateOnAxis(z, angle);
    }
    /**
     * Translate an object by distance along an axis in object space. The axis is assumed to be normalized.
     * @param {Vector3} axis A normalized vector in object space.
     * @param {number} distance The distance to translate.
     */
    translateOnAxis(axis: Vector3, distance: number) {
        position.copy(axis).applyQuaternion(this.quaternion);
        this.position.add(position.multiplyScalar(distance));
        return this;
    }
    /**
     * Translates object along x axis in object space by distance units.
     * @param {number} distance The distance to translate.
     */
    translateX(distance: number) {
        return this.translateOnAxis(x, distance);
    }
    /**
     * Translates object along y axis in object space by distance units.
     * @param {number} distance The distance to translate.
     */
    translateY(distance: number) {
        return this.translateOnAxis(y, distance);
    }
    /**
     * Translates object along z axis in object space by distance units.
     * @param {number} distance The distance to translate.
     */
    translateZ(distance: number) {
        return this.translateOnAxis(z, distance);
    }
    /**
     * Rotates the object to face to a point in world space.
     * This method does not support objects having non-uniformly-scaled parent(s)
     * @param {Vector3} _x A vector representing position of target in world space.
     */
    lookAt(_x: Vector3) {
        target.copy(_x);
        const parent = this.parent;
        this.updateWorldMatrix(true, false);
        position.setFromMatrixPosition(this.matrixWorld);
        if (TypeAssert.isCamera3D(this) || TypeAssert.isLight(this)) {
            m1.lookAt(position, target, this.up);
        } else {
            m1.lookAt(target, position, this.up);
        }

        this.quaternion.setFromRotationMatrix(m1);
        if (parent) {
            m1.extractRotation(parent.matrixWorld);
            quaternion.setFromRotationMatrix(m1);
            this.quaternion.premultiply(quaternion.inverse());
        }
    }
    /**
     * Rotates the object to face a point in local space.
     * @param {Vector3} _x A vector representing position of target in local space.
     */
    lookAtLocalPoint(_x: Vector3) {
        target.copy(_x);
        this.updateWorldMatrix(true, false);
        position.copy(this.position);
        if (TypeAssert.isCamera3D(this) || TypeAssert.isLight(this)) {
            m1.lookAt(position, target, this.up);
        } else {
            m1.lookAt(target, position, this.up);
        }
        this.quaternion.setFromRotationMatrix(m1);
    }
    /**
     * Adds object as child of this object.
     * An arbitrary number of objects may be added. Any current parent on an object passed in here will be removed, since an object can have at most one parent.
     * The scene graph change will be immediately notify by engine after adding nodes.
     * @param {Object3D | Object3D[]} o Parameter can be one object or objects array, all of them is added to this object.
     */
    add(o: Object3D | Object3D[]) {
        if (Array.isArray(o)) {
            if (o.length > 0) {
                for (let i = 0; i < o.length; i++) {
                    this.add(o[i]);
                }
            }
            return this;
        }
        const object = o as Object3D;

        if (object.parent !== null) {
            object.parent.remove(object);
        }

        ContentBridge.sceneNodeAdd(this, object);

        if (object === this) {
            throw `object can't be added as a child of itself.`;
        }

        object.parent = this;
        this.children.push(object);

        if (this.netGroupLayer) {
            this.updateGroupLayer([object]);
        }

        if (this.scene !== null) {
            // attach to scene
            if (object.scene !== null) {
                throw 'object has attached to another scene, remove it before add to another one';
            } else {
                object.traverse(ob => ob.onSelfAttachingScene(this.scene!));
            }
        } else {
            if (object.scene !== null) {
                throw 'object to add has attached to some scene, remove it before add';
            }
        }

        object.notifySceneChange();
        object.matrixWorldNeedsUpdate = true; //  trigger sub tree matrix update

        return this;
    }
    /**
     * Remove the specified object form children.
     * @param {Object3D} object The object which needs to be removed.
     */
    remove(object: Object3D) {
        const index = this.children.indexOf(object);
        if (index !== -1) {
            ContentBridge.sceneNodeRemove(this, object);
            this.children.splice(index, 1);

            const parent = object.parent;
            if (parent !== null) {
                parent.notifySceneChange();
            }
            object.parent = null;

            if (this.netGroupLayer) {
                this.updateGroupLayer([object]);
            }

            if (object.scene !== null) {
                const scene = object.scene;
                object.traverse(ob => ob.onSelfDetachingScene(scene));
            }
        }
        return this;
    }

    removeFromParent() {
        if (this.parent) {
            this.parent.remove(this);
        }
    }
    /**
     * Remove all children of this object.
     */
    removeAllChildren(): Object3D[] {
        const removedChildren = this.children.slice();
        while (this.children.length > 0) {
            this.remove(this.children[0]);
        }
        return removedChildren;
    }
    /**
     * Remove all children in specified objects from this objects.
     * Migrate from tools common
     * @param {Object3D[]} objects An array of objects which need to be removed.
     */
    removeObjects(objects: Object3D[]) {
        const objectSet = new Set(objects);
        objectSet.forEach(obj => {
            this.remove(obj);
        });
        return this;
    }

    /**
     * Searches through an object and its children, starting with the object itself, and returns the first with a matching id.
     * Note that ids are assigned in chronological order: 1, 2, 3, ..., incrementing by one for each new object.
     * @param {number} id Unique number of the object instance.
     */
    getObjectById(id: number): Object3D {
        return this.getObjectByProperty('id', id);
    }
    /**
     * Searches through an object and its children, starting with the object itself, and returns the first with a matching name.
     * Note that for most objects the name is an empty string by default. You will have to set it manually to make use of this method.
     * @param {string} name String to match to the children's Object3D.name property.
     */
    getObjectByName(name: string): Object3D {
        return this.getObjectByProperty('name', name);
    }
    /**
     * Searches through an object and its children, starting with the object itself, and returns the first with a property that matches the value given.
     * @param {string} name The property name to search for.
     * @param {any} value Value of the given property.
     */
    getObjectByProperty(name: string, value: any): Object3D {
        if ((this as any)[name] === value) {
            return this;
        }
        for (let i = 0, l = this.children.length; i < l; i++) {
            const child = this.children[i];
            const object = child.getObjectByProperty(name, value);
            if (object !== undefined) {
                return object;
            }
        }
        return undefined as any;
    }
    /**
     * Return a vector representing the position of the object in world space.
     * @param {string} target the result will be copied into this Vector3.
     */
    getWorldPosition(target: Vector3) {
        this.updateMatrixWorld(true);
        return target.setFromMatrixPosition(this.matrixWorld);
    }
    /**
     * Return a quaternion representing the rotation of the object in world space.
     * @param {string} target the result will be copied into this Quaternion.
     */
    getWorldQuaternion(target: Quaternion) {
        this.updateMatrixWorld(true);
        this.matrixWorld.decompose(position, target, scale);
        return target;
    }
    /**
     * Return a vector of the scaling factors applied to the object for each axis in world space.
     * @param {string} target the result will be copied into this Vector3.
     */
    getWorldScale(target: Vector3) {
        this.updateMatrixWorld(true);
        this.matrixWorld.decompose(position, quaternion, target);
        return target;
    }
    /**
     * Return a vector representing the direction of object's positive z-axis in world space.
     * @param {string} target the result will be copied into this Vector3.
     */
    getWorldDirection(target: Vector3) {
        this.updateMatrixWorld(true);
        const e = this.matrixWorld._elements;
        return target.set(e[8], e[9], e[10]).normalize();
    }
    /**
     * Execute the callback on this object and all descendants.
     * @param {function} callback A function with as first argument an object3D object.
     */
    traverse(callback: (object: Object3D) => any | false) {
        const result = callback(this);
        if (result === false) {
            return;
        }
        const children = this.children;
        for (let i = 0, l = children.length; i < l; i++) {
            children[i].traverse(callback);
        }
    }
    /**
     * Execute the callback when return is false, stop traverse the object's descendants.
     * @param {function} callback A function with as first argument an object3D object, return boolean.
     */
    traverseWithChildrenSkip(callback: (object: Object3D) => boolean) {
        const visitChild = callback(this);
        if (!visitChild) {
            return;
        }
        const children = this.children;
        for (let i = 0, l = children.length; i < l; i++) {
            children[i].traverseWithChildrenSkip(callback);
        }
    }
    /**
     * Execute the callback on this object and all descendants which is visible.
     * @param {function} callback A function with as first argument an object3D object.
     */
    traverseVisible(callback: (object: Object3D) => any) {
        if (this.visible === false) {
            return;
        }
        callback(this);
        const children = this.children;
        for (let i = 0, l = children.length; i < l; i++) {
            children[i].traverseVisible(callback);
        }
    }
    /**
     * Execute the callback on this object and all ancestors.
     * @param {function} callback A function with as first argument an object3D object.
     */
    traverseAncestors(callback: (object: Object3D) => any) {
        const parent = this.parent;
        if (parent !== null) {
            callback(parent);
            parent.traverseAncestors(callback);
        }
    }
    /**
     * Update the matrix local transform.
     */
    updateMatrix() {
        if (this.localMatrixNeedUpdate) {
            this._matrix.compose(this.position, this.quaternion, this.scale);
            this.matrixWorldNeedsUpdate = true;
            this.localMatrixNeedUpdate = false;
        }
    }
    /**
     * Update the object's and its descendants' matrix of global transform with.
     * If the parameter or {@link Object3D.matrixWorldNeedsUpdate| matrixWorldNeedsUpdate } is true, matrix will not skip updates.
     * @param {boolean} force Whether or not force to updates the matrix.
     */
    updateMatrixWorld(force?: boolean) {
        this.updateWorldMatrix(false, true, force);
    }

    /**
     * Update the object's and its descendants' matrix of global transform with. will update parent or children according to the parameters
     * @param updateParents update parents.
     * @param updateChildren update children.
     * @param force Whether or not force to updates the matrix.
     */
    updateWorldMatrix(updateParents: boolean, updateChildren: boolean, force: boolean = false) {
        const parent = this.parent;
        let parentUpdated = false;
        let selfUpdated = false;
        if (updateParents && parent !== null) {
            parent.updateWorldMatrix(true, false, force);
        }

        if (parent && parent.worldMatrixUpdateId >= this.worldMatrixUpdateId) {
            parentUpdated = true;
        }

        this.updateMatrix();

        if (parentUpdated || this.matrixWorldNeedsUpdate || force) {
            if (this.parent === null) {
                this.matrixWorld.copy(this.matrix);
            } else {
                this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
            }
            selfUpdated = true;
            worldMatrixUpdateId++;
            this.worldMatrixUpdateId = worldMatrixUpdateId;
        }
        // update children
        if (updateChildren) {
            const children = this.children;
            for (let i = 0, l = children.length; i < l; i++) {
                children[i].updateWorldMatrix(false, true, selfUpdated || force);
            }
        }

        if (hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
            // we should clear this mark, when wasm update enabled, because updateWorldRenderData wall not call.
            this.matrixWorldNeedsUpdate = false;
        }
    }
    /**
     * Get the whole bounding box of current object cover all children's.
     * @param {Box3} localBox If this is not undefined, result will be stored to it.
     */
    getLocalBounds(localBox = new Box3()) {
        localBox.makeEmpty();
        this.updateWorldMatrix(true, true);
        const inverseMatrixWorld = new Matrix4().getInverse(this.matrixWorld);
        const m = new Matrix4();
        const box = new Box3();
        this.traverse(o => {
            if (TypeAssert.isSkinnedMesh(o)) {
                box.copy(o.getBoundingBox());
            } else if (TypeAssert.isDrawable(o)) {
                box.copy(o.geometry.getBoundingBox());
            } else {
                return;
            }
            m.multiplyMatrices(inverseMatrixWorld, o.matrixWorld);
            localBox.union(box.applyMatrix4(m));
        });
        return localBox;
    }
    /**
     * Get UUID of this object instance.
     * This value is automatically assigned, so this shouldn't be edited.
     */
    getUUID() {
        return this.uuid;
    }
    /**
     * Store the attributes of this class into string as serializing format.
     * @param {Serializer} ctx this parameter has not supported external Serializer yet.
     * It may cause that this method can not be used directly.
     */
    serialize(ctx: Serializer) {
        ctx.puts<Object3D>(['name', 'visible', 'layers', 'matrix', 'children']);
    }
    /**
     * Parse the data for this class from string according to serializing format.
     * @param {Deserializer} ctx this parameter has not supported external Deserializer yet.
     * It may cause that this method can not be used directly.
     */
    deserialize(ctx: Deserializer) {
        ctx.reads<Object3D>(['name', 'visible', 'matrix', 'children']);
        // this should set manually, because the layer not support setter and wasm not sync change
        this.layers.setSerializeData(ctx.readCustom('layers'));
        this.matrix.decompose(this.position, this.quaternion, this.scale);
    }
    /**
     * Return a cloned instance of this class and optionally all descendants.
     * @param {boolean} recursive if true, descendants of the object are also cloned. Default is true.
     */
    clone(recursive?: boolean) {
        return new Object3D().copy(this, recursive);
    }
    /**
     * Copy the data to this object from source.
     * This method need override in derived classes to copy extended data.
     * @param {Object3D} source the data source.
     * @param {boolean} recursive if true, descendants of the object are also cloned. Default is true.
     */
    copy(source: Object3D, recursive?: boolean) {
        if (recursive === undefined) {
            recursive = true;
        }
        this.name = source.name;
        this.up.copy(source.up);
        this.position.copy(source.position);
        this.quaternion.copy(source.quaternion);
        this.scale.copy(source.scale);
        this.matrix.copy(source.matrix);
        this.matrixWorld.copy(source.matrixWorld);
        this.layers = source.layers.clone();
        this.interactionLayers = source.interactionLayers?.clone();
        this.groupLayer = source.groupLayer?.clone();
        this.visible = source.visible;

        if (recursive === true) {
            for (let i = 0; i < source.children.length; i++) {
                const child = source.children[i];
                this.add(child.clone());
            }
        }
        return this;
    }

    protected onSelfAttachingScene(scene: Scene3D) {
        this.scene = scene;
        this.scene.onNodeAdd(this);
    }

    protected onSelfDetachingScene(scene: Scene3D) {
        scene.onNodeDelete(this);
        this.scene = null;
    }
}

export abstract class CombinedObjectGroup extends Object3D {
    abstract destroyCombined(): void;
}
