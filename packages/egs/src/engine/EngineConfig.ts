import {
    type PipelineConfig,
    createPipelineConfig,
    type DeprecatedPipelineConfig,
    createDeprecatedPipelineConfig,
} from '../fx/PipelineConfig.js';
import { Color } from '../math/Color.js';
import { Vector2 } from '../math/Vector2.js';
import { BackgroundMode } from '../scene/renderables/Background.js';
import type { Viewer } from '../Viewer.js';
import { logger } from '../utils/Logger.js';
import type { RenderEngine } from './RenderEngine.js';
import type { Nullable } from '../utils/Utils.js';
import type { PostPipeline } from '../fx/Pipeline.js';
import { GLOBAL_CONFIG } from '../utils/GlobalConfig.js';
import type { DrivenCullingConfig, TextureCompression } from '../fx/plugins/PipelinePlugin.js';
import type { Texture } from '../elements/textures/Texture.js';

export interface ConfigCell<T> {
    get: () => T;
    set: (value: T) => void;
}

/**
 * Rendering modes supported by the viewer engine.
 */
export enum RenderMode {
    SHADING = 'SHADING',
    OUTLINE_ONLY = 'OUTLINE_ONLY',
    OUTLINE_WITH_SHADING = 'OUTLINE_WITH_SHADING',
    TRANSPARENT_LINE = 'TRANSPARENT_LINE',
    TOON_SHADING = 'TOON_SHADING',
    OUTLINE_WITH_TOON = 'OUTLINE_WITH_TOON',
    DEPTH = 'DEPTH',
    NORMAL = 'NORMAL',
}

/**
 * Initialization options used when creating a viewer engine.
 */
export interface EngineInitializeConfig {
    name?: string;
    antialiasing?: boolean;
    alpha?: boolean;
    // EGS will use webgl2/WebGPU if available by default. enable this to prefer webgl1 ctx.
    // This provides way to workaround some platform issue.
    preferWebGL1?: boolean;
    // premultipliedAlpha: boolean;
    /**
     * will pass it to getContext
     * @default true
     * @deprecated not all context support `preserveDrawingBuffer`
     * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext
     */
    preserveDrawingBuffer?: boolean;
}

