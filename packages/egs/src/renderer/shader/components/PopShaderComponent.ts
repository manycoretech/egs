import { ShaderComponent } from '../Shader';
import { ShaderBuilder, ShaderInjectionTypes } from '../builders/ShaderBuilder';
import { ShaderBlockPool } from '../builders/ShaderBlockPool';
import { Serializer, Deserializer } from '../../../utils/Serialization';
import { BuiltInUniformTypes } from '../../RenderState/BuiltInUniforms';

// We store max level position in attributes.
// position = ((gridPosition >> precision << precision) + HALF_GRID) * vertexGridSize + boxMin.
//
// let vertexConstant = boxMin + HALF_GRID * vertexGridSize
// so position = ((gridPosition >> precision << precision)  * vertexGridSize + vertexConstant
//
// let maxLevelPrecision = 0
// so maxLevelPosition = gridPosition * vertexGridSize + vertexConstant.
export class PopShaderComponent extends ShaderComponent {
    public className() {
        return 'PopShaderComponent';
    }

    public extendShaderShading(_builder: ShaderBuilder) { }
    public extendShaderShape(builder: ShaderBuilder) {
        builder
            .addGlobalUniform(BuiltInUniformTypes.lodInfo)
            .addVertex(ShaderBlockPool.PopComponentTransform)
            .inject(ShaderInjectionTypes.position,
                'position = transformPosition(position);'
            );
    }

    public computeShapeKey(): string {
        return 'pop';
    }

    public copy(_: PopShaderComponent) {
        return this;
    }

    public clone() {
        return new PopShaderComponent().copy(this);
    }

    public serialize(_ctx: Serializer<any>): void { }
    public deserialize(_ctx: Deserializer): void | Promise<void> { }
}
