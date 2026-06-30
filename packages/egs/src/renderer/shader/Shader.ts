import type { ShaderBuilder } from './builders/ShaderBuilder.js';
import type { WGLProgram } from '../webgl/WGLProgram.js';
import type { WebGLShaderDataType } from '../webgl/WGLConstants.js';
import type { Material } from '../../elements/materials/Material.js';
import type { BuiltInUniformTypes } from '../RenderState/BuiltInUniforms.js';
import type { Camera3D } from '../../scene/cameras/Camera3D.js';
import { logger } from '../../utils/Logger.js';
import type { Deserializer, Serializer, SerializerableDelegated } from '../../utils/Serialization.js';

// Any class implements this interface can be composed in material
// it's the basic abstraction of shading component
export abstract class ShaderComponent implements SerializerableDelegated {
    /**
     * @internal
     */
    __material: Material | undefined;
    /**
     * @internal
     */
    isShaderComponent = true;

    // any ability could hold uniform params to inject in shader
    // and logic related with it. modify the shader in this function
    abstract extendShaderShading(builder: ShaderBuilder): void;
    extendShaderShape(_builder: ShaderBuilder): void {}

    // any ability could hold uniform params, update to webgl in this function
    updateShapeUniforms?(program: WGLProgram): void;
    updateShadingUniforms?(program: WGLProgram): void;

    generateShaderKey?(): string;
    computeShapeKey?(): string;

    abstract className(): string;

    abstract deserialize(ctx: Deserializer): void | Promise<any>;
    abstract serialize(serialize: Serializer): void;

    abstract copy(other: ShaderComponent): any;
    abstract clone(): any;

    constructor() {}
}

// Any class inherits this class means the class will use some parameters components
// inside a shader which will be shared around different shaders such as light stuff.
export abstract class SharedShaderComponent extends ShaderComponent {
    serialize(_: Serializer<any>): void {}
    deserialize(_: Deserializer): void | Promise<void> {}

    referenceSet: Set<Material> = new Set();

    className() {
        logger.unreachable('className must exist');
        return 'SharedShaderComponent';
    }

    clearAllRef() {
        this.referenceSet.clear();
    }

    attachMaterial(m: Material) {
        this.referenceSet.add(m);
    }

    detachMaterial(m: Material) {
        this.referenceSet.delete(m);
    }

    broadcastToRecompile() {
        this.referenceSet.forEach(m => m.notifyRecompileShader());
    }

    broadcastToPropertyChanged() {
        this.referenceSet.forEach(m => m.notifyMaterialPropertyChanged());
    }

    abstract extendShaderShading(builder: ShaderBuilder): void;
    updateImpl(_camera: Camera3D): boolean {
        // empty impl
        return true;
    }
    dirtyKey = -1;
    update(camera: Camera3D) {
        const changed = this.updateImpl(camera);
        if (changed) {
            this.dirtyKey = Math.random();
        }
    }
}

export interface ShaderInputDescriptor {
    name: string;
    type: WebGLShaderDataType;
}

export interface VaryArrayDescriptor {
    des: ShaderInputDescriptor;
    length: number;
}

export interface UniformArrayDescriptor {
    length: number;
    des: ShaderInputDescriptor;
}

export interface UniformBlockDescriptor {
    name: string;
    uniforms: ShaderInputDescriptor[];
}

// ShaderInfo is an interface which defines the parameter and code which is contained by vertex and fragment shader.
export interface ShaderInfo {
    uniforms: ShaderInputDescriptor[];
    uniformArrays: UniformArrayDescriptor[];
    uniformsBlocks: UniformBlockDescriptor[];
    globalUniforms: BuiltInUniformTypes[]; // included in uniforms
    attributes: ShaderInputDescriptor[];
    varyings: ShaderInputDescriptor[];
    vertex: string;
    frag: string;
}
