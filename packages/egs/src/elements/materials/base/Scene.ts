import { Nullable } from '../../../utils/Utils';
import { Material, copyItem } from '../Material';
import { materialProperty } from '../../../ContentAPI';
import { PopShaderComponent } from '../../../renderer/shader/components/PopShaderComponent';
import { ShaderComponentRegistry } from '../../../scene/ShaderComponentRegistry';
import type { ShaderBuilder } from '../../../renderer/shader/builders/ShaderBuilder';
import type { WGLProgram } from '../../../renderer/webgl/WGLProgram';

export abstract class SceneMaterial extends Material {
    extendShaderShape(builder: ShaderBuilder, _: ShaderComponentRegistry) {
        builder.useCamera(this.useInstance);
    }
    computeShapeKey(_: ShaderComponentRegistry) {
        // SceneMaterial
        return 'c';
    }
    updateShapeUniforms(_1: WGLProgram, _: ShaderComponentRegistry) { }
}

/**
 * Base material class for objects that support scene clipping.
 */
export abstract class SceneClipMaterial extends SceneMaterial {
    @materialProperty()
    enableSceneClipping = false;

    extendShaderShape(builder: ShaderBuilder, r: ShaderComponentRegistry) {
        super.extendShaderShape(builder, r);
        if (this.enableSceneClipping) {
            r.clipping.extendShaderShape(builder);
        }
    }
    generateShaderKey(r: ShaderComponentRegistry): string {
        return super.generateShaderKey(r) + this.computeShapeKey(r);
    }
    computeShapeKey(r: ShaderComponentRegistry) {
        return super.computeShapeKey(r) + (this.enableSceneClipping ? r.clipping.computeShapeKey() : '');
    }
    updateShapeUniforms(p: WGLProgram, r: ShaderComponentRegistry) {
        super.updateShapeUniforms(p, r);
        r.clipping.attachMaterial(this);
        if (this.enableSceneClipping) {
            r.clipping.updateShapeUniforms(p);
        }
    }

    freeGPU() {
        super.freeGPU();
        ShaderComponentRegistry.global.forEach((s: any) => s.clipping.detachMaterial(this));
    }
}

export abstract class ScenePopLODMaterial extends SceneClipMaterial {
    // @shaderComponentInMaterial() //TODO circular dependency
    pop: Nullable<PopShaderComponent> = new PopShaderComponent();
    extendShaderShape(builder: ShaderBuilder, r: ShaderComponentRegistry) {
        super.extendShaderShape(builder, r);
        if (this.pop !== null) { this.pop.extendShaderShape(builder); }
    }

    computeShapeKey(r: ShaderComponentRegistry) {
        return super.computeShapeKey(r) + (this.pop ? 'p' : '');
    }

    generateShaderKey(r: ShaderComponentRegistry): string {
        return super.generateShaderKey(r) + (this.pop ? 'p' : '');
    }

    copyBase(other: ScenePopLODMaterial) {
        super.copyBase(other);
        copyItem(this, other, 'pop');
        return this;
    }
}