export interface ViewerConfig {
    forceFrameIsUnstable: ConfigCell<boolean>;
    canvas: {
        renderPixelRatio: ConfigCell<number>;
    };
    autoInstance: {
        enabled: ConfigCell<boolean>;
        autoInstanceKeyEnabled: ConfigCell<boolean>;
    };
    multiMeshMerge: {
        enabled: ConfigCell<boolean>;
    };
    popMeshMerge: {
        enabled: ConfigCell<boolean>;
    };
    gpuDriven: {
        enabled: ConfigCell<boolean>;
        textureCompression: ConfigCell<TextureCompression>;
        frustumCullingEnabled: ConfigCell<boolean>;
        occlusionCullingEnabled: ConfigCell<boolean>;
        detailCullingEnabled: ConfigCell<boolean>;
        layersCullingEnabled: ConfigCell<boolean>;
        triCullingEnabled: ConfigCell<boolean>;
        occlusionCullingBias: ConfigCell<number>;
    };
    shadingMode: {
        physical: ConfigCell<boolean>;
    };
    statistics: {
        enableDrawcallClassify: ConfigCell<boolean>;
    };
    global: {
        meshBVHEnabled: ConfigCell<boolean>;
    };
    scene: {
        onlyDirectLight: ConfigCell<boolean>;
        layerLightEnabled: ConfigCell<boolean>;
        sceneBVHEnabled: ConfigCell<boolean>;
    };
    /**
     * TODO: deprecated pipeline config. we need disable use and remove it.
     */
    renderMode: {
        type: ConfigCell<RenderMode>;
    };
    staticFrameCache: {
        enabled: ConfigCell<boolean>;
    };
    isExtraCopyBeforeScreenEnabled: ConfigCell<boolean>;
    ground: {
        enabled: ConfigCell<boolean>;
        offsetA: ConfigCell<Vector2>;
        gridGapSizeA: ConfigCell<number>;
        colorA: ConfigCell<Color>;
        offsetB: ConfigCell<Vector2>;
        gridGapSizeB: ConfigCell<number>;
        colorB: ConfigCell<Color>;
        isGroundColorEnabled: ConfigCell<boolean>;
        groundColor: ConfigCell<Color>;
    };
    background: {
        active: ConfigCell<BackgroundMode>;
        basic: {
            color: ConfigCell<Color>;
            alpha: ConfigCell<number>;
            texture: ConfigCell<Nullable<Texture>>;
        };
        solid: {
            color: ConfigCell<Color>;
            alpha: ConfigCell<number>;
        };
        envmap: {
            texture: ConfigCell<Texture>;
            luma: ConfigCell<number>;
            verticalRotation: ConfigCell<number>;
            horizonRotation: ConfigCell<number>;
            reverseHorizon: ConfigCell<boolean>;
        };
        gradient: {
            skyColor: ConfigCell<Color>;
            groundColor: ConfigCell<Color>;
        };
        sky: {
            enablePreSkyMap: ConfigCell<boolean>;
            luminance: ConfigCell<number>;
            turbidity: ConfigCell<number>;
            rayleigh: ConfigCell<number>;
            mieCoefficient: ConfigCell<number>;
            mieDirectionalG: ConfigCell<number>;
        };
    };
    coordinateSystem: {
        enabled: ConfigCell<boolean>;
        x: ConfigCell<number>;
        y: ConfigCell<number>;
        size: ConfigCell<number>;
    };
    effects: DeprecatedPipelineConfig;
}

export type ConfigCellImpl<T> = T extends object
    ? { [P in keyof T]?: T[P] extends ConfigCell<infer V> ? V : ConfigCellImpl<T[P]> }
    : T;
type IViewerConfig = ConfigCellImpl<ViewerConfig>;

const DEFAULT_VIEWER_CONFIG: IViewerConfig = {
    staticFrameCache: {
        enabled: false,
    },
    renderMode: {
        type: RenderMode.SHADING,
    },
    effects: {
        outline: {
            highQuality: true,
            outlineColor: new Color(0x000000),
            solidBaseColor: new Color(0xffffff),
        },
        ao: {
            enabled: false,
            aoBias: 0.01,
            aoRadius: 0.5,
            aoIntensity: 1,
            blurKernelRadius: 2,
            blurEdgeSharpness: 0.25,
        },
        planarShadow: {
            enabled: false,
            downScale: 2,
            intensity: 0.5,
            blurKernelRadius: 2,
            maxGroundThickness: 50,
            maxGroundHeight: 50,
        },
        shadow: {
            enableTemporal: false,
            targetJitterSize: 100,
        },
        highLight: {
            enabled: false,
            width: 5,
            colorA: new Color(0.125, 0.71, 0.874),
            colorB: new Color(0.125, 0.71, 0.874),
        },
        transparentLine: {
            opacity: 0,
            transparentColor: new Color(0, 0, 0),
            lineColor: new Color(0, 0, 0),
            edgeThreshold: 25,
        },
        taa: {
            enabled: false,
            maxSample: 32,
        },
    },
    ground: {
        enabled: true,
        offsetA: new Vector2(0, 0),
        gridGapSizeA: 500,
        colorA: new Color(0.98, 0.98, 0.98),
        offsetB: new Vector2(0, 0),
        gridGapSizeB: 5000,
        colorB: new Color(1, 1, 1),
    },
    background: {
        active: BackgroundMode.SkyBackground,
        solid: {
            color: new Color(0.98, 0.98, 0.98),
            alpha: 1,
        },
        gradient: {
            skyColor: new Color(0.458, 0.701, 0.864),
            groundColor: new Color(0.97, 0.98, 0.99),
        },
        sky: {
            luminance: 0.3,
            turbidity: 1,
            rayleigh: 1,
            mieCoefficient: 0.003,
            mieDirectionalG: 0.8,
        },
    },
};

