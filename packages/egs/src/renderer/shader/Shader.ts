import { ShaderBuilder } from './builders/ShaderBuilder';
import { WGLProgram } from '../webgl/WGLProgram';
import { WebGLShaderDataType } from '../webgl/WGLConstants';
import { Material } from '../../elements/materials/Material';
import { BuiltInUniformTypes } from '../RenderState/BuiltInUniforms';
import { Camera3D } from '../../scene/cameras/Camera3D';
import { logger } from '../../utils/Logger';
import { Deserializer, Serializer, SerializerableDelegated } from '../../utils/Serialization';

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
    extendShaderShape(_builder: ShaderBuilder): void { }

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

    constructor() { }
}

// Any class inherits this class means the class will use some parameters components
// inside a shader which will be shared around different shaders such as light stuff.
export abstract class SharedShaderComponent extends ShaderComponent {
    public serialize(_: Serializer<any>): void { }
    public deserialize(_: Deserializer): void | Promise<void> { }

    public referenceSet: Set<Material> = new Set();

    public className() {
        logger.unreachable('className must exist');
        return 'SharedShaderComponent';
    }

    public clearAllRef() {
        this.referenceSet.clear();
    }

    public attachMaterial(m: Material) {
        this.referenceSet.add(m);
    }

    public detachMaterial(m: Material) {
        this.referenceSet.delete(m);
    }

    public broadcastToRecompile() {
        this.referenceSet.forEach(m => m.notifyRecompileShader());
    }

    public broadcastToPropertyChanged() {
        this.referenceSet.forEach(m => m.notifyMaterialPropertyChanged());
    }

    abstract extendShaderShading(builder: ShaderBuilder): void;
    public updateImpl(_camera: Camera3D): boolean {
        // empty impl
        return true;
    }
    public dirtyKey = -1;
    public update(camera: Camera3D) {
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
    des: ShaderInputDescriptor,
    length: number
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
