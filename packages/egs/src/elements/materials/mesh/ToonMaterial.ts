import { Color } from '../../../math/Color';
import { materialProperty } from '../../../ContentAPI';
import { HashKeyBuilder } from '../../../utils/HashKeyBuilder';
import type { ShaderComponentRegistry } from '../../../scene/ShaderComponentRegistry';
import type { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { type ShaderBuilder, ShaderInjectionTypes } from '../../../renderer/shader/builders/ShaderBuilder';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';
import { SceneMaterial } from '../base';

export class ToonMaterial extends SceneMaterial {
    @materialProperty()
    toonColor = new Color(1.0, 1.0, 1.0);
    @materialProperty()
    diffuseColor = new Color(0.12, 0.12, 0.12);
    @materialProperty()
    tooniness = 24;
    @materialProperty()
    smoothnessMin = 0.32;
    @materialProperty()
    smoothnessMax = 0.34;

    className() {
        return 'ToonMaterial';
    }

    generateShaderKey(r: ShaderComponentRegistry) {
        return super.generateShaderKey(r) + HashKeyBuilder.getInstance();
    }

    extendShaderShading(builder: ShaderBuilder) {
        builder
            .addUniform('tooniness', WebGLShaderDataType.Int)
            .addUniform('toonColor', WebGLShaderDataType.Vec3)
            .addUniform('diffuseColor', WebGLShaderDataType.Vec3)
            .addUniform('smoothnessMin', WebGLShaderDataType.Float)
            .addUniform('smoothnessMax', WebGLShaderDataType.Float)
            .addFragmentCustom(CelShadingFrag)
            .inject(ShaderInjectionTypes.gl_FragColor, ToonShadingInjection);
    }

    updateShadingUniforms(p: WGLProgram) {
        p.setUniform('toonColor', this.toonColor);
        p.setUniform('diffuseColor', this.diffuseColor);
        p.setUniform('tooniness', this.tooniness);
        p.setUniform('smoothnessMin', this.smoothnessMin);
        p.setUniform('smoothnessMax', this.smoothnessMax);
    }

    copy(other: ToonMaterial) {
        super.copyBase(other);
        this.toonColor = other.toonColor.clone();
        this.diffuseColor = other.diffuseColor.clone();
        this.tooniness = other.tooniness;
        this.smoothnessMin = other.smoothnessMin;
        this.smoothnessMax = other.smoothnessMax;
        return this;
    }

    clone() {
        return new ToonMaterial().copy(this);
    }
}

const CelShadingFrag = `
vec3 lerp(vec3 colorone, vec3 colortwo, float value) {
    return (colorone + value*(colortwo-colorone));
}

vec3 RGBToHSV( vec3 RGB ){
    vec4 k = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
    vec4 p = RGB.g < RGB.b ? vec4(RGB.b, RGB.g, k.w, k.z) : vec4(RGB.gb, k.xy);
    vec4 q = RGB.r < p.x   ? vec4(p.x, p.y, p.w, RGB.r) : vec4(RGB.r, p.yzx);
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 HSVToRGB( vec3 HSV ){
    vec4 k = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(HSV.xxx + k.xyz) * 6.0 - k.www);
    return HSV.z * lerp(k.xxx, clamp(p - k.xxx, 0.0, 1.0), HSV.y);
}
    `;

const ToonShadingInjection = `
float cutColor = 1.0 / float(tooniness);
reflectedLight.indirectDiffuse = RGBToHSV(reflectedLight.indirectDiffuse);
vec2 target_c = cutColor * floor(reflectedLight.indirectDiffuse.gb * float(tooniness));
reflectedLight.indirectDiffuse = HSVToRGB(vec3(reflectedLight.indirectDiffuse.r,target_c));
reflectedLight.directDiffuse =  diffuseColor * smoothstep(smoothnessMin, smoothnessMax, dot(normal, directLight.direction));
reflectedLight.indirectDiffuse = toonColor * reflectedLight.indirectDiffuse;
outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular;
gl_FragColor = vec4( outgoingLight, opacity );
`;
