
import { LineSegments } from '../drawables/LineSegments';
import { Color } from '../../math/Color';
import { BufferGeometry, type LineList } from '../../elements/geometries/containers/BufferGeometry';
import { BufferAttribute } from '../../elements/attributes/BufferAttribute';
import { LineBasicMaterial } from '../../elements/materials/mesh/LineMaterial';
/**
 * This class is used to draw a square grid which is divided into four area by a cross coordinate system.
 */
export class GridHelper extends LineSegments<LineBasicMaterial> {
    /**
     * @param size length of side. Default is 10.
     * @param divisions the number of division of one side. Default is 10.
     * @param color1 the color of coordinate system. Default is 0x444444.
     * @param color2 the color of item's side. Default is 0x888888.
     */
    constructor(size?: number, divisions?: number, color1?: Color | number, color2?: Color | number) {
        size = size || 10;
        divisions = divisions || 10;
        color1 = new Color(color1 !== undefined ? color1 : 0x444444);
        color2 = new Color(color2 !== undefined ? color2 : 0x888888);

        const center = divisions / 2;
        const step = size / divisions;
        const halfSize = size / 2;

        const vertices: number[] = [];
        const colors: number[] = [];

        for (let i = 0, j = 0, k = - halfSize; i <= divisions; i++ , k += step) {

            vertices.push(- halfSize, 0, k, halfSize, 0, k);
            vertices.push(k, 0, - halfSize, k, 0, halfSize);

            const color = i === center ? color1 : color2;

            color.toArray(colors, j); j += 3;
            color.toArray(colors, j); j += 3;
            color.toArray(colors, j); j += 3;
            color.toArray(colors, j); j += 3;

        }

        const geometry = new BufferGeometry<LineList>();
        geometry.addAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
        geometry.addAttribute('color', new BufferAttribute(new Float32Array(colors), 3));

        const material = new LineBasicMaterial();
        material.enableVertexColor = true;
        super(geometry, material);
    }
}
