import {
    type ShaderBuilder,
    ShaderVaryingTypes,
    ShaderInjectionTypes,
} from '../../../renderer/shader/builders/ShaderBuilder.js';
import type { WGLProgram } from '../../../renderer/webgl/WGLProgram.js';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants.js';
import { createShaderBlock } from '../../../renderer/shader/builders/ShaderBlock.js';
import { Side } from '../../../utils/Constants.js';
import { readonlyMath } from '../../../math/Readonly.js';
import { materialProperty } from '../../../ContentAPI.js';
import { BackgroundLikeMaterial } from '../base/index.js';

export class GradientMaterial extends BackgroundLikeMaterial {
    @materialProperty()
    skyColor = readonlyMath.color(0.458, 0.701, 0.864); // sky color
    @materialProperty()
    groundColor = readonlyMath.color(0.97, 0.98, 0.99); // ground color
    @materialProperty()
    power = 0.77; // color weight
    @materialProperty()
    scale = 6.4; // tanh
    @materialProperty()
    offset = 0.7; // gradient threshold offset

    className() {
        return 'GradientMaterial';
    }

    constructor() {
        super();
        this.side = Side.BackSide;
        this.depthWrite = false;
        this.depthTest = false;
    }

    updateShadingUniforms(p: WGLProgram) {
        p.setUniform('skyColor', this.skyColor);
        p.setUniform('groundColor', this.groundColor);
        p.setUniform('power', this.power);
        p.setUniform('scale', this.scale);
        p.setUniform('offset', this.offset);
    }

    extendShaderShading(builder: ShaderBuilder, _: any) {
        builder
            .addUniform('skyColor', WebGLShaderDataType.Vec3)
            .addUniform('groundColor', WebGLShaderDataType.Vec3)
            .addUniform('power', WebGLShaderDataType.Float)
            .addUniform('scale', WebGLShaderDataType.Float)
            .addUniform('offset', WebGLShaderDataType.Float)
            .addVarying(ShaderVaryingTypes.worldPosition)
            .addFragment(GradientFrag)
            .inject(
                ShaderInjectionTypes.gl_FragColor,
                `
                vec3 direction = normalize(vWorldPosition - origin);
                gl_FragColor = vec4(skyShade(direction), 1.0);
            `,
            );
    }

    copy() {
        return this;
    }

    clone() {
        return new GradientMaterial();
    }
}

const GradientFrag = createShaderBlock(`
const vec3 origin = vec3(0.0);

vec3 skyShade(vec3 direction)
{
    vec3 envColor = groundColor + (skyColor - groundColor) * power * (tanh(scale * dot(backgroundUp, direction) - offset) + 1.0);
    return envColor;
}`);
