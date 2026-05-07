import { RenderMode } from '../engine/EngineConfig';
import { Color } from '../math/Color';
import { PostPipeline } from './Pipeline';
import { Vector3 } from '../math/Vector3';
import { Plane } from '../math/Plane';
import { FilterTarget } from '../elements/materials/quad/FilterMaterial';
import { DebugMode } from './plugins/Debug';

import type { ConfigCell, RenderingConfig } from './plugins/PipelinePlugin';
import type { SceneClipPlugin } from './plugins/SceneClip';
import type { AOPlugin } from './plugins/AO';
import type { BackgroundPlugin } from './plugins/Background';
import type { SplattingPlugin } from './plugins/Splatting';
import type { DeferredPlugin } from './plugins/Deferred';
import type { ForwardPlugin } from './plugins/Forward';
import type { TransparentLinePlugin } from './plugins/TransparentLine';
import type { HighlightPlugin } from './plugins/Highlight';
import type { OutlinePlugin } from './plugins/Outline';
import type { ShadowMapPlugin } from './plugins/ShadowMap';
import type { StylizePlugin } from './plugins/Stylize';
import type { TAAPlugin } from './plugins/TAA';
import type { CompositePlugin } from './plugins/Composite';
import type { DebugPlugin } from './plugins/Debug';
import type { Texture } from '../elements/textures/Texture';

export interface PipelineConfig {
    MSAA: {
        enabled: ConfigCell<boolean>
    },
    SceneClip: ReturnType<SceneClipPlugin['createConfig']>;
    AO: ReturnType<AOPlugin['createConfig']>;
    Background: ReturnType<BackgroundPlugin['createConfig']>;
    Splatting: ReturnType<SplattingPlugin['createConfig']>;
    Deferred: ReturnType<DeferredPlugin['createConfig']>;
    Forward: ReturnType<ForwardPlugin['createConfig']>;
    TransparentLine: ReturnType<TransparentLinePlugin['createConfig']>;
    Outline: ReturnType<OutlinePlugin['createConfig']>;
    Highlight: ReturnType<HighlightPlugin['createConfig']>;
    ShadowMap: ReturnType<ShadowMapPlugin['createConfig']>;
    Stylize: ReturnType<StylizePlugin['createConfig']>;
    TAA: ReturnType<TAAPlugin['createConfig']>;
    Composite: ReturnType<CompositePlugin['createConfig']>;
    Debug: ReturnType<DebugPlugin['createConfig']>;
}

export function createPipelineConfig(pipeline: PostPipeline, renderingConfig: RenderingConfig): PipelineConfig {
    return {
        MSAA: {
            enabled: {
                get: () => renderingConfig.MSAA,
                set: v => {
                    if (v !== renderingConfig.MSAA) {
                        renderingConfig.MSAA = v;
                        pipeline.resetContentCache();
                    }
                }
            }
        },
        SceneClip: pipeline.sceneClipPlugin.createConfig(),
        AO: pipeline.aoPlugin.createConfig(),
        Background: pipeline.backgroundPlugin.createConfig(),
        Splatting: pipeline.splattingPlugin.createConfig(),
        Deferred: pipeline.deferredPlugin.createConfig(),
        Forward: pipeline.forwardPlugin.createConfig(),
        TransparentLine: pipeline.transparentLinePlugin.createConfig(),
        Outline: pipeline.outlinePlugin.createConfig(),
        Highlight: pipeline.highlightPlugin.createConfig(),
        ShadowMap: pipeline.shadowMapPlugin.createConfig(),
        Stylize: pipeline.stylizePlugin.createConfig(),
        TAA: pipeline.taaPlugin.createConfig(),
        Composite: pipeline.compositePlugin.createConfig(),
        Debug: pipeline.debugPlugin.createConfig(),
    };
}

//#region deprecated pipeline config
/**
 * @deprecated
 */
