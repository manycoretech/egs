import { type MaterialParameters, copyItem } from '../Material';
import { ShaderBuilder, ShaderInjectionTypes, ShaderVaryingTypes } from '../../../renderer/shader/builders/ShaderBuilder';
import { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { ShaderComponentRegistry } from '../../../scene/ShaderComponentRegistry';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';
import { BuiltInUniformTypes } from '../../../renderer/RenderState/BuiltInUniforms';
import { Utils } from '../../../utils/Utils';
import { materialProperty } from '../../../ContentAPI';
import { SceneMaterial } from '../base';
import { Texture2D } from '../../textures/Texture2D';
import { TextureV2 } from '../../textures/TextureV2';

export type RoomBoxMaterialParameter<T extends TextureV2 | Texture2D = Texture2D> = MaterialParameters & {
    texture?: T,
};

/**
 * Material that renders a textured room-box environment.
 */
export class RoomBoxMaterial<T extends TextureV2 | Texture2D = Texture2D> extends SceneMaterial {
    @materialProperty()
    texture: T;
    @materialProperty()
    enableToneMap = false;
    @materialProperty()
    enableMidground = true;
    @materialProperty()
    enableCurtains = true;
    @materialProperty()
    midgroundDepth = 0.5;

    className(): string {
        return 'RoomBoxMaterial';
    }

    copy(other: RoomBoxMaterial<T>) {
        super.copyBase(other);
        copyItem(this, other, 'texture');
        return this;
    }

    clone() {
        return new RoomBoxMaterial<T>().copy(this);
    }

    constructor(p?: RoomBoxMaterialParameter<T>) {
        super();
        this.setValues(p);
    }

    setValues(values?: RoomBoxMaterialParameter<T>) {
        if (values === undefined) {
            return;
        }
        super.setValues(values);
        Utils.copyProperty('texture', 'texture', this, values);
    }

    extendShaderShading(builder: ShaderBuilder, _: ShaderComponentRegistry) {
        builder
            .addUniform('uSampler', WebGLShaderDataType.Sampler2D)
            .addUniform('enableToneMap', WebGLShaderDataType.Int)
            .addUniform('u_enableMidground', WebGLShaderDataType.Int)
            .addUniform('u_enableCurtains', WebGLShaderDataType.Int)
            .addUniform('u_midgroundDepth', WebGLShaderDataType.Float)
            .addGlobalUniform(BuiltInUniformTypes.projectionMatrix)
            .addGlobalUniform(BuiltInUniformTypes.modelViewMatrix)
            .addVaryingCustom('vModelPosition', WebGLShaderDataType.Vec3)
            .inject(ShaderInjectionTypes.vary_any, 'vModelPosition = position.xyz;')
            .addVarying(ShaderVaryingTypes.fragUV)
            .addFragmentCustom(magicShader)
            .inject(ShaderInjectionTypes.gl_FragColor, RoomBoxRenderingFragColor);
    }
    updateShadingUniforms(program: WGLProgram, _: ShaderComponentRegistry) {
        if (this.texture) {
            program.setTexture2D('uSampler', this.texture);
        }
        program.setUniform('enableToneMap', this.enableToneMap ? 1 : 0);
        program.setUniform('u_enableMidground', this.enableMidground ? 1 : 0);
        program.setUniform('u_midgroundDepth', this.midgroundDepth);
        program.setUniform('u_enableCurtains', this.enableCurtains ? 1 : 0);
    }
}

const RoomBoxRenderingFragColor = `
if (vUv.x > 0.02 && vUv.x < 0.98 &&
    vUv.y > 0.02 && vUv.y < 0.98){
    int zUpAxis = 0;
    int textureFlop = 0;
    float heightOverscan = 0.0;
    float midgroundOffsetX = 0.0;
    float roomDepth = 1.0;
    float widthOverscan = 0.0;
    float midgroundOffsetY = 0.0;
    int textureFlip = 0;
    float windowAspect = 1.0;

    gl_FragColor = vec4(3.0 * jiWindowBox_VRay(
        zUpAxis,
        textureFlip,
        textureFlop,
        roomDepth,
        widthOverscan,
        heightOverscan,
        u_enableMidground,
        u_midgroundDepth,
        midgroundOffsetX,
        midgroundOffsetY,
        windowAspect,
        u_enableCurtains), 1.0);
} else {
    gl_FragColor = vec4(0.5, 0.5, 0.5, 1.0);
}
`;

const magicShader = `
const float minLumCorrect = 2.03; // 5.0-0.01

float Luminance(vec3 color, float minLuminance) {
    float lum = dot(color, vec3(0.2126560, 0.7151580, 0.0721856));
    return max(lum, minLuminance);
}

vec3 toneMapReinhard(vec3 color) {
    float pixelLuminance = Luminance(color, minLumCorrect);
    float toneMappedLuminance = pixelLuminance / (pixelLuminance + 1.0);

    return toneMappedLuminance * pow(color / pixelLuminance, vec3(1.0));
}

vec3 jiWindowBox_VRay(
	int zUpAxis,
        int textureFlip,
        int textureFlop,
        float roomDepth,
        float widthOverscan,
        float heightOverscan,
        int enableMidground,
        float midgroundDepth,
        float midgroundOffsetX,
        float midgroundOffsetY,
        float windowAspect,
        int enableCurtains){
    // Fill shader globals
    vec3 viewOrgInModelSpace = (inverse(modelViewMatrix) * vec4(0., 0., 0., 1.)).xyz;
    vec3 I = normalize(vModelPosition - viewOrgInModelSpace);
    float u = vUv.x;
    float v = vUv.y;

    //user controls remapping
    float roomDepthMult = clamp(roomDepth,0.1,100.0);
    float heightOverscanMult = 1.0 - clamp(heightOverscan,0.0,0.9);
    float widthOverscanMult = 1.0 - clamp(widthOverscan,0.0,0.9);
    float midgroundDepthMult = clamp(midgroundDepth,0.05,roomDepthMult-0.01);
    float midgroundOffY = midgroundOffsetY * (float(textureFlip)*2.0-1.0) * 0.1;
    float midgroundOffX = midgroundOffsetX * (float(textureFlop)*2.0-1.0) * 0.1;


    //global variables & remapping
    vec3 objI = -I;
    if (zUpAxis > 0){
      objI = vec3(-objI.x,-objI.y,-objI.z) * vec3(widthOverscanMult*(1.0/windowAspect), heightOverscanMult, 1.0);		//reorder to match UV for Y up axis
    } else {
      objI = vec3(-objI.x,-objI.y,-objI.z) * vec3(widthOverscanMult*(1.0/windowAspect), heightOverscanMult, 1.0);		//reorder to match UV for Z up axis
    }
    vec3 objPOrig = (vec3(u,v,0.5) * 2.0 - 1.0) * 0.5 + 0.5;							//for curtains
    vec3 objP = (vec3(u,v,0.5) * 2.0 - 1.0) * vec3(widthOverscanMult, heightOverscanMult, 1.0)  * 0.5 + 0.5; 	//UV seems to be the better approach

    //bases for width/height/depth
    vec3 sections = step(vec3(0.0, 0.0, 0.0), objI);
    vec3 baseDepth = (objP-sections)/(-objI * roomDepthMult);
    vec3 mgDepth = (objP-sections)/(-objI * midgroundDepthMult);
    vec3 baseBack = (objP-sections)/(-objI);
    vec3 baseWidth = baseDepth * roomDepthMult;

    //depth and width ramps
    vec3 baseDepthX = (baseDepth.y*objI+objP + 1.0);
    vec3 baseDepthY = (baseDepth.x*objI+objP + 1.0);
    vec3 baseWidthX = (baseWidth.y*objI+objP + 1.0);
    vec3 baseWidthY = (baseWidth.x*objI+objP + 1.0);

    float horizU = baseDepthY.z - 0.5;
    float vertU = baseWidthX.x - 1.0;
    float horizV = baseWidthY.y - 1.0;
    float vertV = baseDepthX.z - 0.5;

    //convert ramps to UV/ST... WIP - not very efficient
    float sideWallsMask = step(0.0,horizU) * step(0.0,1.0-max(horizV, 1.0-horizV));
    vec3 sideWallsUV = vec3(horizU, horizV, 0.0) / 3.0;
    vec3 rWallUV = (sideWallsUV + vec3(2.0/3.0, 1.0/3.0, 0.0)) * sideWallsMask * sections.x;
    vec3 lWallUV = (sideWallsUV + vec3(0.0, 1.0/3.0, 0.0)) * sideWallsMask * (1.0-sections.x);
    lWallUV.x = (1.0/3.0 - lWallUV.x) * sideWallsMask * (1.0-sections.x);

    float FloorCeilMask = step(0.0,vertV) * step(0.0,1.0-max(vertU, 1.0-vertU));
    vec3 FloorCeilUV = vec3(vertU, vertV, 0) / 3.0;
    vec3 ceilUV = (FloorCeilUV + vec3(1.0/3.0, 2.0/3.0, 0)) * FloorCeilMask * sections.y;
    vec3 floorUV = (FloorCeilUV + vec3(1.0/3.0, 0.0, 0.0)) * FloorCeilMask * (1.0-sections.y);
    floorUV.y = (1.0/3.0 - floorUV.y) * FloorCeilMask * (1.0-sections.y);

    vec3 backWallUV = ((baseBack.z*objI + (objP/2.0)/(roomDepthMult)) * (roomDepthMult*2.0) / 3.0 + vec3(1.0/3.0, 1.0/3.0, 0.0) ) * (1.0 - max(step(0.0,horizU), step(0.0,vertV)));

    vec3 midgroundUV = (1.0/3.0 - (baseBack.z*objI + (objP)/(midgroundDepthMult*2.0)) * (midgroundDepthMult*2.0) / 3.0);
    float midgroundMask = step( 0.0, midgroundUV.y * 3.0 * (1.0-midgroundUV.y*3.0) ) * step( 0.0, midgroundUV.x * (1.0/3.0-midgroundUV.x) );
    midgroundUV = (vec3(midgroundOffX, midgroundOffY, 0.0) + midgroundUV);
    midgroundUV.y = (1.0-midgroundUV.y) - 2.0/3.0;

    vec3 curtainsUV = objPOrig * vec3(1.0/3.0, 1.0/3.0, 1.0);
    curtainsUV.x = 1.0/3.0 - curtainsUV.x;
    curtainsUV.y = 2.0/3.0 + curtainsUV.y; //VRay specific

    vec3 finalUV = ceilUV + floorUV + rWallUV + lWallUV + backWallUV;

    //flipping ctrl
    if (textureFlop < 1){   //VRay specific
        midgroundUV.x = 1.0/3.0 - midgroundUV.x;
        curtainsUV.x = 1.0/3.0 - curtainsUV.x;
    } else {
        finalUV.x = 1.0-finalUV.x;
    }
    if (textureFlip > 0){
        finalUV.y = 1.0-finalUV.y;
        midgroundUV.y = 1.0/3.0 - midgroundUV.y; // VRay specific
        curtainsUV.y = 1.0 - curtainsUV.y + 2.0/3.0; // VRay specific
    }

    vec3 roomRGB = texture2D(uSampler, vec2(finalUV.x, finalUV.y)).xyz;

    vec3 finalRGB;

    //midground switch
    if (enableMidground > 0){
        vec4 midgroundRGB = texture2D(uSampler, vec2(midgroundUV.x, midgroundUV.y));
        finalRGB = mix(roomRGB,midgroundRGB.xyz,midgroundRGB.w * midgroundMask); //VRay specific
    } else {
        finalRGB = roomRGB;
    }

    //curtains switch
    if (enableCurtains > 0){
        vec4 curtainsRGB = texture2D(uSampler, vec2(curtainsUV.x, curtainsUV.y));
        finalRGB = mix(finalRGB,curtainsRGB.xyz,curtainsRGB.w);
    }

    if (vModelPosition.z > 0.99){
        if(enableToneMap == 1) {
            return toneMapReinhard(finalRGB);
        } else {
            return finalRGB;
        }
    } else {
        return vec3(0.1, 0.1, 0.1);
    }
}
`;
