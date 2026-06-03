import type { IRenderer } from '../../renderer/IRenderer';
import { OrthographicCamera } from '../cameras/OrthographicCamera';
import type { Renderable } from './IRenderable';
import type { Material } from '../../elements/materials/Material';
import { Points } from '../drawables/Points';
import { BufferGeometry } from '../../elements/geometries/containers/BufferGeometry';
import { BufferAttribute } from '../../elements/attributes/BufferAttribute';

export class QuadPoints implements Renderable {
    private quadPointsCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    private quadPoints: Points = new Points();
    quadWidth: number;

    setMaterial(mat: Material) {
        this.quadPoints.setMaterials(mat);
    }

    setGeometry(n: number) {
        if (this.quadWidth === n) {
            return;
        }
        this.quadWidth = n;
        const pointGeometry = new BufferGeometry();
        const buffer = new Float32Array(3 * n * n);
        const elementBuffer = new Uint16Array(n * n);
        for (let i = 0; i < elementBuffer.length; i++) {
            buffer[i * 3] = i;
            buffer[i * 3 + 1] = i;
            buffer[i * 3 + 2] = i;
            elementBuffer[i] = i;
        }
        pointGeometry.addAttribute('position', new BufferAttribute(buffer, 3));
        pointGeometry.setIndex(elementBuffer);

        this.quadPoints.geometry = pointGeometry.forceCastTopology();
    }

    config(_: IRenderer) {
        return true;
    }

    render(renderer: IRenderer) {
        const oldCamera = renderer.getCurrentCamera();
        renderer.useCamera(this.quadPointsCamera);
        renderer.setMaterialUploadDirty();
        renderer.renderDrawcall(this.quadPoints.geometry, this.quadPoints.expectOnlyMaterial(), this.quadPoints, null);
        renderer.useCamera(oldCamera);
    }
}
