import { ShaderComponent } from '../Shader';
import {
    type ShaderBuilder, ShaderInjectionTypes, ShaderVaryingTypes, ShaderExtensionTypes,
} from '../builders/ShaderBuilder';
import { WebGLShaderDataType } from '../../webgl/WGLConstants';
import type { WGLProgram } from '../../webgl/WGLProgram';
import { createShaderBlock } from '../builders/ShaderBlock';
import { ShaderBlockPool } from '../builders/ShaderBlockPool';
import { BuiltInUniformTypes } from '../../RenderState/BuiltInUniforms';
import { TextureCube } from '../../../elements/textures/TextureCube';
import type { Texture2D } from '../../../elements/textures/Texture2D';
import type { Serializer, Deserializer } from '../../../utils/Serialization';
import { ContentBridge, materialProperty } from '../../../ContentAPI';
import { Capabilities } from '../../Capabilities';
import type { TextureV2 } from '../../../elements/textures/TextureV2';

/**
 * Environment-map combine operation for IBL shading.
 */
export enum CombineOperation {
    Multiply = 0,
    Mix = 1,
    Add = 2,
}

/**
 * Environment texture layout used by IBL shader components.
 */
export enum EnvTextureType {
    Cube,
    Equirec,
    Sphere
}
/**
 * EnvMapIBLShaderComponent controls the use of environment map includes cubic texture and 2D texture.
 * This class has a series of local functions for defining different samplers and choosing different blending methods.
 * The function getLightProbeIndirectRadiance can return a GLSL code component for indirect light shader.
 */
export class EnvMapIBLShaderComponent<T extends TextureCube | Texture2D | TextureV2 = Texture2D | TextureCube> extends ShaderComponent {
    /**
     * The environment map accept Texture and CubeTexture.
     */
    @materialProperty()
    envMap: T = TextureCube.default as any;
    /**
     * Let refractionRatio enable.
     */
    @materialProperty()
    useFrac = false;
    /**
     * See {@link EnvTextureType| EnvTextureType } for more details.
     */
    @materialProperty()
    envType = EnvTextureType.Cube;
    /**
     * See {@link CombineOperation| CombineOperation } for more details.
     */
    @materialProperty()
    combine = CombineOperation.Multiply;
    /**
     * How much the environment map affects the surface; also see {@link CombineOperation| CombineOperation }. The default value is 1 and the valid range is between 0 (no reflections) and 1 (full reflections).
     */
    @materialProperty()
    reflectivity = 1;
    /**
     * The index of refraction (IOR) of air (approximately 1) divided by the index of refraction of the material.
     * The refraction ratio should not exceed 1.
     * This parameter is used to simulate refraction effect for envMapping.
     * @defaultValue 0.98.
     */
    @materialProperty()
    refractionRatio = 0.98;
    @materialProperty()
    envMapIntensity = 1;

    constructor() {
        super();
        ContentBridge.shaderComponentCreateAttachable(this);
    }

    /**
     * The name of instance's class.
     */
    className() {
        return 'EnvMapIBLShaderComponent';
    }
    /**
     * Copy the data to this object from other.
     * @param other the data source.
     */
    copy(other: EnvMapIBLShaderComponent<T>) {
        this.envMap = other.envMap;
        this.useFrac = other.useFrac;
        this.envType = other.envType;
        this.combine = other.combine;
        this.reflectivity = other.reflectivity;
        this.refractionRatio = other.refractionRatio;
        this.envMapIntensity = other.envMapIntensity;
        return this;
    }

    clone() {
        return new EnvMapIBLShaderComponent<T>().copy(this);
    }

    extendShaderShading(builder: ShaderBuilder) {
        const supportTextureLOD = Capabilities.IS_SUPPORT_SHADER_TEXTURE_LOD;
        builder
            .addUniform('reflectivity', WebGLShaderDataType.Float)
            .when(!Capabilities.IS_WEBGL2 && supportTextureLOD, b => b.addExtension(ShaderExtensionTypes.GL_EXT_shader_texture_lod))
            .when(this.useFrac, b => b.addUniform('refractionRatio', WebGLShaderDataType.Float))
            .addUniform('envMapIntensity', WebGLShaderDataType.Float)
            .addGlobalUniform(BuiltInUniformTypes.cameraPosition)
            .addGlobalUniform(BuiltInUniformTypes.viewMatrix)
            .addVarying(ShaderVaryingTypes.fragNormal)
            .addVarying(ShaderVaryingTypes.worldPosition)
            .addFragment(ShaderBlockPool.InverseTransformDirection)
            .inject(ShaderInjectionTypes.gl_FragColorModify, buildEnvFrag(this.useFrac, this.envType, this.combine))
            .addShaderStrProcess(s => s.replace(/envMapTexelToLinear/g, ''));
        if (this.envType === EnvTextureType.Cube) {
            builder.addUniform('envMap', WebGLShaderDataType.SamplerCube);
        } else {
            builder.addUniform('envMap', WebGLShaderDataType.Sampler2D);
        }
    }

    /**
     * @internal
     */
    updateShadingUniforms(program: WGLProgram) {
        program.setTextureCube('envMap', this.envMap as TextureCube);
        program.setUniform('reflectivity', this.reflectivity);
        // program.setUniform('maxMipLevel', this.maxMipLevel);
        // program.setUniform('envMapIntensity', this.envMapIntensity);
        if (this.useFrac) {
            program.setUniform('refractionRatio', this.refractionRatio);
        }
    }
    /**
     * @internal
     */
    getLightProbeIndirectRadiance() {
        const supportTextureLOD = Capabilities.IS_SUPPORT_SHADER_TEXTURE_LOD;
        return createShaderBlock(getLightProbeIndirectRadiance(this.useFrac, this.envType, supportTextureLOD));
    }