export function createViewConfig(
    viewer: Viewer,
    engine: RenderEngine,
    pipeline: PostPipeline,
    drivenCullingConfig: DrivenCullingConfig,
    updateTlsFlag: (value: boolean) => void,
): ViewerConfig {
    const pipelineConfig: PipelineConfig = createPipelineConfig(pipeline, viewer.renderingConfig);
    const gpuDrivenConfig: ViewerConfig['gpuDriven'] = {
        enabled: {
            get: () => viewer.enableGpuDriven,
            set: v => {
                viewer.renderingConfig.gpuDriven.requested = v;
                viewer.enableGpuDriven = v;
            },
        },
        textureCompression: {
            get: () => viewer.gpuDrivenTextureCompression,
            set: v => {
                viewer.gpuDrivenTextureCompression = v;
            },
        },
        frustumCullingEnabled: {
            get: () => drivenCullingConfig.frustumCullingEnabled,
            set: v => {
                drivenCullingConfig.frustumCullingEnabled = v;
            },
        },
        occlusionCullingEnabled: {
            get: () => drivenCullingConfig.occlusionCullingEnabled,
            set: v => {
                drivenCullingConfig.occlusionCullingEnabled = v;
            },
        },
        detailCullingEnabled: {
            get: () => drivenCullingConfig.detailCullingEnabled,
            set: v => {
                drivenCullingConfig.detailCullingEnabled = v;
            },
        },
        layersCullingEnabled: {
            get: () => drivenCullingConfig.layersCullingEnabled,
            set: v => {
                drivenCullingConfig.layersCullingEnabled = v;
            },
        },
        triCullingEnabled: {
            get: () => drivenCullingConfig.triCullingEnabled,
            set: v => {
                drivenCullingConfig.triCullingEnabled = v;
            },
        },
        occlusionCullingBias: {
            get: () => drivenCullingConfig.occlusionCullingBias,
            set: v => {
                drivenCullingConfig.occlusionCullingBias = v;
            },
        },
    };
    const deprecatedPipelineConfig: DeprecatedPipelineConfig = createDeprecatedPipelineConfig(
        pipeline,
        viewer.renderingConfig,
        value => {
            viewer.enableGpuDriven = value;
        },
        updateTlsFlag,
        pipelineConfig,
    );

    const viewerConfig: ViewerConfig = {
        forceFrameIsUnstable: {
            get: () => engine.forceFrameIsUnstable,
            set: v => {
                engine.forceFrameIsUnstable = v;
            },
        },
        isExtraCopyBeforeScreenEnabled: pipelineConfig.Composite.enabled,
        canvas: {
            renderPixelRatio: {
                get: () => viewer.renderPixelRatio,
                set: v => {
                    viewer.renderPixelRatio = v;
                },
            },
        },
        autoInstance: {
            enabled: {
                get: () => viewer.enableInstance,
                set: v => {
                    viewer.enableInstance = v;
                },
            },
            autoInstanceKeyEnabled: {
                get: () => viewer.enableAutoInstanceKey,
                set: v => {
                    viewer.enableAutoInstanceKey = v;
                },
            },
        },
        multiMeshMerge: {
            enabled: {
                get: () => viewer.enableMultiMeshMerge,
                set: v => {
                    viewer.enableMultiMeshMerge = v;
                },
            },
        },
        popMeshMerge: {
            enabled: {
                get: () => viewer.enableMeshMerge,
                set: v => {
                    viewer.enableMeshMerge = v;
                },
            },
        },
        gpuDriven: gpuDrivenConfig,
        renderMode: deprecatedPipelineConfig.renderMode,
        shadingMode: {
            physical: {
                get: () => engine.enablePhysicalShading,
                set: v => {
                    engine.enablePhysicalShading = v;
                },
            },
        },
        coordinateSystem: {
            enabled: {
                get: () => viewer.coordSysHelper.enabled,
                set: v => {
                    viewer.coordSysHelper.enabled = v;
                },
            },
            x: {
                get: () => viewer.coordSysHelper.getLocation().x,
                set: v => {
                    viewer.coordSysHelper.setLocation(v);
                },
            },
            y: {
                get: () => viewer.coordSysHelper.getLocation().y,
                set: v => {
                    viewer.coordSysHelper.setLocation(undefined, v);
                },
            },
            size: {
                get: () => viewer.coordSysHelper.getLocation().z,
                set: v => {
                    viewer.coordSysHelper.setLocation(undefined, undefined, v);
                },
            },
        },
        statistics: {
            enableDrawcallClassify: {
                get: () => engine.renderer.renderInfo.objectInfo.enableDrawcallClassify,
                set: v => {
                    engine.renderer.renderInfo.objectInfo.enableDrawcallClassify = v;
                },
            },
        },
        global: {
            meshBVHEnabled: {
                get: () => GLOBAL_CONFIG.meshBVHEnabled,
                set: v => {
                    GLOBAL_CONFIG.meshBVHEnabled = v;
                },
            },
        },
        scene: {
            onlyDirectLight: {
                get: () => viewer.getScene().onlyDirectLight,
                set: v => {
                    viewer.getScene().onlyDirectLight = v;
                },
            },
            layerLightEnabled: {
                get: () => viewer.getScene().layerLightEnabled,
                set: v => {
                    viewer.getScene().layerLightEnabled = v;
                },
            },
            sceneBVHEnabled: {
                get: () => viewer.getScene().bvhEnabled,
                set: v => {
                    viewer.getScene().bvhEnabled = v;
                },
            },
        },
        staticFrameCache: deprecatedPipelineConfig.staticFrameCache,
        ground: pipelineConfig.Background.ground,
        background: pipelineConfig.Background.background,
        effects: deprecatedPipelineConfig,
    };
    setViewerConfig(DEFAULT_VIEWER_CONFIG, viewerConfig);
    return viewerConfig;
}

