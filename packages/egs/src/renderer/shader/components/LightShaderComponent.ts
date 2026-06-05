import { logger } from '../../../utils/Logger';
import { Vector3 } from '../../../math/Vector3';
import type { Camera3D } from '../../../scene/cameras/Camera3D';
import type { Drawable } from '../../../scene/drawables/Drawable';
import type { AmbientLight } from '../../../scene/lights/AmbientLight';
import { DirectionalLight, directionLightCollect } from '../../../scene/lights/DirectionalLight';
import { DiskAreaLight, diskAreaLightCollect } from '../../../scene/lights/DiskAreaLight';
import type { HemisphereLight } from '../../../scene/lights/HemisphereLight';
import type { Light } from '../../../scene/lights/Light';
import {
    PointLight,
    pointLightCollect,
    punctualLightIntensityToIrradianceFactor,
} from '../../../scene/lights/PointLight';
import { RectAreaLight, rectAreaLightCollect } from '../../../scene/lights/RectAreaLight';
import { SpotLight, spotLightCollect } from '../../../scene/lights/SpotLight';
import type { Nullable } from '../../../utils/Utils';
import { WebGLShaderDataType } from '../../webgl/WGLConstants';
import type { WGLProgram } from '../../webgl/WGLProgram';
import { ShaderBlockPool } from '../builders/ShaderBlockPool';
import { type ShaderBuilder, ShaderInjectionTypes, ShaderVaryingTypes } from '../builders/ShaderBuilder';
import { unrollLoops } from '../builders/ShaderHelper';
// the inner light system has some agreement on how a material will
import { SharedShaderComponent } from '../Shader';
import type { EnvMapIBLShaderComponent } from './EnvMapIBLShaderComponent';

import type { Shadow } from '../../../scene/shadows/Shadow';
import { Capabilities } from '../../Capabilities';
import { TypeAssert } from '../../../scene/tools/TypeAssert';
import type { Layers } from '../../../scene/tools/Layers';

// receive the light, to use inner light system, one shading stage should provide given interface
export interface LightMaterialComponent {
    generateMaterialForLight(): string;
    RE_Direct?(): string;
    RE_IndirectDiffuse?(): string;
    RE_IndirectSpecular?(): string;
    RE_Direct_RectArea?(): string;
    RE_Direct_DiskArea?(): string;
}

// LightShaderComponent controls the use of ambience, direction, point and spot light.
// So far we only use direct light most of the times.
// This class provides related functions to set up and update lights.
// Indirect light is also supported.

const tempPointVec = new Vector3();
export class LightShaderComponent extends SharedShaderComponent {
    lights: Set<Light> = new Set();
    enabled_light = 0;
    lightHashKeyPrevious: string;
    onlyDirectLight = false;
    activeLayers?: Layers;

    className() {
        return 'LightShaderComponent';
    }

    pointLights: PointLight[] = [];
    pointShadowLength = 0;
    get hasPointShadow() {
        return this.pointShadowLength > 0;
    }
    getNthShadowPointLight(n: number) {
        // pointLights sorted that all shadow enabled is in front
        return this.pointLights[n];
    }

    spotLights: SpotLight[] = [];
    spotShadowLength = 0;
    get hasSpotShadow() {
        return this.spotShadowLength > 0;
    }
    getNthShadowSpotLight(n: number) {
        return this.spotLights[n];
    }

    directionalLights: DirectionalLight[] = [];
    directionalShadowLength = 0;
    get hasDirectionalShadow() {
        return this.directionalShadowLength > 0;
    }
    getNthShadowDirectionalLight(n: number) {
        return this.directionalLights[n];
    }

    createShadowMetaInfo() {
        return {
            directionalShadowCount: this.directionalShadowLength,
            pointShadowCount: this.pointShadowLength,
            spotShadowCount: this.spotShadowLength,
        };
    }

    rectAreaLights: RectAreaLight[] = [];
    diskAreaLights: DiskAreaLight[] = [];
    ambientLight: Nullable<AmbientLight> = null;
    hemiLights: HemisphereLight[] = [];

