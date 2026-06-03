import type { Camera3D } from '../../scene/cameras/Camera3D';
import { Vector2 } from '../../math/Vector2';
import { Vector3 } from '../../math/Vector3';
import type { Drawable } from '../../scene/drawables/Drawable';

export enum BuiltInUniformTypes {
    resolution,
    cameraPosition,
    normalMatrix,
    viewMatrix,
    modelMatrix,
    modelViewMatrix,
    projectionMatrix,
    lodInfo,
    boneTexture,
    boneTextureSize,
}

export class BuiltInUniforms {
    currentCamera: Camera3D;
    currentDrawable: Drawable;
    resolution: Vector2;
    cameraPosition: Vector3;
    isDrawableStaticChange: boolean;

    constructor() {
        this.currentCamera = null!;
        this.currentDrawable = null!;
        this.isDrawableStaticChange = false;
        this.resolution = new Vector2();
        this.cameraPosition = new Vector3();
    }

    reset() {
        this.currentCamera = null!;
        this.currentDrawable = null!;
    }
}
