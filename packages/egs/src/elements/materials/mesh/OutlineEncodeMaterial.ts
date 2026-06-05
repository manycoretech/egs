import type { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';
import {
    ShaderVaryingTypes,
    type ShaderBuilder,
    ShaderInjectionTypes,
} from '../../../renderer/shader/builders/ShaderBuilder';
import { createShaderBlock } from '../../../renderer/shader/builders/ShaderBlock';
import { Capabilities } from '../../../renderer/Capabilities';
import { Platform } from '../../../utils/Platform';
import { SceneMaterial } from '../base';

export class OutlineEncodeMaterial extends SceneMaterial {
    encodeId = 0;
    mergedCounts = 0;

    className() {
        return 'OutlineEncodeMaterial';
    }

    copy(other: OutlineEncodeMaterial) {
        super.copyBase(other);
        this.encodeId = other.encodeId;
        return this;
    }

    clone() {
        return new OutlineEncodeMaterial().copy(this);
    }

    updateShadingUniforms(program: WGLProgram) {
        program.setUniform('encodeId', this.encodeId);
        if (this.mergedCounts > 0) {
            program.setUniform('mergedCounts', this.mergedCounts);
        }
    }

    extendShaderShading(builder: ShaderBuilder) {
        // ios will crash when using flat varying vec2.
        const useFlatVarying = Capabilities.IS_WEBGL2 && !Platform.getInstance().ios;
        builder
            .addUniform('encodeId', WebGLShaderDataType.Float)
            .addVarying(ShaderVaryingTypes.fragNormal)
            .addFragment(Encoder)
            .inject(ShaderInjectionTypes.vary_any, 'float offset = 0.0;');
        if (useFlatVarying) {
            builder.addVertexCustom(`flat out vec2 vOutlineId;`).addFragmentCustom(`flat in vec2 vOutlineId;`);
        } else {
            builder.addVaryingCustom('vOutlineId', WebGLShaderDataType.Float);
        }
        if (this.useInstance) {
            builder
                .addCustomAttribute('instanceId', WebGLShaderDataType.Float)
                .inject(ShaderInjectionTypes.vary_any, 'offset = instanceId;');
        }
        if (this.mergedCounts > 0) {
            builder
                .addUniform('mergedCounts', WebGLShaderDataType.Float)
                .addCustomAttribute('map_index', WebGLShaderDataType.Vec2)
                .inject(ShaderInjectionTypes.vary_any, 'offset = offset * mergedCounts + map_index.y;');
        }
        if (useFlatVarying) {
            builder
                .inject(
                    ShaderInjectionTypes.vary_any,
                    'vOutlineId = vec2(floor((encodeId + offset) / 256.0) / 256.0, mod(encodeId + offset, 256.0) / 256.0);',
                )
                .inject(
                    ShaderInjectionTypes.gl_FragColor,
                    'gl_FragColor = vec4(vOutlineId, encodeViewNormalStereo(normal));',
                );
        } else {
            builder
                .inject(ShaderInjectionTypes.vary_any, 'vOutlineId = floor(encodeId + offset);')
                .inject(
                    ShaderInjectionTypes.gl_FragColor,
                    'gl_FragColor = vec4(vec2(floor(round(vOutlineId) / 256.0) / 256.0, mod(round(vOutlineId), 256.0) / 256.0), encodeViewNormalStereo(normal));',
                );
        }
    }
}

const Encoder = createShaderBlock(`
// Encoding view space normals into 2D 0..1 vector
vec2 encodeViewNormalStereo(vec3 n) {
    float kScale = 1.7777;
    vec2 enc;
    enc = n.xy / (n.z + 1.0);
    enc /= kScale;
    enc = enc * 0.5 + 0.5;
    return enc;
}`);
