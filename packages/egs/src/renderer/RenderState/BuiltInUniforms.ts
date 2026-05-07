import { Camera3D } from '../../scene/cameras/Camera3D';
import { Vector2 } from '../../math/Vector2';
import { Vector3 } from '../../math/Vector3';
import { Drawable } from '../../scene/drawables/Drawable';

export const enum BuiltInUniformTypes {
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
    public currentCamera: Camera3D;
    public currentDrawable: Drawable;
    public resolution: Vector2;
    public cameraPosition: Vector3;
    public isDrawableStaticChange: boolean;

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
