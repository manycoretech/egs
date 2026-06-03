import { ShaderComponent } from '../Shader';
import { type ShaderBuilder, ShaderInjectionTypes } from '../builders/ShaderBuilder';
import { ShaderBlockPool } from '../builders/ShaderBlockPool';
import type { Serializer, Deserializer } from '../../../utils/Serialization';
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
    className() {
        return 'PopShaderComponent';
    }

    extendShaderShading(_builder: ShaderBuilder) { }
    extendShaderShape(builder: ShaderBuilder) {
        builder
            .addGlobalUniform(BuiltInUniformTypes.lodInfo)
            .addVertex(ShaderBlockPool.PopComponentTransform)
            .inject(ShaderInjectionTypes.position,
                'position = transformPosition(position);'
            );
    }

    computeShapeKey(): string {
        return 'pop';
    }

    copy(_: PopShaderComponent) {
        return this;
    }

    clone() {
        return new PopShaderComponent().copy(this);
    }

    serialize(_ctx: Serializer<any>): void { }
    deserialize(_ctx: Deserializer): void | Promise<void> { }
}