    updateImpl(camera: Camera3D) {
        if (this.ambientLight) {
            this.ambientLight.refreshUniforms();
        }
        this.directionalLights.forEach(l => l.refreshUniforms(camera.matrixWorldInverse));
        this.pointLights.forEach(l => l.refreshUniforms(camera.matrixWorldInverse));
        this.spotLights.forEach(l => l.refreshUniforms(camera.matrixWorldInverse));
        this.rectAreaLights.forEach(l => l.refreshUniforms(camera.matrixWorldInverse));
        this.diskAreaLights.forEach(l => l.refreshUniforms(camera.matrixWorldInverse));
        return true;
    }

    lightAndShadowHashKey() {
        return (
            `
p${this.pointLights.length} s${this.spotLights.length} d${this.directionalLights.length} a${
                this.ambientLight === null
            } h${this.hemiLights.length} r${this.rectAreaLights.length} r${this.diskAreaLights.length}` +
            this.shadowHashKey() +
            `${this.onlyDirectLight}`
        );
    }

    // this only use for graph selection
    shadowHashKey() {
        return `
ds ${this.directionalShadowLength} ss ${this.spotShadowLength} ps ${this.pointShadowLength}`;
    }

    get hasAnyShadow() {
        return this.hasDirectionalShadow || this.hasSpotShadow || this.hasPointShadow;
    }

    clear() {
        this.pointLights = [];
        this.spotLights = [];
        this.directionalLights = [];
        this.ambientLight = null;
        this.hemiLights = [];
        this.rectAreaLights = [];
        this.diskAreaLights = [];
    }

    dispose() {
        this.clear();
        this.clearAllRef();
    }

    setupOnlyLightSetForLaterRecollecting(lights: Set<Light>) {
        this.clear();
        this.lights = lights;
    }

    // lights selected for transparency in defer rendering
    collectDynamicForwardLightsByDrawable(drawable: Drawable) {
        this.clear();
        let pointLightMax = Infinity;
        this.lights.forEach(l => {
            if (!l.enabled) {
                return;
            }
            if (this.activeLayers && !this.activeLayers.test(l.netLayer)) {
                return;
            }
            // Select the nearest point light.
            if (TypeAssert.isPointLight(l)) {
                const length = tempPointVec.setFromMatrixPosition(drawable.matrixWorld).sub(l.position).length();
                if (length < pointLightMax) {
                    this.pointLights[0] = l;
                    pointLightMax = length;
                }
            } else if (TypeAssert.isSpotLight(l)) {
                // Select the first 4 spotlights that are less than the 60 degree threshold.
                if (!l.isDrawableOutsideLightVolume(drawable) && this.spotLights.length < 4) {
                    this.spotLights.push(l);
                }
            } else if (TypeAssert.isDirectionalLight(l)) {
                // Select first 2 directional lights
                if (this.directionalLights.length < 2) {
                    this.directionalLights.push(l);
                }
            } else if (TypeAssert.isAmbientLight(l)) {
                this.ambientLight = l;
            }
        });
        this.collectLightImpl();
    }

    // lights update from a scene;
    collectLights(lights: Set<Light>) {
        this.clear();
        this.lights = lights;
        this.enabled_light = 0;
        lights.forEach(l => {
            if (!l.enabled) {
                return;
            }
            if (this.activeLayers && !this.activeLayers.test(l.netLayer)) {
                return;
            }
            if (TypeAssert.isPointLight(l)) {
                this.enabled_light++;
                this.pointLights.push(l);
            } else if (TypeAssert.isSpotLight(l)) {
                this.enabled_light++;
                this.spotLights.push(l);
            } else if (TypeAssert.isDirectionalLight(l)) {
                this.enabled_light++;
                this.directionalLights.push(l);
            } else if (TypeAssert.isAmbientLight(l)) {
                this.enabled_light++;
                this.ambientLight = l;
            } else if (TypeAssert.isRectAreaLight(l)) {
                this.enabled_light++;
                this.rectAreaLights.push(l);
            } else if (TypeAssert.isDiskAreaLight(l)) {
                this.enabled_light++;
                this.diskAreaLights.push(l);
            }
        });

        this.collectLightImpl();
    }

