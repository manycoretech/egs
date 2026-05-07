import { BufferAttribute } from '@qunhe/egs';

// https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_mesh_quantization#encoding-quantized-data
function getNormalizedComponentScale(constructor: any) {
    switch (constructor) {
        case Int8Array:
            return 1 / 127;
        case Uint8Array:
            return 1 / 255;
        case Int16Array:
            return 1 / 32767;
        case Uint16Array:
            return 1 / 65535;
        default:
            throw new Error('EGS.GLTFLoader: Unsupported normalized accessor component type.');
    }
}

export function normalizedAttributeBuffer(attribute: BufferAttribute) {
    let result = attribute.array;
    if (attribute.normalized) {
        const scale = getNormalizedComponentScale(result.constructor);
        const scaled = new Float32Array(result.length);
        for (let j = 0; j < result.length; j++) {
            scaled[j] = result[j] * scale;
        }
        result = scaled;
    }
    return result;
}
