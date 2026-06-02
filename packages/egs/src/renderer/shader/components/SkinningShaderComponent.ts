import { ShaderComponent } from '../Shader';
import { ShaderAttributeTypes, ShaderBuilder, ShaderInjectionTypes } from '../builders/ShaderBuilder';
import { Serializer, Deserializer } from '../../../utils/Serialization';
import { createShaderBlock } from '../builders/ShaderBlock';
import { BuiltInUniformTypes } from '../../RenderState/BuiltInUniforms';

export class SkinningShaderComponent extends ShaderComponent {
    className() {
        return 'SkinningShaderComponent';
    }

    extendShaderShading(_builder: ShaderBuilder): void {
    }

    extendShaderShape(builder: ShaderBuilder) {
        builder
            .addDefaultAttribute(ShaderAttributeTypes.joints)
            .addDefaultAttribute(ShaderAttributeTypes.weights)
            .addGlobalUniform(BuiltInUniformTypes.boneTexture)
            .addGlobalUniform(BuiltInUniformTypes.boneTextureSize)
            .addVertex(skinningInclude)
            .inject(ShaderInjectionTypes.position,
                skinningPosition
            );
    }

    computeShapeKey(): string {
        return 'skin';
    }

    copy(_: SkinningShaderComponent) {
        return this;
    }

    clone() {
        return new SkinningShaderComponent().copy(this);
    }

    serialize(_ctx: Serializer<any>): void {
    }
    deserialize(_ctx: Deserializer): void | Promise<void> {
    }
}

const skinningInclude = createShaderBlock(`
    mat4 getBoneMatrix( const in uint i ) {
        float j = float(i) * 4.0;
        float x = mod( j, float( boneTextureSize ) );
        float y = floor( j / float( boneTextureSize ) );

        float dx = 1.0 / float( boneTextureSize );
        float dy = 1.0 / float( boneTextureSize );

        y = dy * ( y + 0.5 );

        vec4 v1 = texture2D( boneTexture, vec2( dx * ( x + 0.5 ), y ) );
        vec4 v2 = texture2D( boneTexture, vec2( dx * ( x + 1.5 ), y ) );
        vec4 v3 = texture2D( boneTexture, vec2( dx * ( x + 2.5 ), y ) );
        vec4 v4 = texture2D( boneTexture, vec2( dx * ( x + 3.5 ), y ) );

        mat4 bone = mat4( v1, v2, v3, v4 );

        return bone;
    }
`);

const skinningPosition = `
    mat4 boneMatX = getBoneMatrix( joints.x );
    mat4 boneMatY = getBoneMatrix( joints.y );
    mat4 boneMatZ = getBoneMatrix( joints.z );
    mat4 boneMatW = getBoneMatrix( joints.w );

    vec4 skinVertex = vec4( position, 1.0 );

    vec4 skinned = vec4( 0.0 );
    skinned += boneMatX * skinVertex * weights.x;
    skinned += boneMatY * skinVertex * weights.y;
    skinned += boneMatZ * skinVertex * weights.z;
    skinned += boneMatW * skinVertex * weights.w;

    position = skinned.xyz;
`;