    collectLightImpl() {
        const lightHashKeyPrevious = this.lightHashKeyPrevious;

        {
            const [list, count] = reorderList(this.directionalLights);
            this.directionalLights = list;
            this.directionalShadowLength = count;
        }

        {
            const [list, count] = reorderList(this.spotLights);
            this.spotLights = list;
            this.spotShadowLength = count;
        }

        {
            const [list, count] = reorderList(this.pointLights);
            this.pointLights = list;
            this.pointShadowLength = count;
        }

        const lightHashKeyNew = this.lightAndShadowHashKey();
        if (lightHashKeyNew !== lightHashKeyPrevious) {
            this.lightHashKeyPrevious = lightHashKeyNew;
            this.broadcastToRecompile();
        }
    }

    updateShadingUniforms(program: WGLProgram) {
        if (this.ambientLight) {
            this.ambientLight.updateUniforms(program);
        }
        this.pointLights.forEach((l, i) => {
            l.updateUniformForForward(program, i);
        });
        this.spotLights.forEach((l, i) => {
            l.updateUniformForForward(program, i);
        });
        this.directionalLights.forEach((l, i) => {
            l.updateUniformForForward(program, i);
        });
        this.rectAreaLights.forEach((l, i) => {
            l.updateUniformForForward(program, i);
        });
        this.diskAreaLights.forEach((l, i) => {
            l.updateUniformForForward(program, i);
        });
    }

    updateShadowMapUniforms(program: WGLProgram) {
        if (this.hasDirectionalShadow) {
            const textures = this.directionalLights.map(l => l.shadow.getMapOrDefault());
            program.setArrayTexture2D(`directionalShadowMap[0]`, textures);
        }
        if (this.hasSpotShadow) {
            const textures = this.spotLights.map(l => l.shadow.getMapOrDefault());
            program.setArrayTexture2D(`spotShadowMap[0]`, textures);
        }
        if (this.hasPointShadow) {
            const textures = this.pointLights.map(l => l.shadow.getMapOrDefault());
            program.setArrayTextureCube(`pointShadowMap[0]`, textures as any);
        }
        if (this.pointLights.length > 0) {
            const textures = this.pointLights.map(l => l.getIESMapOrDefault());
            program.setArrayTexture2D(`pointIES[0]`, textures);
        }
        if (this.spotLights.length > 0) {
            const textures = this.spotLights.map(l => l.getIESMapOrDefault());
            program.setArrayTexture2D(`spotIES[0]`, textures);
        }
    }

