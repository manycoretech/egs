import type { Scene3D } from './Scene3D.js';
import { LightShaderComponent } from '../renderer/shader/components/LightShaderComponent.js';
import { ClippingShaderComponent } from '../renderer/shader/components/ClippingShaderComponent.js';

export class ShaderComponentRegistry {
    static global = new Map<Scene3D, ShaderComponentRegistry>();
    light = new LightShaderComponent();
    dynamicForwardLight = new LightShaderComponent();
    isDeferMode = false;
    clipping = new ClippingShaderComponent(true);

    tooManyLightsForForward() {
        return this.light.enabled_light > 12;
    }

    destroy() {
        this.light.clear();
        this.dynamicForwardLight.clear();
        this.light = null!;
        this.dynamicForwardLight = null!;
    }
}
