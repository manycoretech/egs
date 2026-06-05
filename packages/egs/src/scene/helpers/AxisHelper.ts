import { LineSegments } from '../drawables/LineSegments';
import { BufferGeometry, type LineList } from '../../elements/geometries/containers/BufferGeometry';
import { BufferAttribute } from '../../elements/attributes/BufferAttribute';
import { LineBasicMaterial } from '../../elements/materials/mesh/LineMaterial';
/**
 * An axis object to visualize the 3 axes in a simple way.
 * The X axis is red.
 * The Y axis is green.
 * The Z axis is blue.
 */
export class AxisHelper extends LineSegments<LineBasicMaterial> {
    /**
     * Initialize this object.
     * @param size (optional) size of the lines representing the axes. Default is 1.
     */
    constructor(size?: number) {
        size = size || 1;

        const vertices = [0, 0, 0, size, 0, 0, 0, 0, 0, 0, size, 0, 0, 0, 0, 0, 0, size];

        const colors = [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1];

        const geometry = new BufferGeometry<LineList>();
        geometry.addAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
        geometry.addAttribute('color', new BufferAttribute(new Float32Array(colors), 3));

        const material = new LineBasicMaterial();
        material.enableVertexColor = true;

        super(geometry, material);
    }
}
