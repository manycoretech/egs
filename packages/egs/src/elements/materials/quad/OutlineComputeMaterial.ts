import { PassQuadMaterialBase } from './PassMaterialBase';
import { Texture } from '../../textures/Texture';
import type { Nullable } from '../../../utils/Utils';
import { Matrix4 } from '../../../math/Matrix4';
import { Vector4 } from '../../../math/Vector4';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';
import { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { ShaderInjectionTypes, ShaderBuilder } from '../../../renderer/shader/builders/ShaderBuilder';
import { HashKeyBuilder } from '../../../utils/HashKeyBuilder';
import { ShaderComponentRegistry } from '../../../scene/ShaderComponentRegistry';
import { readonlyMath } from '../../../math/Readonly';
import { materialProperty } from '../../../ContentAPI';

enum ThicknessCoord {
    Index = 'indexSampleCoord',
    Normal = 'normalSampleCoord',
    Depth = 'depthSampleCoord',
    Default = 'sampleCoord',
}

export class OutlineComputeMaterial extends PassQuadMaterialBase {
    transparent = false;
    @materialProperty()
    indexNormalMap: Texture;
    @materialProperty()
    texelSize = readonlyMath.vec2(1, 1);
    @materialProperty()
    depthMap: Nullable<Texture> = null;
    @materialProperty()
    cameraInverseProjectionMatrix = new Matrix4();
    @materialProperty()
    highQuality = true;
    @materialProperty()
    enableDepth = true;
    @materialProperty()
    edgeThickness = new Vector4(1, 1, 1, 1); // index, normal, depth, basic
    @materialProperty()
    coefficient = new Vector4(1, 1, 1, 1); // index, normal, depth, basic

    className() {
        return 'OutlineComputeMaterial';
    }

    setTexelSize(width: number, height: number) {
        this.texelSize = readonlyMath.vec2(1 / width, 1 / height);
    }

    generateShaderKey(r: ShaderComponentRegistry) {
        const defaultThicknessCoord = (this.edgeThickness.x === this.edgeThickness.w) && (this.edgeThickness.y === this.edgeThickness.w) && (this.edgeThickness.z === this.edgeThickness.w);
        return super.generateShaderKey(r) + HashKeyBuilder.getInstance()
            .bool(this.enableDepth)
            .bool(this.highQuality)
            .bool(defaultThicknessCoord)
            .getKey();
    }

    extendShaderShading(builder: ShaderBuilder) {
        builder
            .addFragDefine('#define NORMAL_BIAS 0.012')
            .addUniform('texelSize', WebGLShaderDataType.Vec2)
            .addUniform('edgeThickness', WebGLShaderDataType.Vec4)
            .addUniform('coefficient', WebGLShaderDataType.Vec4)
            .addUniform('indexNormalMap', WebGLShaderDataType.Sampler2D)
            .addFragmentCustom(OutlineDecodeFrag)
            .when(this.enableDepth, builder =>
                builder
                    .addUniform('depthMap', WebGLShaderDataType.Sampler2D)
                    .addUniform('cameraInverseProjectionMatrix', WebGLShaderDataType.Mat4)
                    .addFragmentCustom(OutlineDepthFrag)
            );

        const addCoordVarying = (name: string, propertyName: string) => {
            builder
                .addVaryingCustom(`${name}S`, WebGLShaderDataType.Vec2)
                .addVaryingCustom(`${name}E`, WebGLShaderDataType.Vec2)
                .inject(ShaderInjectionTypes.vary_any, `${name}S = uv + vec2(0.0, edgeThickness.${propertyName}) * texelSize;`)
                .inject(ShaderInjectionTypes.vary_any, `${name}E = uv + vec2(edgeThickness.${propertyName}, 0.0) * texelSize;`)
                .when(this.highQuality, b =>
                    b.addVaryingCustom(`${name}N`, WebGLShaderDataType.Vec2)
                        .addVaryingCustom(`${name}W`, WebGLShaderDataType.Vec2)
                        .inject(ShaderInjectionTypes.vary_any, `${name}N = uv + vec2(0.0, -edgeThickness.${propertyName}) * texelSize;`)
                        .inject(ShaderInjectionTypes.vary_any, `${name}W = uv + vec2(-edgeThickness.${propertyName}, 0.0) * texelSize;`)
                );
            return builder;
        };

        const defaultThicknessCoord = (this.edgeThickness.x === this.edgeThickness.w) && (this.edgeThickness.y === this.edgeThickness.w) && (this.edgeThickness.z === this.edgeThickness.w);
        if (defaultThicknessCoord) {
            addCoordVarying(ThicknessCoord.Default, 'w');
        } else {
            addCoordVarying(ThicknessCoord.Index, 'x');
            addCoordVarying(ThicknessCoord.Normal, 'y');
            if (this.enableDepth) {
                addCoordVarying(ThicknessCoord.Depth, 'z');
            }
        }
        builder
            .inject(ShaderInjectionTypes.gl_FragColor, buildOutlineFrag(this.highQuality, this.enableDepth, defaultThicknessCoord));
    }

    updateShadingUniforms(p: WGLProgram) {
        p.setUniform('texelSize', this.texelSize);
        p.setUniform('edgeThickness', this.edgeThickness);
        p.setUniform('coefficient', this.coefficient);
        p.setTexture2D('indexNormalMap', this.indexNormalMap);
        if (this.enableDepth) {
            p.setTexture2D('depthMap', this.depthMap!);
            p.setUniform('cameraInverseProjectionMatrix', this.cameraInverseProjectionMatrix);
        }
    }
}

function buildOutlineFrag(
    hightQuality: boolean,
    enableDepth: boolean,
    defaultThicknessCoord: boolean,
) {
    const indexCoord = defaultThicknessCoord ? ThicknessCoord.Default : ThicknessCoord.Index;
    const normalCoord = defaultThicknessCoord ? ThicknessCoord.Default : ThicknessCoord.Normal;
    const depthCoord = defaultThicknessCoord ? ThicknessCoord.Default : ThicknessCoord.Depth;

    function buildDataFrag(name: string) {
        return `
        vec4 ${name}_dataS = getIndexNormal(${name}S);
        vec4 ${name}_dataE = getIndexNormal(${name}E);
        ${hightQuality ?
                `
            vec4 ${name}_dataN = getIndexNormal(${name}N);
            vec4 ${name}_dataW = getIndexNormal(${name}W);
            ` : ''
            }
    `;
    }

    return `
    vec4 data = getIndexNormal(vUv);

    ${buildDataFrag(indexCoord)}
    ${(indexCoord !== normalCoord) ? buildDataFrag(normalCoord) : ''}

    ${hightQuality ?
            `
        const vec4 one = vec4(1.0);
        vec4 indexDiff = abs(vec4(
            data.x - ${indexCoord}_dataS.x, data.x - ${indexCoord}_dataE.x,
            data.x - ${indexCoord}_dataN.x, data.x - ${indexCoord}_dataW.x
        ));
        vec4 normalDiff = vec4(
            dot(data.yzw, ${normalCoord}_dataS.yzw), dot(data.yzw, ${normalCoord}_dataE.yzw),
            dot(data.yzw, ${normalCoord}_dataN.yzw), dot(data.yzw, ${normalCoord}_dataW.yzw)
        );
        `
            :
            `
        const vec2 one = vec2(1.0);
        vec2 indexDiff = abs(vec2(data.x - ${indexCoord}_dataS.x, data.x - ${indexCoord}_dataE.x));
        vec2 normalDiff = vec2(dot(data.yzw, ${normalCoord}_dataS.yzw), dot(data.yzw, ${normalCoord}_dataE.yzw));
        `
        }

    float indexEdge = clamp(dot(indexDiff, one), 0.0, 1.0);
    float normalEdge = clamp(dot(1.0 - normalDiff, one) - float(NORMAL_BIAS), 0.0, 1.0);
    float edge = max(indexEdge * coefficient.x, normalEdge * coefficient.y);

    ${enableDepth ?
            `
        vec3 position = getPosition(vUv);
        vec3 positionS = getPosition(${depthCoord}S);
        vec3 positionE = getPosition(${depthCoord}E);
        vec3 positionN = getPosition(${depthCoord}N);
        vec3 positionW = getPosition(${depthCoord}W);
        ${normalCoord === depthCoord ?
                `
            vec3 normalS = ${normalCoord}_dataS.yzw;
            vec3 normalE = ${normalCoord}_dataE.yzw;
            vec3 normalN = ${normalCoord}_dataN.yzw;
            vec3 normalW = ${normalCoord}_dataW.yzw;
            `
                :
                `
            vec3 normalS = getIndexNormal(${depthCoord}S).yzw;
            vec3 normalE = getIndexNormal(${depthCoord}E).yzw;
            vec3 normalN = getIndexNormal(${depthCoord}N).yzw;
            vec3 normalW = getIndexNormal(${depthCoord}W).yzw;
            `
            }

        vec3 posDirS = normalize(position - positionS);
        vec3 posDirE = normalize(position - positionE);
        vec3 posDirN = normalize(position - positionN);
        vec3 posDirW = normalize(position - positionW);
        float depthEdge = max(
            abs(abs(dot(posDirS, normalS)) - abs(dot(posDirN, normalN))),
            abs(abs(dot(posDirE, normalE)) - abs(dot(posDirW, normalW)))
        );
        depthEdge = smoothstep(0.15, 1.0, depthEdge);
        edge = max(depthEdge * coefficient.z, edge);
        ` : ``
        }

    gl_FragColor = vec4(edge, 1, 1, 1);
    `;
}

const OutlineDepthFrag = `
vec3 getPosition(vec2 uv) {
    float zDepth = texture2D(depthMap, uv).x;
    vec4 clipPosition = vec4((vec3(uv, zDepth) - 0.5) * 2.0, 1.0);
    vec4 res = cameraInverseProjectionMatrix * clipPosition;
    return res.xyz / res.w;
}`;

const OutlineDecodeFrag = `
// Decoding view space normals from 2D 0..1 vector
vec3 decodeViewNormalStereo(vec2 enc2) {
    float kScale = 1.7777;
    vec3 nn = vec3(enc2, 0.0) * vec3(2.0 * kScale, 2.0 * kScale, 0.0) + vec3(-kScale, -kScale, 1.0);
    float g = 2.0 / dot(nn.xyz, nn.xyz);
    vec3 n = vec3(nn.xy * g, g - 1.0);
    return n;
}

vec4 getIndexNormal(vec2 uv) {
    vec4 enc = texture2D(indexNormalMap, uv);
    float index = floor(dot(enc.xy, vec2(65025.0, 255.0)));
    vec3 normal = decodeViewNormalStereo(enc.zw);
    return vec4(index, normal);
}`;
