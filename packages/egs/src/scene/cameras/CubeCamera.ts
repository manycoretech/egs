import { PerspectiveCamera } from './PerspectiveCamera';
import { Vector3 } from '../../math/Vector3';
import type { Matrix4 } from '../../math/Matrix4';
import { ContentBridge } from '../../ContentAPI';

export class CubeCamera {
    cameras: PerspectiveCamera[];

    static cubeDirections = [
        new Vector3(1, 0, 0),
        new Vector3(-1, 0, 0),
        new Vector3(0, 1, 0),
        new Vector3(0, -1, 0),
        new Vector3(0, 0, 1),
        new Vector3(0, 0, -1),
    ];

    static cubeUps = [
        new Vector3(0, -1, 0),
        new Vector3(0, -1, 0),
        new Vector3(0, 0, 1),
        new Vector3(0, 0, -1),
        new Vector3(0, -1, 0),
        new Vector3(0, -1, 0),
    ];

    constructor(fov: number = 90, aspect: number = 1, near: number = 5, far: number = 10000) {
        this.cameras = [];

        const cameraPX = new PerspectiveCamera(fov, aspect, near, far);
        cameraPX.up.set(0, -1, 0);
        cameraPX.lookAt(new Vector3(1, 0, 0));
        this.cameras.push(cameraPX);

        const cameraNX = new PerspectiveCamera(fov, aspect, near, far);
        cameraNX.up.set(0, -1, 0);
        cameraNX.lookAt(new Vector3(-1, 0, 0));
        this.cameras.push(cameraNX);

        const cameraPY = new PerspectiveCamera(fov, aspect, near, far);
        cameraPY.up.set(0, 0, 1);
        cameraPY.lookAt(new Vector3(0, 1, 0));
        this.cameras.push(cameraPY);

        const cameraNY = new PerspectiveCamera(fov, aspect, near, far);
        cameraNY.up.set(0, 0, -1);
        cameraNY.lookAt(new Vector3(0, -1, 0));
        this.cameras.push(cameraNY);

        const cameraPZ = new PerspectiveCamera(fov, aspect, near, far);
        cameraPZ.up.set(0, -1, 0);
        cameraPZ.lookAt(new Vector3(0, 0, 1));
        this.cameras.push(cameraPZ);

        const cameraNZ = new PerspectiveCamera(fov, aspect, near, far);
        cameraNZ.up.set(0, -1, 0);
        cameraNZ.lookAt(new Vector3(0, 0, -1));
        this.cameras.push(cameraNZ);
    }

    update(worldMatrix: Matrix4) {
        this.cameras.forEach((camera, i) => {
            worldMatrix.getPosition(camera.position);

            const target = camera.position.clone().add(CubeCamera.cubeDirections[i]);
            camera.up.copy(CubeCamera.cubeUps[i]);
            camera.lookAt(target);
            camera.updateMatrixWorld();
            camera.updateProjectionMatrix();

            ContentBridge.sceneNodeSyncMatrix(camera);
        });
    }

    destroy() {
        this.cameras.forEach(c => c.destroy());
    }
}