    extendShaderShading(builder: ShaderBuilder) {
        if (this.onlyDirectLight) {
            builder.addFragDefine('#define DEBUG_INCIDENT');
        }

        builder
            .addVarying(ShaderVaryingTypes.viewPosition)
            .addVarying(ShaderVaryingTypes.fragNormal)
            .addFragment(ShaderBlockPool.LightTransmissionModel)
            .addUniform('ambientLightColor', WebGLShaderDataType.Vec3)
            .inject(ShaderInjectionTypes.gl_FragColor, this.buildLightCollector(builder));

        if (this.pointLights.length > 0) {
            const IESLightEffect = Capabilities.IS_WEBGL2
                ? ShaderBlockPool.IESLightEffect
                : ShaderBlockPool.IESLightEffectMock;
            builder
                .addShaderStrProcess(s => s.replace(/NUM_POINT_LIGHTS/g, this.pointLights.length + ''))
                .addShaderStrProcess(s => s.replace(/NUM_POINT_LIGHT_SHADOWS/g, this.pointShadowLength + ''))
                .addFragment(punctualLightIntensityToIrradianceFactor)
                .addFragment(IESLightEffect)
                .addFragment(PointLight.getShaderInclude())
                .addFragmentCustom(PointLight.getHeader(true))
                .addVarying(ShaderVaryingTypes.worldPosition)
                .addUniformStructArray('pointLights', PointLight, this.pointLights.length);

            if (this.hasPointShadow) {
                this.pointLights[0].shadow.extendsShader(builder, this.pointShadowLength);
            }
        }
        if (this.spotLights.length > 0) {
            const IESLightEffect = Capabilities.IS_WEBGL2
                ? ShaderBlockPool.IESLightEffect
                : ShaderBlockPool.IESLightEffectMock;
            builder
                .addShaderStrProcess(s => s.replace(/NUM_SPOT_LIGHTS/g, this.spotLights.length + ''))
                .addShaderStrProcess(s => s.replace(/NUM_SPOT_LIGHT_SHADOWS/g, this.spotShadowLength + ''))
                .addFragment(punctualLightIntensityToIrradianceFactor)
                .addFragment(IESLightEffect)
                .addFragment(SpotLight.getShaderInclude())
                .addFragmentCustom(SpotLight.getHeader(true))
                .addVarying(ShaderVaryingTypes.worldPosition)
                .addUniformStructArray('spotLights', SpotLight, this.spotLights.length);

            if (this.hasSpotShadow) {
                this.spotLights[0].shadow.extendsShader(builder, this.spotShadowLength);
            }
        }
        if (this.rectAreaLights.length > 0) {
            builder
                .addShaderStrProcess(s => s.replace(/NUM_RECT_AREA_LIGHTS/g, this.rectAreaLights.length + ''))
                .addFragment(RectAreaLight.getShaderInclude())
                .addFragmentCustom(RectAreaLight.getHeader(true))
                .addUniformStructArray('rectAreaLights', RectAreaLight, this.rectAreaLights.length);
        }
        if (this.diskAreaLights.length > 0) {
            builder
                .addShaderStrProcess(s => s.replace(/NUM_DISK_AREA_LIGHTS/g, this.diskAreaLights.length + ''))
                .addFragment(DiskAreaLight.getShaderInclude())
                .addFragmentCustom(DiskAreaLight.getHeader(true))
                .addUniformStructArray('diskAreaLights', DiskAreaLight, this.diskAreaLights.length);
        }
        if (this.rectAreaLights.length > 0 || this.diskAreaLights.length > 0) {
            builder
                .addUniform('ltc_1', WebGLShaderDataType.Sampler2D)
                .addUniform('ltc_2', WebGLShaderDataType.Sampler2D);
        }
        if (this.directionalLights.length > 0) {
            builder
                .addShaderStrProcess(s => s.replace(/NUM_DIR_LIGHTS/g, this.directionalLights.length + ''))
                .addShaderStrProcess(s => s.replace(/NUM_DIR_LIGHT_SHADOWS/g, this.directionalShadowLength + ''))
                .addFragment(DirectionalLight.getShaderInclude())
                .addFragmentCustom(DirectionalLight.getHeader(true))
                .addUniformStructArray('directionalLights', DirectionalLight, this.directionalLights.length);

            if (this.hasDirectionalShadow) {
                this.directionalLights[0].shadow.extendsShader(builder, this.directionalShadowLength);
            }
        }
        builder.addShaderStrProcess(s => unrollLoops(s));
    }

    RE_Direct(_builder: ShaderBuilder, mat: LightMaterialComponent) {
        if (mat.RE_Direct === undefined) {
            return '';
        }
        return `
            ${this.pointLights.length > 0 ? pointLightCollect : ''}
            ${this.spotLights.length > 0 ? spotLightCollect : ''}
            ${this.directionalLights.length > 0 ? directionLightCollect : ''}
        `;
    }

    RE_Direct_RectArea(_builder: ShaderBuilder, mat: LightMaterialComponent) {
        if (mat.RE_Direct_RectArea === undefined) {
            return '';
        }
        return `
            ${this.rectAreaLights.length > 0 ? rectAreaLightCollect : ''}
        `;
    }

    RE_Direct_DiskArea(_builder: ShaderBuilder, mat: LightMaterialComponent) {
        if (mat.RE_Direct_DiskArea === undefined) {
            return '';
        }
        return `
            ${this.diskAreaLights.length > 0 ? diskAreaLightCollect : ''}
        `;
    }