export interface DeprecatedPipelineConfig {
    isPreferMultiSampling: ConfigCell<boolean>,
    debug: {
        enabled: ConfigCell<boolean>,
    }
    renderMode: {
        type: ConfigCell<RenderMode>,
    };
    deferred: {
        enabled: ConfigCell<boolean>,
        enableWhiteBalance: ConfigCell<boolean>,
        enablePseudoColor: ConfigCell<boolean>,
        pseudoColorConfig: ConfigCell<{
            colors: number[],
            gradations: number[],
        }>,
        temperature: ConfigCell<number>,
        autoExposedEnabled: ConfigCell<boolean>,
        keyMinuend: ConfigCell<number>,
        gamma: ConfigCell<number>,
        multiplier: ConfigCell<number>,
        burnValue: ConfigCell<number>,
        contrast: ConfigCell<number>,
    }
    OIT: {
        enabled: ConfigCell<boolean>
    }
    outline: {
        useMrt: ConfigCell<boolean>,
        highQuality: ConfigCell<boolean>,
        enablePhongSolidMode: ConfigCell<boolean>,
        enableDepth: ConfigCell<boolean>,
        outlineMaskEnabled: ConfigCell<boolean>,
        outlineColor: ConfigCell<Color>,
        solidBaseColor: ConfigCell<Color>,
        edgeThickness: ConfigCell<number>,
        indexEdgeThickness: ConfigCell<number>,
        normalEdgeThickness: ConfigCell<number>,
        depthEdgeThickness: ConfigCell<number>,
        coefficient: ConfigCell<number>,
        normalCoefficient: ConfigCell<number>,
        indexCoefficient: ConfigCell<number>,
        depthCoefficient: ConfigCell<number>,
    };
    toon: {
        tooniness: ConfigCell<number>,
        toonColor: ConfigCell<Color>,
        diffuseColor: ConfigCell<Color>,
        smoothnessMin: ConfigCell<number>,
        smoothnessMax: ConfigCell<number>,
    };
    stylizeFilter: {
        enabled: ConfigCell<boolean>,
        /** @deprecated use target instead */
        applyToBackgroundAndGround: ConfigCell<boolean>,
        target: ConfigCell<FilterTarget>,
        brightness: ConfigCell<number>,
        contrast: ConfigCell<number>,
        saturation: ConfigCell<number>,
        hue: ConfigCell<number>
        colorBalance: ConfigCell<Vector3>,
        texture: ConfigCell<Texture | null>,
        lut: ConfigCell<Texture | null>,
    };
    ao: {
        enabled: ConfigCell<boolean>,
        aoBias: ConfigCell<number>,
        aoRadius: ConfigCell<number>,
        aoIntensity: ConfigCell<number>,
        blurKernelRadius: ConfigCell<number>,
        blurEdgeSharpness: ConfigCell<number>
    };
    planarShadow: {
        enabled: ConfigCell<boolean>,
        downScale: ConfigCell<number>,
        intensity: ConfigCell<number>,
        blurKernelRadius: ConfigCell<number>,
        maxGroundThickness: ConfigCell<number>,
        maxGroundHeight: ConfigCell<number>,
    };
    shadow: {
        enableTemporal: ConfigCell<boolean>,
        targetJitterSize: ConfigCell<number>,
    };
    highLight: {
        enabled: ConfigCell<boolean>,
        width: ConfigCell<number>,
        colorA: ConfigCell<Color>,
        colorB: ConfigCell<Color>,
        borderOpacity: ConfigCell<number>,
        innerOpacity: ConfigCell<number>,
    };
    transparentLine: {
        opacity: ConfigCell<number>,
        transparentColor: ConfigCell<Color>,
        lineColor: ConfigCell<Color>,
        edgeThreshold: ConfigCell<number>,
        drawWithOriginalMaterial: ConfigCell<boolean>,
        drawAdditionalLines: ConfigCell<boolean>
    };
    taa: {
        enabled: ConfigCell<boolean>,
        maxSample: ConfigCell<number>,
        outputSample: ConfigCell<number>,
        waitingTime: ConfigCell<number>,
    };
    staticFrameCache: {
        enabled: ConfigCell<boolean>,
    };
    composite: {
        enabled: ConfigCell<boolean>,
        multiSamplingEnabled: ConfigCell<boolean>,
        staticFrameCacheEnabled: ConfigCell<boolean>,
    };
    sceneClip: {
        enabled: ConfigCell<boolean>,
        clippingEnabled: ConfigCell<boolean>,
        clippingPlanes: ConfigCell<Plane[]>,
    };
    Splatting: PipelineConfig['Splatting'];
    __INNER__: PipelineConfig;
}

