import { CombinedObjectGroup } from '../Object3D';
import { Vector3 } from '../../math/Vector3';
import { Mesh } from '../drawables/Mesh';
import { Line } from '../drawables/Line';
import { Color } from '../../math/Color';
import { BufferGeometry, type LineStrip } from '../../elements/geometries/containers/BufferGeometry';
import { BufferAttribute } from '../../elements/attributes/BufferAttribute';
import { LineBasicMaterial } from '../../elements/materials/mesh/LineMaterial';
import { MeshBasicMaterial } from '../../elements/materials/mesh/MeshBasicMaterial';
import { Matrix4 } from '../../math/Matrix4';
import { cone } from '../../elements/geometries/builder/Index';
import { transform } from '../../elements/geometries/operators/Index';

/**
 * Draw a arrow with a head and a line.
 */
export class ArrowHelper extends CombinedObjectGroup {
    line: Line<LineBasicMaterial>;
    cone: Mesh<MeshBasicMaterial>;

    /**
     * @param {Vector3} dir this vector representing the world space direction of arrow. Default is Vector3(0, 0, 1).
     * @param {Vector3} origin the beginning position of arrow's tail. Default is Vector3(0, 0, 0).
     * @param {number} length the length of line. Default is 1.
     * @param {number} color the color of arrow. Default is 0xffff00.
     * @param {number} headLength the height of head. Default is 0.2 * length.
     * @param {number} headWidth the radius of arrow's head. Default is 0.2 * headLength.
     */
    constructor(dir?: Vector3, origin?: Vector3, length?: number, color?: number, headLength?: number, headWidth?: number) {
        super();
        if (dir === undefined) {
            dir = new Vector3(0, 0, 1);
        }
        if (origin === undefined) {
            origin = new Vector3(0, 0, 0);
        }
        if (length === undefined) {
            length = 1;
        }
        if (color === undefined) {
            color = 0xffff00;
        }
        if (headLength === undefined) {
            headLength = 0.2 * length;
        }
        if (headWidth === undefined) {
            headWidth = 0.2 * headLength;
        }

        const lineGeometry = new BufferGeometry<LineStrip>();
        lineGeometry.addAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 0, 1, 0]), 3));
        lineGeometry.index = null!; // TODO: null type
        const coneGeometry = cone({
            radiusBottom: 0.5,
            height: 1,
            radialSegments: 20,
            heightSegments: 1,
        });
        transform(coneGeometry, new Matrix4().translate(0, - 0.5, 0));

        this.position.copy(origin);
        const lineMat = new LineBasicMaterial();
        lineMat.color.color = new Color(color).cloneReadonly();
        this.line = new Line(lineGeometry, lineMat);
        this.add(this.line);

        const meshMat = new MeshBasicMaterial();
        meshMat.color.color = new Color(color).cloneReadonly();
        this.cone = new Mesh(coneGeometry, meshMat);
        this.add(this.cone);

        this.setDirection(dir);
        this.setLength(length, headLength, headWidth);
    }
    /**
     * Change the direction of the arrow.
     */
    setDirection(dir: Vector3) {
        const axis = new Vector3();
        // dir is assumed to be normalized
        if (dir.y > 0.99999) {
            this.quaternion.set(0, 0, 0, 1);
        } else if (dir.y < - 0.99999) {
            this.quaternion.set(1, 0, 0, 0);
        } else {
            axis.set(dir.z, 0, - dir.x).normalize();
            const radians = Math.acos(dir.y);
            this.quaternion.setFromAxisAngle(axis, radians);
        }
    }
    /**
     * Change the length of the arrow includes the line and the head.
     */
    setLength(length: number, headLength?: number, headWidth?: number) {
        if (headLength === undefined) {
            headLength = 0.2 * length;
        }
        if (headWidth === undefined) {
            headWidth = 0.2 * headLength;
        }

        this.line.scale.set(1, Math.max(0, length - headLength), 1);
        this.line.updateMatrix();

        this.cone.scale.set(headWidth, headLength, headWidth);
        this.cone.position.y = length;
        this.cone.updateMatrix();
    }
    /**
     * Change the color of the arrow includes the line and the head.
     */
    setColor(color: Color) {
        this.line.expectOnlyMaterial().color.color = color.cloneReadonly();
        this.cone.expectOnlyMaterial().color.color = color.cloneReadonly();
    }

    copy(source: ArrowHelper) {
        super.copy(source, false);
        this.line.copy(source.line);
        this.cone.copy(source.cone);
        return this;
    }

    clone() {
        return new ArrowHelper().copy(this);
    }

    destroyCombined() {
        this.traverse(o => o.destroyAllResourcesOwned());
    }
}
