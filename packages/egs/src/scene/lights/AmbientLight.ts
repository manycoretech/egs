import { Light } from './Light.js';
import type { WGLProgram } from '../../renderer/webgl/WGLProgram.js';
import { Color } from '../../math/Color.js';

/**
 * This light's color gets applied to all the objects in the scene globally.
 * The color of this light can influence object's natural color.
 */
export class AmbientLight extends Light {
    /**
     * Check the type whether it belongs to PerspectiveCamera.
     * This value should not be changed by user.
     */
    isAmbientLight = true;
    /**
     * This attribute calculate the final color by {@link intensity | intensity } and {@link color | color }
     */
    uniformColor = new Color();

    /**
     * The name of instance's class.
     */
    className() {
        return 'AmbientLight';
    }

    constructor(color?: number | string, intensity?: number) {
        super(color, intensity);
    }
    /**
     * @internal
     */
    refreshUniforms() {
        this.uniformColor.copy(this.color).multiplyScalar(this.intensity);
    }
    /**
     * @internal
     */
    updateUniforms(program: WGLProgram) {
        program.setUniform('ambientLightColor', this.uniformColor);
    }

    clone(recursive?: boolean): AmbientLight {
        return new AmbientLight().copy(this, recursive);
    }
}
