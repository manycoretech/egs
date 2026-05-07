import { ShaderBuilder, ShaderInjectionTypes } from '../../../renderer/shader/builders/ShaderBuilder';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';
import { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { createShaderBlock } from '../../../renderer/shader/builders/ShaderBlock';
import { HashKeyBuilder } from '../../../utils/HashKeyBuilder';
import { ShaderComponentRegistry } from '../../../scene/ShaderComponentRegistry';
import { materialProperty } from '../../../ContentAPI';
import { SceneMaterial } from '../base';

export enum DepthPackingStrategies {
    BasicDepthPacking = 0,
    RGBADepthPacking = 1,
    NDC_DepthPacking = 2
}

export class MeshDepthMaterial extends SceneMaterial {
    @materialProperty()
    public depthPacking = DepthPackingStrategies.RGBADepthPacking;

    public className() {
        return 'MeshDepthMaterial';
    }

    public extendShaderShading(b: ShaderBuilder) {
        b
            .addVaryingCustom('clipSpacePosition', WebGLShaderDataType.Vec4)
            .inject(ShaderInjectionTypes.vary_any, 'clipSpacePosition = projectionMatrix * mvPosition;')
            .when(this.depthPacking === DepthPackingStrategies.RGBADepthPacking,
                b => b.addFragment(PackDepthToRGBA))
            .inject(ShaderInjectionTypes.gl_FragColor, makeDepth(this.depthPacking));
    }

    public generateShaderKey(r: ShaderComponentRegistry) {
        return super.generateShaderKey(r) + HashKeyBuilder.getInstance()
            .raw(this.depthPacking)
            .getKey();
    }

    public updateShadingUniforms(_: WGLProgram) { }

    public clone() {
        return new MeshDepthMaterial().copy(this);
    }

    public copy(other: MeshDepthMaterial) {
        this.depthPacking = other.depthPacking;
        return this;
    }
}

function makeDepth(s: DepthPackingStrategies) {
    const header = `
    vec4 diffuseColor = vec4(1.0);

    // https://github.com/mrdoob/three.js/issues/9092
    // https://stackoverflow.com/a/12904072
    float far = gl_DepthRange.far;
    float near = gl_DepthRange.near;
    float ndc_depth = clipSpacePosition.z / clipSpacePosition.w;
    float fragCoordZ = (((far-near) * ndc_depth) + near + far) / 2.0;
    `;
    switch (s) {
        case DepthPackingStrategies.BasicDepthPacking: return header + `gl_FragColor = vec4(vec3(fragCoordZ), 1.0);`;
        case DepthPackingStrategies.RGBADepthPacking: return header + `gl_FragColor = packDepthToRGBA(fragCoordZ);`;
        case DepthPackingStrategies.NDC_DepthPacking: return header + `gl_FragColor = vec4(vec3(ndc_depth), 1.0);`;
    }
}

const PackDepthToRGBA = createShaderBlock(`
const float PackUpscale = 256. / 255.; // fraction -> 0..1 (including 1)
const vec3 PackFactors = vec3(256. * 256. * 256., 256. * 256.,  256.);
const float ShiftRight8 = 1. / 256.;
vec4 packDepthToRGBA(const in float v) {
    float scaled = v / PackUpscale;
    vec4 r = vec4(fract(scaled * PackFactors), scaled);
    r.yzw -= r.xyz * ShiftRight8; // tidy overflow
    return r * PackUpscale;
}
`);
