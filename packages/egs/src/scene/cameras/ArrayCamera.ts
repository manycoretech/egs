import type { Camera3D } from './Camera3D';
import { ElementEventDispatcher } from '../../utils/EventDispatcher';

/**
 * ArrayCamera can be used in order to efficiently render a scene with a predefined set of cameras. This is an important performance aspect for rendering VR scenes.<br/>
 * An instance of ArrayCamera always has an array of sub cameras. It's mandatory to define for each sub camera the viewport property which determines the part of the viewport that is rendered with this camera.
 * @deprecated use `Viewport` instead.
 */
export class ArrayCamera extends ElementEventDispatcher {
    /**
     * Check the type whether it belongs to ArrayCamera.
     * This value should not be changed by user.
     */
    isArrayCamera = true;
    /**
    * An array of cameras.
    */
    cameras: Camera3D[];

    constructor(arr: Camera3D[] = []) {
        super();
        this.cameras = arr;
    }
}
