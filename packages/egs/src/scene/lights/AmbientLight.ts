import { Light } from './Light';
import { WGLProgram } from '../../renderer/webgl/WGLProgram';
import { Color } from '../../math/Color';

/**
 * This light's color gets applied to all the objects in the scene globally.
 * The color of this light can influence object's natural color.
 */
export class AmbientLight extends Light {
    /**
     * Check the type whether it belongs to PerspectiveCamera.
     * This value should not be changed by user.
     */
    public isAmbientLight = true;
    /**
     * This attribute calculate the final color by {@link intensity | intensity } and {@link color | color }
     */
    public uniformColor = new Color();

    /**
     * The name of instance's class.
     */
    public className() {
        return 'AmbientLight';
    }

    constructor(color?: number | string, intensity?: number) {
        super(color, intensity);
    }
    /**
     * @ignore
     */
    public refreshUniforms() {
        this.uniformColor.copy(this.color).multiplyScalar(this.intensity);
    }
    /**
     * @ignore
     */
    public updateUniforms(program: WGLProgram) {
        program.setUniform('ambientLightColor', this.uniformColor);
    }

    public clone(recursive?: boolean): AmbientLight {
        return new AmbientLight().copy(this, recursive);
    }
}