    serialize(ctx: Serializer<any>): void {
        ctx.puts<EnvMapIBLShaderComponent>(['envMap', 'useFrac', 'envType', 'combine', 'reflectivity', 'refractionRatio', 'envMapIntensity']);
    }

    deserialize(ctx: Deserializer): void | Promise<void> {
        ctx.reads<EnvMapIBLShaderComponent>(['envMap', 'useFrac', 'envType', 'combine', 'reflectivity', 'refractionRatio', 'envMapIntensity']);
    }
}

function buildEnvFrag(useFrac: boolean, mapping: EnvTextureType, combine: CombineOperation) {
    const reflectVec = `
    vec3 cameraToVertex = normalize( vWorldPosition - cameraPosition );

    // Transforming Normal Vectors with the Inverse Transformation
    vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );

    ${useFrac ?
            'vec3 reflectVec = refract( cameraToVertex, worldNormal, refractionRatio );' :
            'vec3 reflectVec = reflect( cameraToVertex, worldNormal );'
        }
    `;

    return `
        ${reflectVec}
        ${getSampler(mapping)}
        envColor = envMapTexelToLinear( envColor );
        ${getCombine(combine)}
    `;
}

function getSampler(mapping: EnvTextureType): string {
    switch (mapping) {
        case EnvTextureType.Cube:
            return `vec4 envColor = textureCube( envMap, vec3( -1.0 * reflectVec.x, reflectVec.yz ) );`;

        case EnvTextureType.Equirec:
            return `
            vec2 sampleUV;
            reflectVec = normalize( reflectVec );
            sampleUV.y = asin( clamp( reflectVec.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
            sampleUV.x = atan( reflectVec.z, reflectVec.x ) * RECIPROCAL_PI2 + 0.5;
            vec4 envColor = texture2D( envMap, sampleUV );
            `;

        case EnvTextureType.Sphere:
            return `
            reflectVec = normalize( reflectVec );
            vec3 reflectView = normalize( ( viewMatrix * vec4( reflectVec, 0.0 ) ).xyz + vec3( 0.0, 0.0, 1.0 ) );
            vec4 envColor = texture2D( envMap, reflectView.xy * 0.5 + 0.5 );
            `;
        default:
            return `vec4 envColor = vec4( 0.0 );`;
    }
}

function getSamplerLOD(mapping: EnvTextureType, textureLodExt: boolean): string {
    switch (mapping) {
        case EnvTextureType.Cube:
            return `
                vec3 queryReflectVec = vec3( -1.0 * reflectVec.x, reflectVec.yz );
                vec4 envMapColor = ${textureLodExt ? 'textureCubeLodEXT' : 'textureCube'}( envMap, queryReflectVec, specularMIPLevel );`;

        case EnvTextureType.Equirec:
            return `
                vec2 sampleUV;
                sampleUV.y = asin( clamp( reflectVec.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
                sampleUV.x = atan( reflectVec.z, reflectVec.x ) * RECIPROCAL_PI2 + 0.5;
                vec4 envMapColor = ${textureLodExt ? 'texture2DLodEXT' : 'texture2D'}( envMap, sampleUV, specularMIPLevel );
            `;

        case EnvTextureType.Sphere:
            return `
                vec3 reflectView = normalize( ( viewMatrix * vec4( reflectVec, 0.0 ) ).xyz + vec3( 0.0,0.0,1.0 ) );
                vec4 envMapColor = ${textureLodExt ? 'texture2DLodEXT' : 'texture2D'}( envMap, reflectView.xy * 0.5 + 0.5, specularMIPLevel );
            `;
        default:
            return `vec4 envColor = vec4( 0.0 );`;
    }
}

function getCombine(combine: CombineOperation): string {
    switch (combine) {
        case CombineOperation.Add:
            return `gl_FragColor.rgb = gl_FragColor.rgb + envColor.xyz * specularStrength * reflectivity;`;
        case CombineOperation.Mix:
            return `gl_FragColor.rgb = mix( gl_FragColor.rgb, envColor.xyz, specularStrength * reflectivity );`;
        case CombineOperation.Multiply:
            return `gl_FragColor.rgb = mix( gl_FragColor.rgb, gl_FragColor.rgb * envColor.xyz, specularStrength * reflectivity );`;
    }
}

function getLightProbeIndirectRadiance(useFrac: boolean, mapping: EnvTextureType, textureLodExt: boolean) {
    return `
    /*const in SpecularLightProbe specularLightProbe,*/
    vec3 getLightProbeIndirectRadiance( const in GeometricContext geometry, const in float blinnShininessExponent, const in int maxMIPLevel ) {
        ${useFrac ?
            'vec3 reflectVec = refract( -geometry.viewDir, geometry.normal, refractionRatio );' :
            'vec3 reflectVec = reflect( -geometry.viewDir, geometry.normal );'
        }

        reflectVec = inverseTransformDirection( reflectVec, viewMatrix );

        float specularMIPLevel = GetSpecularMIPLevel( blinnShininessExponent, maxMIPLevel );

        ${getSamplerLOD(mapping, textureLodExt)}

        envMapColor.rgb = envMapTexelToLinear( envMapColor ).rgb;
        return envMapColor.rgb * envMapIntensity;
    }
    `;
}
