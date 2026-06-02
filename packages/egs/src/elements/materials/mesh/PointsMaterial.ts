import { ColorWithAlpha, type ColorWithAlphaParam } from './LineMaterial';
import { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { ShaderInjectionTypes, ShaderBuilder, ShaderVaryingTypes } from '../../../renderer/shader/builders/ShaderBuilder';
import { Material, type MaterialParameters, type ConvertMaterialParameters } from '../Material';
import { Serializer, Deserializer } from '../../../utils/Serialization';
import { HashKeyBuilder } from '../../../utils/HashKeyBuilder';
import { Utils } from '../../../utils/Utils';
import { ShaderComponentRegistry } from '../../../scene/ShaderComponentRegistry';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';
import { materialProperty, shaderComponentInMaterial } from '../../../ContentAPI';

export type PointsMaterialParameters = MaterialParameters & ColorWithAlphaParam
    & ConvertMaterialParameters<Pick<PointsMaterial, 'size' | 'enableSizeAttenuation'>>;

const keys = ['size', 'enableSizeAttenuation'];
/**
 * This material is specified used to change performance of {@link Points | Points }
 */
export class PointsMaterial extends Material {
    constructor(p?: PointsMaterialParameters) {
        super();
        this.setValues(p);
    }

    setValues(values?: PointsMaterialParameters) {
        if (values === undefined) {
            return;
        }
        super.setValues(values);
        this.color.setValues(values);
        Utils.copyPropertiesAndCheckRecompile(keys, ['enableSizeAttenuation'], this, values);
    }

    @materialProperty()
    /**
     * @deprecated will not work.
     */
    size = 1;
    @shaderComponentInMaterial()
    color = new ColorWithAlpha();
    @materialProperty()
    enableSizeAttenuation = true;
    @materialProperty()
    enableVertexColor: boolean = false;

    className() {
        return 'PointsMaterial';
    }

    extendShaderShape(builder: ShaderBuilder, _: ShaderComponentRegistry) {
        builder
            .useCamera()
            .addUniform('size', WebGLShaderDataType.Float)
            .inject(ShaderInjectionTypes.gl_PointSize, 'gl_PointSize = size;')
            .when(this.enableSizeAttenuation,
                b => b.inject(ShaderInjectionTypes.gl_PointSize, SizeAttenuation)
                    .addUniform('scale', WebGLShaderDataType.Float));
    }

    computeShapeKey(_: ShaderComponentRegistry) {
        // PointsMaterial
        return 'cp' + (this.enableSizeAttenuation ? '0' : '1');
    }

    updateShapeUniforms(p: WGLProgram, _: ShaderComponentRegistry) {
        if (this.enableSizeAttenuation) {
            p.setUniform('scale', p.renderState.builtUniforms.resolution.height * 0.5);
        }
        p.setUniform('size', window.devicePixelRatio * this.size);
    }

    extendShaderShading(b: ShaderBuilder, _: ShaderComponentRegistry) {
        b.when(this.enableVertexColor, b =>
            b.addVarying(ShaderVaryingTypes.vertexColor)
                .inject(ShaderInjectionTypes.channel_color, 'color.rgb *= vColor;')
                .inject(ShaderInjectionTypes.gl_FragColor, 'gl_FragColor = vec4(color, 1.0);')
        ).when(!this.enableVertexColor, b =>
            b.extend(this.color)
        );
    }

    generateShaderKey(r: ShaderComponentRegistry) {
        return super.generateShaderKey(r) + HashKeyBuilder.getInstance()
            .bool(this.enableSizeAttenuation)
            .bool(this.enableVertexColor)
            .getKey();
    }

    updateShadingUniforms(p: WGLProgram, _: ShaderComponentRegistry) {
        if (this.enableVertexColor) {
            return;
        }
        this.color.updateShadingUniforms(p);
    }

    copy(other: PointsMaterial) {
        super.copyBase(other);
        this.color.copy(other.color);
        this.size = other.size;
        this.enableSizeAttenuation = other.enableSizeAttenuation;
        return this;
    }

    clone() {
        return new PointsMaterial().copy(this);
    }

    serialize(ctx: Serializer) {
        super.serialize(ctx);
        ctx.puts<PointsMaterial>(['color', 'enableSizeAttenuation', 'size', 'enableVertexColor']);
    }

    deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        ctx.reads<PointsMaterial>(['color', 'enableSizeAttenuation', 'size', 'enableVertexColor']);
    }

}

const SizeAttenuation = `
bool isPerspective = (projectionMatrix[2][3] == - 1.0);

if (isPerspective) {
    gl_PointSize *= (scale / - mvPosition.z);
}
`;
