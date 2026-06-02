import { SceneAdaptor } from '../fx/SceneAdaptor';
import { DrawableList, ProjectedDrawcallList } from '../scene/tools/DrawcallList';
import { Scene3D } from '../scene/Scene3D';
import { Camera3D } from '../scene/cameras/Camera3D';
import type { Nullable } from '../utils/Utils';

export class SnapShotAdaptor extends SceneAdaptor {
    objectToSnapShot = new DrawableList();
    objectToSnapShotProjected: Nullable<ProjectedDrawcallList> = null;

    constructor(camera: Camera3D, objectToSnapShot: DrawableList, scene: Scene3D) {
        super(scene, camera);
        this.objectToSnapShot = objectToSnapShot;
    }

    get origin() {
        return this.objectToSnapShot;
    }

    get default() {
        if (this.objectToSnapShotProjected === null) {
            this.objectToSnapShotProjected = this.objectToSnapShot.project(this.camera, false);
            this.objectToSnapShotProjected.useOnce = false;
        }
        return this.objectToSnapShotProjected;
    }

    destroy() {
        super.destroy();
        if (this.objectToSnapShot) {
            this.objectToSnapShot.destroy();
        }
        if (this.objectToSnapShotProjected) {
            this.objectToSnapShotProjected.destroy();
        }
    }
}
