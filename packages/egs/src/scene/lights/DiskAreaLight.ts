import { WGLProgram } from '../../renderer/webgl/WGLProgram';
import { Color } from '../../math/Color';
import { Vector3 } from '../../math/Vector3';
import { createShaderBlock } from '../../renderer/shader/builders/ShaderBlock';
import { Matrix4 } from '../../math/Matrix4';
import { AreaLight } from './AreaLight';
import { Deserializer, Serializer } from '../../utils/Serialization';
import { lightProperty } from '../../ContentAPI';

const matrix42 = new Matrix4();
const matrix4 = new Matrix4();
export class DiskAreaLight extends AreaLight {
    public isDiskAreaLight = true;
    @lightProperty()
    public width: number;
    @lightProperty()
    public height: number;
    @lightProperty()
    public specularStrength: number;
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
    public className() {
        return 'DiskAreaLight';
    }

    constructor(color: number | string = 0xffffff, intensity: number = 1, width?: number, height?: number, specularStrength?: number) {
        super(color, intensity);
        this.width = width ? width : 100;
        this.height = height ? height : 100;
        this.specularStrength = specularStrength ? specularStrength : 0;
    }

    public copy(source: DiskAreaLight, recursive?: boolean) {
        super.copy(source, recursive);
        this.width = source.width;
        this.height = source.height;
        this.specularStrength = source.specularStrength;
        return this;
    }

    public clone(recursive?: boolean) {
        return new DiskAreaLight().copy(this, recursive);
    }
    /**
     * @internal
     */
    public refreshUniforms(viewMatrix: Matrix4) {
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
    public updateUniformForForward(program: WGLProgram, index: number) {
        this.updateUniformByPrefix(program, `diskAreaLights[${index}]`);
    }

    public updateUniformForDefer(program: WGLProgram) {
        this.updateUniformByPrefix(program, 'diskAreaLight');
        program.setTexture2D('ltc_1', DiskAreaLight.ltc_1_texture);
        program.setTexture2D('ltc_2', DiskAreaLight.ltc_2_texture);
    }

    public updateUniformByPrefix(program: WGLProgram, prefix: string) {
        program.setUniform(prefix + '.halfWidth', this.uniforms.halfWidth);
        program.setUniform(prefix + '.halfHeight', this.uniforms.halfHeight);
        program.setUniform(prefix + '.color', this.uniforms.color);
        program.setUniform(prefix + '.position', this.uniforms.position);
        program.setUniform(prefix + '.specularStrength', this.uniforms.specularStrength);
    }

    public static getHeader(isArray: boolean) {
        if (isArray) {
            return 'uniform DiskAreaLight diskAreaLights[ NUM_DISK_AREA_LIGHTS ];';
        } else {
            return 'uniform DiskAreaLight diskAreaLight;';
        }
    }

    /**
     * @internal
     */
    public static getLightCollectShader() {
        return diskAreaLightCollect;
    }
    /**
     * @internal
     */
    public static getShaderInclude() {
        return diskAreaLightInclude;
    }

    /**
     * @internal
     */
    public deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        ctx.reads<DiskAreaLight>(['width', 'height', 'specularStrength']);
    }
    /**
     * @internal
     */
    public serialize(ctx: Serializer) {
        super.serialize(ctx);
        ctx.puts<DiskAreaLight>(['width', 'height', 'specularStrength']);
    }
}

export const diskAreaLightCollect = `
DiskAreaLight diskAreaLight;

#pragma unroll_loop_start
for ( int i = 0; i < NUM_DISK_AREA_LIGHTS; i ++ ) {
    diskAreaLight = diskAreaLights[ i ];
    RE_Direct_DiskArea( diskAreaLight, geometry, material, reflectedLight );
}
#pragma unroll_loop_end
`;

export const diskAreaLightInclude = createShaderBlock(`
struct DiskAreaLight {
    float specularStrength;
    vec3 color;
    vec3 position;
    vec3 halfWidth;
    vec3 halfHeight;
};
`);
