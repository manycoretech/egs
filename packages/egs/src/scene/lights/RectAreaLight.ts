import { Color } from '../../math/Color.js';
import { Matrix4 } from '../../math/Matrix4.js';
import { Vector3 } from '../../math/Vector3.js';
import { createShaderBlock } from '../../renderer/shader/builders/ShaderBlock.js';
import type { WGLProgram } from '../../renderer/webgl/WGLProgram.js';
import type { Deserializer, Serializer } from '../../utils/Serialization.js';
import { AreaLight } from './AreaLight.js';
import { lightProperty } from '../../ContentAPI.js';

const matrix42 = new Matrix4();
const matrix4 = new Matrix4();

/**
 * RectAreaLight emits light uniformly across the face a rectangular plane.
 * This light type can be used to simulate light sources such as bright windows or strip lighting.
 */
export class RectAreaLight extends AreaLight {
    isRectAreaLight = true;
    @lightProperty()
    width: number;
    @lightProperty()
    height: number;
    @lightProperty()
    specularStrength: number;
    private uniforms = {
        position: new Vector3(),
        color: new Color(),
        halfWidth: new Vector3(),
        halfHeight: new Vector3(),
        specularStrength: 0,
    };

    /**
     * The name of instance's class.
     */
    className() {
        return 'RectAreaLight';
    }
    /**
     * @param color (optional) hexadecimal color of the light. Default is 0xffffff (white).<br/>
     * @param intensity (optional) the light's intensity, or brightness. Default is 1.<br/>
     * @param width (optional) width of the light. Default is 10.<br/>
     * @param height (optional) height of the light. Default is 10.<br/>
     */
    constructor(
        color: number | string = 0xffffff,
        intensity: number = 1,
        width?: number,
        height?: number,
        specularStrength?: number,
    ) {
        super(color, intensity);
        this.width = width ? width : 100;
        this.height = height ? height : 100;
        this.specularStrength = specularStrength ? specularStrength : 0;
    }

    copy(source: RectAreaLight, recursive?: boolean) {
        super.copy(source, recursive);
        this.width = source.width;
        this.height = source.height;
        this.specularStrength = source.specularStrength;
        return this;
    }

    clone(recursive?: boolean) {
        return new RectAreaLight().copy(this, recursive);
    }
    /**
     * @internal
     */
    refreshUniforms(viewMatrix: Matrix4) {
        this.uniforms.color.copy(this.color).multiplyScalar(this.intensity);
        this.uniforms.position.setFromMatrixPosition(this.matrixWorld).applyMatrix4(viewMatrix);
        this.uniforms.halfWidth.set(this.width * 0.5, 0, 0);
        this.uniforms.halfHeight.set(0, 0, this.height * 0.5);
        this.uniforms.specularStrength = this.specularStrength;
        matrix42.identity();
        matrix4.copy(this.matrixWorld);
        matrix4.premultiply(viewMatrix);
        matrix42.extractRotation(matrix4);
        this.uniforms.halfWidth.applyMatrix4(matrix42);
        this.uniforms.halfHeight.applyMatrix4(matrix42);
    }
    /**
     * @internal
     */
    updateUniformForForward(program: WGLProgram, index: number) {
        this.updateUniformByPrefix(program, `rectAreaLights[${index}]`);
    }

    /**
     * @internal
     */
    updateUniformForDefer(program: WGLProgram) {
        this.updateUniformByPrefix(program, 'rectAreaLight');
        program.setTexture2D('ltc_1', RectAreaLight.ltc_1_texture);
        program.setTexture2D('ltc_2', RectAreaLight.ltc_2_texture);
    }

    updateUniformByPrefix(program: WGLProgram, prefix: string) {
        program.setUniform(prefix + '.halfWidth', this.uniforms.halfWidth);
        program.setUniform(prefix + '.halfHeight', this.uniforms.halfHeight);
        program.setUniform(prefix + '.color', this.uniforms.color);
        program.setUniform(prefix + '.position', this.uniforms.position);
        program.setUniform(prefix + '.specularStrength', this.uniforms.specularStrength);
    }

    static getHeader(isArray: boolean) {
        if (isArray) {
            return 'uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];';
        } else {
            return 'uniform RectAreaLight rectAreaLight;';
        }
    }

    /**
     * @internal
     */
    static getLightCollectShader() {
        return rectAreaLightCollect;
    }
    /**
     * @internal
     */
    static getShaderInclude() {
        return rectAreaLightInclude;
    }

    /**
     * @internal
     */
    deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        ctx.reads<RectAreaLight>(['width', 'height', 'specularStrength']);
    }
    /**
     * @internal
     */
    serialize(ctx: Serializer) {
        super.serialize(ctx);
        ctx.puts<RectAreaLight>(['width', 'height', 'specularStrength']);
    }
}

export const rectAreaLightCollect = `
RectAreaLight rectAreaLight;

#pragma unroll_loop_start
for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
    rectAreaLight = rectAreaLights[ i ];
    RE_Direct_RectArea( rectAreaLight, geometry, material, reflectedLight );
}
#pragma unroll_loop_end
`;

export const rectAreaLightInclude = createShaderBlock(`
struct RectAreaLight {
    float specularStrength;
    vec3 color;
    vec3 position;
    vec3 halfWidth;
    vec3 halfHeight;
};
`);
