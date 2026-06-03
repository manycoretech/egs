import { type Intersection, Raycaster } from './Raycaster';
import type { Drawable } from '../drawables/Drawable';
import type { Vector2 } from '../../math/Vector2';
import { TypeAssert } from './TypeAssert';
import type { Camera3D } from '../cameras/Camera3D';
import { Box3 } from '../../math/Box3';
import type { Viewer } from '../../Viewer';
import { hasManagedContentAPI } from '../../ContentAPI';

function ascSort(a: Intersection, b: Intersection): number {
    return a.distance - b.distance;
}

function visitSceneAllRaycastableList(viewer: Viewer, visitor: (obj: Drawable) => any): void {
    const scene = viewer.getScene();
    if (scene) {
        scene.traverseVisible(o => {
            // todo layer
            if (TypeAssert.isDrawable(o)) {
                visitor(o);
            }
        });
    }
}

interface PreTestItem {
    obj: Drawable;
    nearDistance: number;
}

let currentCamera: Camera3D;
let currentRayCaster: Raycaster;
const worldBox = new Box3();
let preTestList: PreTestItem[] = [];
function preTestAndCollect(obj: Drawable): void {
    const geometry = (obj as any).geometry;
    if (geometry.boundingBox === null) {
        geometry.computeBoundingBox();
    }
    const geobbox: Box3 = geometry.boundingBox;
    worldBox.copy(geobbox).applyMatrix4(obj.matrixWorld);
    const boxHitPosition = currentRayCaster.ray.intersectBox(worldBox);
    if (boxHitPosition !== null) {
        preTestList.push({
            obj,
            nearDistance: boxHitPosition.distanceToSquared(currentCamera.position),
        });
    }
}
// pre-filter not possible hit item and sort;
function getTestIntersectionList(raycaster: Raycaster, camera: Camera3D,
    viewer: Viewer, intersectTestList?: Drawable[]): PreTestItem[] {
    preTestList = [];
    currentRayCaster = raycaster;
    currentCamera = camera;
    if (intersectTestList) {
        intersectTestList.forEach(preTestAndCollect);
    } else {
        visitSceneAllRaycastableList(viewer, preTestAndCollect);
    }
    preTestList.sort((testA, testB) => {
        return testA.nearDistance - testB.nearDistance;
    });

    return preTestList;
}

function testAndFindFirst(raycaster: Raycaster, intersectTestList: PreTestItem[]): Intersection[] {
    const resultIntersects: Intersection[] = [];

    let currentMeshNearest = Number.MAX_VALUE;
    let nextBoxNearest = 0;
    let currentIntersectionTest: PreTestItem;
    for (let i = 0; i < intersectTestList.length; i++) {
        currentIntersectionTest = intersectTestList[i];

        const oldIntersectCount = resultIntersects.length;
        currentIntersectionTest.obj.raycast(raycaster, resultIntersects);

        if (i === intersectTestList.length - 1) { // last one
            nextBoxNearest = currentMeshNearest;
        } else {
            nextBoxNearest = intersectTestList[i + 1].nearDistance;
        }

        // after a mesh cast , we found some real hit mesh
        // we test all new hit position, update nearest mesh hit
        const newIntersectionCount = resultIntersects.length - oldIntersectCount;
        if (newIntersectionCount > 0) {
            for (let j = oldIntersectCount; j < resultIntersects.length; j++) {
                currentMeshNearest = Math.min(currentMeshNearest, resultIntersects[j].distance);
            }
        }

        // if we found the new nearest position is near than next not mesh cast test mesh box's near
        // we can early return, because the following mesh is impossible have near point than now
        if (currentMeshNearest <= nextBoxNearest) {
            return resultIntersects.sort(ascSort).slice(0, 1);
        }
    }
    return [];
}

export class Picker {
    readonly raycaster: Raycaster;
    private viewer: Viewer;

    constructor(viewer: Viewer) {
        this.viewer = viewer;
        this.raycaster = new Raycaster();
        this.raycaster.enableScreenSpaceTolerance = true;
    }

    private intersectObject(objects?: Drawable[]): Intersection[] {
        const intersects: Intersection[] = [];
        if (objects) {
            this.raycaster.intersectObjects(objects, true, intersects);
        } else {
            this.raycaster.raycastScene(this.viewer.getScene(), intersects);
        }
        return intersects;
    }

    pick(coordinates: Vector2, camera: Camera3D, pickFirst: boolean = false, objects?: Drawable[]): Intersection[] {
        if (this.viewer.isDestroyed) {
            return [];
        }
        if (hasManagedContentAPI()) {
            // TODO: pickFirst not implemented
            pickFirst = false;
        }
        this.raycaster.setFromCamera(coordinates, camera, this.viewer.canvasContainer.clientHeight);
        return pickFirst ? this.pickFirst(camera, objects) : this.intersectObject(objects);
    }

    pickFirst(camera: Camera3D, objects?: Drawable[]): Intersection[] {
        if (this.viewer.isDestroyed) {
            return [];
        }
        const testList = getTestIntersectionList(this.raycaster, camera, this.viewer, objects);
        return testAndFindFirst(this.raycaster, testList);
    }
}