export function createDeprecatedPipelineConfig(pipeline: PostPipeline, renderingConfig: RenderingConfig, updateGpuDrivenEnabled?: (value: boolean) => void, updateTlsFlag?: (value: boolean) => void, optConfig?: PipelineConfig): DeprecatedPipelineConfig {
    let config: PipelineConfig;
    if (!optConfig) {
        config = createPipelineConfig(pipeline, renderingConfig);
    } else {
        config = optConfig;
    }

    const userConfig = {
        isDeferredShadingEnabled: false,
        isToonEnabled: false,
        isOutlineEnabled: false,
        isSolidEnabled: false,
        isTLEnabled: false,
        isPlanarShadowEnabled: false,
        isStaticFrameCacheEnabled: false,
        isOITEnabled: false,
        isDepthEnabled: false,
        isNormalEnabled: false,
    };

    function resetUserRenderMode() {
        userConfig.isTLEnabled = false;
        userConfig.isToonEnabled = false;
        userConfig.isOutlineEnabled = false;
        userConfig.isSolidEnabled = false;
        userConfig.isDepthEnabled = false;
        userConfig.isNormalEnabled = false;
    }

    function updatePipelineConfig() {
        const tlsCurrentEnabled = config.TransparentLine.enabled.get();

        config.Deferred.enabled.set(false);
        config.Forward.enabled.set(false);
        config.Forward.oit.enabled.set(false);
        config.Forward.solid.enabled.set(false);
        config.Forward.staticFrameCache.enabled.set(false);
        config.Forward.toon.enabled.set(false);
        config.Forward.planarShadow.enabled.set(false);
        config.TransparentLine.enabled.set(false);
        config.Outline.enabled.set(false);
        config.Debug.enabled.set(false);

        if (userConfig.isDepthEnabled) {
            config.Debug.enabled.set(true);
            config.Debug.debugMode.set(DebugMode.Depth);
            return;
        }

        if (userConfig.isNormalEnabled) {
            config.Debug.enabled.set(true);
            config.Debug.debugMode.set(DebugMode.Normal);
            return;
        }

        if (userConfig.isTLEnabled !== tlsCurrentEnabled) {
            updateTlsFlag?.(userConfig.isTLEnabled);
            updateGpuDrivenEnabled?.(renderingConfig.gpuDriven.requested);
        }

        if (userConfig.isDeferredShadingEnabled) {
            config.Deferred.enabled.set(true);
            return;
        }
        if (userConfig.isOutlineEnabled || userConfig.isToonEnabled) {
            config.Forward.enabled.set(true);
            if (userConfig.isOutlineEnabled) {
                config.Outline.enabled.set(true);
            }
            if (userConfig.isToonEnabled) {
                config.Forward.toon.enabled.set(true);
            }
            if (userConfig.isSolidEnabled) {
                config.Forward.solid.enabled.set(true);
            }
            return;
        }
        if (userConfig.isTLEnabled) {
            config.TransparentLine.enabled.set(true);
            return;
        }
        if (userConfig.isStaticFrameCacheEnabled) {
            config.Forward.enabled.set(true);
            config.Forward.staticFrameCache.enabled.set(true);
            return;
        }
        if (userConfig.isPlanarShadowEnabled) {
            config.Forward.enabled.set(true);
            config.Forward.planarShadow.enabled.set(true);
            return;
        }
        if (userConfig.isOITEnabled) {
            config.Forward.enabled.set(true);
            config.Forward.oit.enabled.set(true);
            return;
        }
        config.Forward.enabled.set(true);
    }

    return {
        debug: {
            enabled: {
                get: () => false,
                set: (_v: boolean) => { },
            },
        },
        isPreferMultiSampling: config.Composite.multiSamplingEnabled,
        renderMode: {
            type: {
                get: () => pipeline.currentRenderMode,
                set: (v) => {
                    pipeline.currentRenderMode = v;
                    resetUserRenderMode();
                    switch (v) {
                        case RenderMode.SHADING:
                            break;
                        case RenderMode.TRANSPARENT_LINE:
                            userConfig.isTLEnabled = true;
                            break;
                        case RenderMode.OUTLINE_ONLY:
                            userConfig.isOutlineEnabled = true;
                            userConfig.isSolidEnabled = true;
                            break;
                        case RenderMode.OUTLINE_WITH_SHADING:
                            userConfig.isOutlineEnabled = true;
                            break;
                        case RenderMode.TOON_SHADING:
                            userConfig.isToonEnabled = true;
                            break;
                        case RenderMode.OUTLINE_WITH_TOON:
                            userConfig.isOutlineEnabled = true;
                            userConfig.isToonEnabled = true;
                            break;
                        case RenderMode.DEPTH:
                            userConfig.isDepthEnabled = true;
                            break;
                        case RenderMode.NORMAL:
                            userConfig.isNormalEnabled = true;
                            break;
                    }
                    updatePipelineConfig();
                },
            },
        },
        shadow: config.ShadowMap,
        OIT: {
            enabled: {
                get: () => userConfig.isOITEnabled,
                set: (v: boolean) => {
                    userConfig.isOITEnabled = v;
                    updatePipelineConfig();
                },
            },
        },
        deferred: {
            ...config.Deferred,
            enabled: {
                get: () => userConfig.isDeferredShadingEnabled,
                set: (v: boolean) => {
                    userConfig.isDeferredShadingEnabled = v;
                    updatePipelineConfig();
                },
            },
            pseudoColorConfig: {
                get: () => ({
                    colors: config.Deferred.pseudoColors.get(),
                    gradations: config.Deferred.pseudoGradations.get(),
                }),
                set: ({ colors, gradations }) => {
                    config.Deferred.pseudoColors.set(colors);
                    config.Deferred.pseudoGradations.set(gradations);
                },
            }
        },
        outline: {
            ...config.Outline,
            enablePhongSolidMode: config.Forward.solid.lightMaterialEnabled,
            solidBaseColor: config.Forward.solid.color,
        },
        stylizeFilter: {
            ...config.Stylize,
            applyToBackgroundAndGround: {
                set(v: boolean) {
                    if (v) {
                        config.Stylize.target.set(FilterTarget.All);
                    } else {
                        config.Stylize.target.set(FilterTarget.Foreground);
                    }
                },
                get() {
                    return config.Stylize.target.get() === FilterTarget.All;
                }
            }
        },
        toon: config.Forward.toon,
        ao: config.AO,
        planarShadow: {
            ...config.Forward.planarShadow,
            downScale: {
                get: () => 0,
                set: (_v: number) => { },
            },
            enabled: {
                get: () => userConfig.isPlanarShadowEnabled,
                set: (v: boolean) => {
                    userConfig.isPlanarShadowEnabled = v;
                    updatePipelineConfig();
                },
            },
        },
        highLight: {
            ...config.Highlight,
            colorA: config.Highlight.borderColor,
            colorB: config.Highlight.innerColor,
        },
        transparentLine: config.TransparentLine,
        taa: config.TAA,
        staticFrameCache: {
            enabled: {
                get: () => userConfig.isStaticFrameCacheEnabled,
                set: (v: boolean) => {
                    userConfig.isStaticFrameCacheEnabled = v;
                    updatePipelineConfig();
                },
            },
        },
        composite: config.Composite,
        sceneClip: config.SceneClip,
        Splatting: config.Splatting,
        __INNER__: config,
    };
}
//#endregion
