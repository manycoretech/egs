import type { LightShaderComponent } from '../../../renderer/shader/components/LightShaderComponent';
import type { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import type { ShaderBuilder } from '../../../renderer/shader/builders/ShaderBuilder';
import { AreaLight } from '../../../scene/lights/AreaLight';
import { Side } from '../../../utils/Constants';
import { materialProperty } from '../../../ContentAPI';
import { ScenePopLODMaterial } from '../base';
import { ShaderComponentRegistry } from '../../../scene/ShaderComponentRegistry';

export abstract class LightableMaterial extends ScenePopLODMaterial {
    isLightableMaterial = true;
    @materialProperty()
    flatShadingNormal = false;

    freeGPU() {
        super.freeGPU();
        ShaderComponentRegistry.global.forEach(s => s.light.detachMaterial(this));
    }

    extendShaderShading(b: ShaderBuilder, _r: ShaderComponentRegistry) {
        if (this.side === Side.DoubleSide) {
            b.addFragDefine('#define DOUBLE_SIDE');
        }
        b.flatShadingNormal = this.flatShadingNormal;
    }

    extendShaderShape(b: ShaderBuilder, r: ShaderComponentRegistry) {
        super.extendShaderShape(b, r);
        b.flatShadingNormal = this.flatShadingNormal;
    }

    getLightSystem(registry: ShaderComponentRegistry): LightShaderComponent {
        if (registry.tooManyLightsForForward()) {
            if (this.transparent || !registry.isDeferMode) {
                registry.dynamicForwardLight.attachMaterial(this);
                return registry.dynamicForwardLight;
            } else {
                registry.light.attachMaterial(this);
                return registry.light;
            }
        } else {
            registry.light.attachMaterial(this);
            return registry.light;
        }
    }

    updateShadingUniforms(program: WGLProgram, r: ShaderComponentRegistry): void {
        const lightComponent = this.getLightSystem(r);
        if (lightComponent.dirtyKey !== program.uniformSkipTag.get('light')) {
            lightComponent.updateShadingUniforms(program);
            program.uniformSkipTag.set('light', lightComponent.dirtyKey);
        }
        // AreaLight contains ltc texture, should not be skipped
        if (lightComponent.rectAreaLights.length > 0 || lightComponent.diskAreaLights.length > 0) {
            AreaLight.updateLTCUniform(program);
        }
        // this only contains shadow map, should not be skipped
        lightComponent.updateShadowMapUniforms(program);
    }

    generateShaderKey(r: ShaderComponentRegistry): string {
        return super.generateShaderKey(r) + this.getLightSystem(r).lightAndShadowHashKey() + this.flatShadingNormal;
    }
}
