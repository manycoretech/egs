import { Color } from './Color';
import { Vector2 } from './Vector2';
import { Matrix4 } from './Matrix4';
import { Vector3 } from './Vector3';
import { Vector4 } from './Vector4';
import { Matrix3 } from './Matrix3';

/**
 * Factory helpers that create readonly math value wrappers.
 */
export const readonlyMath = {
    color: function color(color_or_r?: string | Color | number, g?: number, b?: number) {
        return new Color(color_or_r, g, b).cloneReadonly();
    },
    vec2: function vec2(x?: number, y?: number) {
        return new Vector2(x, y).cloneReadonly();
    },
    vec3: function vec3(x?: number, y?: number, z?: number) {
        return new Vector3(x, y, z).cloneReadonly();
    },
    vec4: function vec4(x?: number, y?: number, z?: number, w?: number) {
        return new Vector4(x, y, z, w).cloneReadonly();
    },
    mat3: function mat3() {
        return new Matrix3().cloneReadonly();
    },
    mat4: function mat4() {
        return new Matrix4().cloneReadonly();
    }
};
