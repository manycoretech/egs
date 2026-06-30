// @ts-nocheck
// AUTO GENERATED DO NOT MODIFY, IF FOUND COMPILE ERROR RUN "pnpm generate:pipeline-api" in package/egs-main

import type {
    Drawcall,
    DrawableList,
    ProjectedDrawcallList,
    DrawcallListClassifyType,
    RenderObjectsType,
} from '../scene/tools/DrawcallList.js';
import type { IRenderer } from '../renderer/IRenderer.js';
import type { MaterialDispatcher } from '../renderer/MaterialDispatcher.js';
import type { Camera3D } from '../scene/cameras/Camera3D.js';
import type { Drawable } from '../scene/drawables/Drawable.js';
import type { Scene3D } from '../scene/Scene3D.js';
import type { Light } from '../scene/lights/Light.js';
import type { Object3D } from '../scene/Object3D.js';
import type { ShadowMode, PipelineAPI, IPipelineFilter } from './PipelineAPI.js';

let registeredPipelineContentAPI: PipelineAPI | undefined;
export function registerPipelineContentAPI(api: PipelineAPI) {
    registeredPipelineContentAPI = api;
}
export function PipelineContentAPIForRenderingAndFilteringEnabled() {
    return registeredPipelineContentAPI !== undefined;
}
export function removePipelineContentAPI() {
    registeredPipelineContentAPI = undefined;
}

export const PipelineContentBridge: Required<PipelineAPI> = {
    materialDispatcherCreate(m: MaterialDispatcher) {
        try {
            return registeredPipelineContentAPI?.materialDispatcherCreate?.(m);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    materialDispatcherDestroy(m: MaterialDispatcher) {
        try {
            return registeredPipelineContentAPI?.materialDispatcherDestroy?.(m);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    materialDispatcherUpdate(m: MaterialDispatcher) {
        try {
            return registeredPipelineContentAPI?.materialDispatcherUpdate?.(m);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    drawableListCreate(list: DrawableList, capacity?: number) {
        try {
            return registeredPipelineContentAPI?.drawableListCreate?.(list, capacity);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    drawableListCreateFromScene(
        list: DrawableList,
        scene: Scene3D,
        isUseProxy: boolean,
        renderMode?: DrawableRenderMode,
    ) {
        try {
            return registeredPipelineContentAPI?.drawableListCreateFromScene?.(list, scene, isUseProxy, renderMode);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    drawableListCreateFromFilter(list: DrawableList, filter: IPipelineFilter<Drawable>, target: DrawableList) {
        try {
            return registeredPipelineContentAPI?.drawableListCreateFromFilter?.(list, filter, target);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    drawableListAddDrawable(list: DrawableList, drawable: Drawable) {
        try {
            return registeredPipelineContentAPI?.drawableListAddDrawable?.(list, drawable);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    drawableListUpdateSceneAndUse(list: DrawableList, scene: Scene3D) {
        try {
            return registeredPipelineContentAPI?.drawableListUpdateSceneAndUse?.(list, scene);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    drawableListDestroy(list: DrawableList) {
        try {
            return registeredPipelineContentAPI?.drawableListDestroy?.(list);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    drawcallListCreate(
        list: ProjectedDrawcallList,
        camera: Camera3D,
        cameraCulling: boolean,
        classifyType: DrawcallListClassifyType,
        enableLights: boolean,
    ) {
        try {
            return registeredPipelineContentAPI?.drawcallListCreate?.(
                list,
                camera,
                cameraCulling,
                classifyType,
                enableLights,
            );
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    drawcallListCreateFromDynamic(list: ProjectedDrawcallList, scene: Scene3D, camera: Camera3D) {
        try {
            return registeredPipelineContentAPI?.drawcallListCreateFromDynamic?.(list, scene, camera);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    drawcallListCreateFromStatic(list: ProjectedDrawcallList, scene: Scene3D, camera: Camera3D) {
        try {
            return registeredPipelineContentAPI?.drawcallListCreateFromStatic?.(list, scene, camera);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    drawcallListCreateFromDrawableList(
        list: ProjectedDrawcallList,
        drawableList: DrawableList,
        camera: Camera3D,
        cameraCulling: boolean,
        layerCulling: boolean,
        visibilityCulling: boolean,
        selections?: Array<{ groupIndex?: number[]; instanceIndex?: number }>,
    ) {
        try {
            return registeredPipelineContentAPI?.drawcallListCreateFromDrawableList?.(
                list,
                drawableList,
                camera,
                cameraCulling,
                layerCulling,
                visibilityCulling,
                selections,
            );
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    drawcallListDestroy(list: ProjectedDrawcallList) {
        try {
            return registeredPipelineContentAPI?.drawcallListDestroy?.(list);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    renderDrawcallList(
        list: ProjectedDrawcallList,
        renderer: IRenderer,
        renderObjectsType: RenderObjectsType,
        filter?: IPipelineFilter<Drawcall>,
    ) {
        try {
            return registeredPipelineContentAPI?.renderDrawcallList?.(list, renderer, renderObjectsType, filter);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    renderDeferLight(
        renderer: IRenderer,
        scene: Scene3D,
        light: Light,
        shadowMode: ShadowMode,
        deferMesh: Drawable,
        deferCamera: Camera3D,
    ) {
        try {
            return registeredPipelineContentAPI?.renderDeferLight?.(
                renderer,
                scene,
                light,
                shadowMode,
                deferMesh,
                deferCamera,
            );
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    renderDeferLights(
        renderer: IRenderer,
        scene: Scene3D,
        lights: Light[],
        shadowMode: ShadowMode,
        deferMesh: Drawable,
        deferCamera: Camera3D,
    ) {
        try {
            return registeredPipelineContentAPI?.renderDeferLights?.(
                renderer,
                scene,
                lights,
                shadowMode,
                deferMesh,
                deferCamera,
            );
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    getRenderListLength(list: ProjectedDrawcallList, renderObjectsType: RenderObjectsType) {
        try {
            return registeredPipelineContentAPI?.getRenderListLength?.(list, renderObjectsType);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    drawcallListGetCameraClosestDistance(list: DrawableList, camera: Camera3D) {
        try {
            return registeredPipelineContentAPI?.drawcallListGetCameraClosestDistance?.(list, camera);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    prepareTempRenderList(list: Object3D[]) {
        try {
            return registeredPipelineContentAPI?.prepareTempRenderList?.(list);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    cleanupTempRenderList(list: Object3D[]) {
        try {
            return registeredPipelineContentAPI?.cleanupTempRenderList?.(list);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
};