export function listenViewerConfigChange(
    config: ViewerConfig,
    isEquals: (o: any, c: any) => boolean = (o, c) => (c.equals ? c.equals(o) : o === c),
    callback: (path: string, v: any) => void,
    prefix: string = '',
) {
    Object.keys(config).forEach(key => {
        const c = (config as any)[key];
        if (c.set !== undefined) {
            const origin_set = c.set;
            c.set = (value: any) => {
                const origin = c.get?.();
                let is_equals = false;
                try {
                    is_equals = isEquals(origin, value);
                } catch {}
                if (!is_equals) {
                    origin_set(value);
                    callback(`${prefix}_${key}`, value);
                }
            };
            return;
        }
        if (typeof c === 'object') {
            listenViewerConfigChange(c, isEquals, callback, `${prefix ? `${prefix}_` : ''}${key}`);
        }
    });
}

/**
 * Applies values from an plain viewer config object to config.
 */
export function setViewerConfig(data: IViewerConfig, config: ViewerConfig) {
    function setter(data: any, config: any) {
        for (const k in data) {
            const v = data[k];
            if (config[k] === undefined) {
                logger.warn(`SetViewerConfig: unknown config path ${k}`);
                continue;
            }
            if (typeof config[k].set === 'function') {
                config[k].set(v);
            } else if (typeof v === 'object') {
                setter(v, config[k]);
            } else {
                throw new Error('value type invalid');
            }
        }
    }

    try {
        setter(data, config);
    } catch (error) {
        logger.info('SetViewerConfig: config', data);
        logger.unsupported(`SetViewerConfig: ${error}`);
    }
}