    RE_IndirectDiffuse(builder: ShaderBuilder, mat: LightMaterialComponent) {
        if (mat.RE_IndirectDiffuse === undefined) {
            return '';
        }

        let irradianceExt = '';
        const env = builder.getComponent('EnvMapIBL') as EnvMapIBLShaderComponent;
        if (env !== undefined) {
            builder.addFragment(ShaderBlockPool.GetSpecularMIPLevel).addFragment(env.getLightProbeIndirectRadiance());
        }

        if (builder.hasComponent('LightMapChannel')) {
            irradianceExt += 'irradiance += lightMapIrradiance;';
        }

        return `
        vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );

        ${
            this.hemiLights.length === 0
                ? ''
                : `
            #pragma unroll_loop_start
            for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
                irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry );
            }
            #pragma unroll_loop_end
            `
        }

        ${irradianceExt}
        RE_IndirectDiffuse( irradiance, geometry, material, reflectedLight );
        `;
    }

    RE_IndirectSpecular(builder: ShaderBuilder, mat: LightMaterialComponent) {
        if (mat.RE_IndirectSpecular === undefined) {
            return '';
        }

        let radianceExt = '';

        const env = builder.getComponent('EnvMapIBL') as EnvMapIBLShaderComponent;
        if (env !== undefined) {
            radianceExt += envRadianceSample;
        }

        return `
        vec3 radiance = vec3( 0.0 );
        vec3 clearCoatRadiance = vec3( 0.0 );

        ${radianceExt}

        RE_IndirectSpecular( radiance, clearCoatRadiance, geometry, material, reflectedLight );
        `;
    }

    buildLightCollector(builder: ShaderBuilder) {
        if (builder.lightComponent === null) {
            logger.unreachable('cant find lightable material for light component');
            return 'gl_FragColor = vec4(1.0);';
        }
        const mat = builder.lightComponent;

        let reflectedLightExt = '';

        if (builder.hasComponent('AOMapChannel')) {
            reflectedLightExt += 'reflectedLight.indirectDiffuse *= ambientOcclusion;';
        }

        const lightCollector = `
    /**
     * This is a template that can be used to light a material, it uses pluggable
     * RenderEquations (RE)for specific lighting scenarios.
     *
     * Instructions for use:
     * - Ensure that both RE_Direct, RE_IndirectDiffuse and RE_IndirectSpecular are defined
     * - If you have defined an RE_IndirectSpecular, you need to also provide a Material_LightProbeLOD. <---- ???
     * - Create a material parameter that is to be passed as the third parameter to your lighting functions.
     */

    GeometricContext geometry;

    geometry.position = - vViewPosition;
    geometry.normal = normal;
    // https://github.com/mrdoob/three.js/pull/17767
    geometry.viewDir = (projectionMatrix[ 2 ][ 3 ] == - 1.0) ? normalize( vViewPosition ) : vec3(0., 0., 1.);

    ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );

    IncidentLight directLight;

    ${mat.generateMaterialForLight()}

    ${this.RE_Direct(builder, mat)}

    ${this.RE_Direct_RectArea(builder, mat)}
    ${this.RE_Direct_DiskArea(builder, mat)}

    ${this.RE_IndirectDiffuse(builder, mat)}

    ${this.RE_IndirectSpecular(builder, mat)}

    ${reflectedLightExt}

    vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular;

    gl_FragColor = vec4( outgoingLight, opacity );
    `;
        return lightCollector;
    }
    copy(other: LightShaderComponent) {
        return other;
    }
    clone() {
        return new LightShaderComponent().copy(this);
    }
}

const envRadianceSample = `radiance += getLightProbeIndirectRadiance( /*specularLightProbe,*/ geometry, Material_BlinnShininessExponent( material ), maxMipLevel );`;

interface ShadowLight {
    shadow: Shadow<any>;
}

function reorderList<T extends ShadowLight>(lights: T[]): any {
    const hasShadowList = lights.filter(v => v.shadow && v.shadow.enabled);
    return [
        hasShadowList.concat(lights.filter(v => v.shadow === undefined || !v.shadow.enabled)),
        hasShadowList.length,
    ];
}
