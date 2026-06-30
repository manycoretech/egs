import { Object3D } from './Object3D.js';

/**
 * This is almost identical to an {@link Object3D| Object3D }. Its purpose is to make working with groups of objects syntactically clearer.
 * The group node can make its children nodes to do same transformation.
 * It is not a drawable 3D object in scene.
 */
export class Group extends Object3D {
    /**
     * The type of current {@link Object3D| Object3D }.
     */
    type = 'Group';
    /**
     * Used to assert type of this instance.
     */
    isGroup = true;
    /**
     * The name of instance's class.
     */
    className() {
        return 'Group';
    }
}
