import { logger } from '@qunhe/egs-lib';
import type { Vector4 } from '../../math/Vector4.js';
import { PipelinePlugin } from './PipelinePlugin.js';
import type { HashKeyBuilder } from '../../utils/HashKeyBuilder.js';
import type { RenderGraph } from '../../rendergraph/RenderGraph.js';
import { pass, target, pingpong, colorAttachment } from '../../rendergraph/NodeMakers.js';
import { RendererBackend, RendererState } from '../../renderer/IRenderer.js';
import type { SceneAdaptor, SceneAdaptorDispatcher } from '../SceneAdaptor.js';
import { drawQuad, type RendererAdaptor } from '../RendererAdaptor.js';
import { DrawMode, SamplerFilter } from '../../utils/Constants.js';
import { SplatPackMaterial } from '../../elements/materials/quad/SplatPackMaterial.js';
import { SplatSortMaterial } from '../../elements/materials/quad/SplatSortMaterial.js';
import { SplatPrecalculateMaterial } from '../../elements/materials/quad/SplatPrecalculateMaterial.js';
import type { RenderTarget } from '../../elements/textures/RenderTarget.js';
import { Mesh } from '../../scene/drawables/Mesh.js';
import { InstancedBufferGeometry } from '../../elements/geometries/containers/InstancedBufferGeometry.js';
import { SplattingMaterial, SplattingRenderMode } from '../../elements/materials/mesh/SplattingMaterial.js';
import { BufferAttribute } from '../../elements/attributes/BufferAttribute.js';
import { SplatKernelHighlightMaterial } from '../../elements/materials/mesh/SplatKernelHighlightMaterial.js';
import { SplatReorderMaterial } from '../../elements/materials/quad/SplatReorderMaterial.js';
import { Matrix4 } from '../../math/Matrix4.js';
import { Layers } from '../../scene/tools/Layers.js';
import { Vector3 } from '../../math/Vector3.js';
import { Quaternion } from '../../math/Quaternion.js';
import { ToneMappingMaterial, type ToneMapping } from '../../elements/materials/quad/ToneMappingMaterial.js';
import { ColorTransfer } from '../../elements/materials/Material.js';
import type { Size } from '../../utils/Utils.js';
import type { Splat } from '../../scene/splat/Splat.js';
import { TextureFormat, TextureDimension, TextureViewDimension } from '../../elements/textures/types.js';
import { SourceTexture } from '../../elements/textures/SourceTexture.js';

/** Parameters shared by the Splatting plugin and native GPU renderer. */
export interface SplattingOptions {
    preBlurAmount: number;
    blurAmount: number;
    focalAdjustment: number;
    maxStdDev: number;
    maxPixelRadius: number;
    detailCullingThreshold: number;
    normalizedFalloff: boolean;
    renderMode: number;
    selectedColor: { x: number; y: number; z: number; w: number };
    ringSize: number;
    highlightKernelEnabled: boolean;
    highPrecisionEnabled: boolean;
    precalculateEnabled: boolean;
    cameraRelativeEnabled: boolean;
}

export type SplatKernelOptions = Pick<SplatKernelHighlightMaterial, 'size' | 'color' | 'selectedColor'>;

let sortSplats: (
    count: number,
    sorting: Uint16Array | Uint32Array,
    order: Uint32Array,
) => Promise<{ activeCount: number; sorting: Uint16Array | Uint32Array; ordering: Uint32Array }> = async function (
    _count: number,
    sorting: Uint16Array | Uint32Array,
    order: Uint32Array,
) {
    logger.error(`sortSplats is not registered.`);
    return { activeCount: 0, sorting, ordering: order.fill(0) };
};
export function setSortSplats(fn: typeof sortSplats) {
    sortSplats = fn;
}

interface SplatCache {
    version: number;
    modelViewMatrix: Matrix4;
    offset: number;
    count: number;
}

const tempMat = new Matrix4();
const tempVec0 = new Vector3();
const tempVec1 = new Vector3();
const tempVec2 = new Vector3();
const tempQuat0 = new Quaternion();
const tempQuat1 = new Quaternion();

const SPLAT_BLOCK_COUNT = 128;
export class SplattingPlugin extends PipelinePlugin {
    PLUGIN_NAME = 'Splatting';

    private isDestroyed: boolean = false;
    private forceUpdate: boolean = false;
    private shouldRenderNextFrame: boolean = false;

    private packQueue = new Set<number>();
    private packMaterial = new SplatPackMaterial();
    private packQuad = drawQuad(this.packMaterial);
    private packForceUnstableEnabled: boolean = false;
    private packHighPrecisionEnabled: boolean = false;
    private packCameraRelativeEnabled: boolean = true;
    private packCameraRelativeUpdateDistanceThreshold: number = 10;
    private packCameraRelativeOrigin: Vector3 = new Vector3(0, 0, 0);
    private packAttachSize: Size = { width: 1, height: 1 };

    private precalculateEnabled: boolean = true;
    private precalculateQueue = new Set<number>();
    private precalculateMaterial = new SplatPrecalculateMaterial();
    private precalculateQuad = drawQuad(this.precalculateMaterial);

    private isSortDirty: boolean = false;
    private isSorting: boolean = false;
    private sortMinIntervalMs: number = 0;
    private sortHighPrecisionEnabled: boolean = false;
    private sortSplatDistance: number = 0.1;
    private sortSplatCoorient: number = 0.99999;
    private sortCameraDistance: number = 1;
    private sortCameraCoorient: number = 0.99;
    private sortLastTime: number = -Infinity;
    private sortPingPongTarget = pingpong('sorted_splats_target');
    private sortMaterial = new SplatSortMaterial();
    private sortQuad = drawQuad(this.sortMaterial);

    private reorderMaterial = new SplatReorderMaterial();
    private reorderQuad = drawQuad(this.reorderMaterial);
    private reorderIsDirty: boolean = false;

    private splattingMesh = new Mesh();
    private splattingGeometry = new InstancedBufferGeometry();
    private splattingMaterial = new SplattingMaterial();

    private compositeEnabled: boolean = false;
    private compositeHighPrecisionEnabled: boolean = false;
    private toneMappingMaterial = new ToneMappingMaterial();

    private highlightKernelEnabled: boolean = false;
    private highlightKernelMesh = new Mesh();
    private highlightKernelGeometry = new InstancedBufferGeometry();
    private highlightKernelMaterial = new SplatKernelHighlightMaterial();

    get envSupported() {
        const backend = this.renderer.renderer.backend;
        return backend === RendererBackend.WEBGL2_JS || backend === RendererBackend.WEBGPU_WASM;
    }

    get enabled() {
        return this._enabled && this.scene.adaptor.scene.splatManager.totalCount > 0;
    }
    set enabled(v: boolean) {
        this._enabled = v;
    }

    get shouldRender() {
        return this.enabled && (this.shouldRenderNextFrame || this.isSortDirty || this.isSorting);
    }

    constructor(scene: SceneAdaptorDispatcher, renderer: RendererAdaptor) {
        super(scene, renderer);
        const indexArr = new Uint16Array(6 * SPLAT_BLOCK_COUNT);
        const positionArr = new Float32Array(12 * SPLAT_BLOCK_COUNT);
        for (let i = 0; i < SPLAT_BLOCK_COUNT; i++) {
            const i4 = 4 * i;
            indexArr.set([i4, i4 + 1, i4 + 2, i4, i4 + 2, i4 + 3], i * 6);
            positionArr.set([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], i * 12);
        }
        this.splattingGeometry.index = new BufferAttribute(indexArr, 1);
        this.splattingGeometry.setAttribute('position', new BufferAttribute(positionArr, 3));
        this.reorderMaterial.orderTex = new SourceTexture(
            TextureDimension.D2,
            TextureViewDimension.D2,
            TextureFormat.R32Uint,
            1,
            1,
            1,
            false,
            false,
        )
            .configAsDataTexture()
            .setLevelData(new Uint32Array([0]), 0);
        this.highlightKernelMesh.drawMode = DrawMode.Points;
        this.highlightKernelGeometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0]), 3));
        this.toneMappingMaterial.inputTransfer = ColorTransfer.SrgbToLinear;
    }

    private sortCurrentVersion: number = 0;
    private sortLastVersion: number = 0;
    private sortingBuffer?: Uint32Array;
    private sortTaskRunning: boolean = false;
    private pendingSortTask?: { count: number; target: RenderTarget; splats: Splat[]; highPrecision: boolean };
    private orderBuffer?: Uint32Array;
    private orderLayout: Array<{ id: number; count: number }> = [];
    private async flushSortTask() {
        const renderer = this.renderer.renderer;
        const isCancelled = () => this.isDestroyed || renderer.rendererStatus.state !== RendererState.Ready;
        // this.pendingSortTask maybe undefined because of async
        if (
            isCancelled() ||
            this.sortCurrentVersion === this.sortLastVersion ||
            this.sortTaskRunning ||
            !this.pendingSortTask
        ) {
            return;
        }

        this.sortTaskRunning = true;
        this.isSorting = true;
        const { reorderMaterial, sortLastVersion } = this;
        try {
            this.sortPingPongTarget.tick();

            const { count, target, splats, highPrecision } = this.pendingSortTask;
            const orderLayout = splats.map(splat => ({ id: splat.id, count: splat.counts }));

            const { width, height } = target;
            const pixelCount = width * height;
            let sorting = this.sortingBuffer;
            if (!sorting || pixelCount > sorting.length) {
                sorting = new Uint32Array(pixelCount);
            }
            await renderer.readPixelsAsync(target, { x: 0, y: 0, width, height }, sorting);
            if (isCancelled()) {
                return;
            }

            const orderWidth = Math.min(
                2 ** Math.ceil(Math.log2(Math.sqrt(count))),
                renderer.limits.maxTextureDimension2D,
            );
            let orderBuffer = this.orderBuffer;
            if (!orderBuffer || count > orderBuffer.length) {
                orderBuffer = new Uint32Array(orderWidth * Math.ceil(count / orderWidth));
            }
            const {
                activeCount,
                sorting: backSorting,
                ordering,
            } = await sortSplats(
                count,
                highPrecision ? new Uint32Array(sorting.buffer) : new Uint16Array(sorting.buffer),
                orderBuffer,
            );
            if (isCancelled()) {
                return;
            }

            this.sortingBuffer = new Uint32Array(backSorting.buffer);
            const prevOrderTex = reorderMaterial.orderTex;
            prevOrderTex.freeGPU();
            this.orderBuffer = prevOrderTex.getLevelLayerSource(0) as Uint32Array;

            this.splattingGeometry.instancedCount = Math.ceil(activeCount / SPLAT_BLOCK_COUNT);
            this.splattingMaterial.count = this.highlightKernelGeometry.instancedCount = activeCount;
            const w = Math.max(1, orderWidth);
            const h = Math.max(1, Math.ceil(activeCount / w));
            reorderMaterial.orderTex = new SourceTexture(
                TextureDimension.D2,
                TextureViewDimension.D2,
                TextureFormat.R32Uint,
                w,
                h,
                1,
                false,
                false,
            )
                .configAsDataTexture()
                .setLevelData(ordering.subarray(0, w * h), 0);

            renderer.queueFlushTexture(reorderMaterial.orderTex);
            renderer.flushCommands();
            this.orderLayout = orderLayout;
            for (const splat of splats) {
                splat.onSorted();
            }

            this.reorderIsDirty = true;
            this.sortCurrentVersion = sortLastVersion;
            if (this.sortCurrentVersion >= this.sortLastVersion) {
                this.isSorting = false;
                this.shouldRenderNextFrame = true;
            }
        } catch (error) {
            if (!isCancelled()) {
                logger.warn('Failed to sort splats', error);
            }
            return;
        } finally {
            this.sortTaskRunning = false;
            if (!this.isDestroyed && this.sortCurrentVersion !== sortLastVersion) {
                this.isSortDirty = true;
            }
        }
        this.flushSortTask();
    }

    private addSortTask(count: number, target: RenderTarget, splats: Splat[]) {
        this.pendingSortTask = { count, target, splats, highPrecision: this.sortHighPrecisionEnabled };
        this.sortLastVersion++;
    }

    destroy() {
        this.isDestroyed = true;
        this.isSorting = false;
        this.pendingSortTask = undefined;
    }

    private prevSceneVersion: number = 0;
    private prevSplatCache = new Map<number, SplatCache>(); // <objectId, SplatCache>
    private prevSortCameraMatrix?: Matrix4;
    private prevSortCameraLayer: Layers = new Layers();
    updateEffect(sceneAdaptor: SceneAdaptor) {
        if (this.renderer.renderer.backend === RendererBackend.WEBGPU_WASM) {
            this.updateEffectWebGPU(sceneAdaptor);
            return;
        }
        const {
            forceUpdate,
            sortSplatDistance,
            sortSplatCoorient,
            sortCameraDistance,
            sortCameraCoorient,
            prevSceneVersion,
            prevSplatCache,
            prevSortCameraMatrix,
            prevSortCameraLayer,
            orderLayout,
            reorderMaterial,
            packForceUnstableEnabled,
            packCameraRelativeEnabled,
            packCameraRelativeOrigin,
            packCameraRelativeUpdateDistanceThreshold,
            packQueue,
            precalculateQueue,
        } = this;

        const {
            scene: { splatManager },
            camera,
        } = sceneAdaptor;
        camera.updateMatrixWorld();

        const splats = splatManager.splats;
        const { rangeArr } = reorderMaterial;
        let rangeCount = 0;
        let start = 0;
        let removedCount = 0;
        let splatIndex = 0;
        for (const { id, count } of orderLayout) {
            const isDeleted = id !== splats[splatIndex]?.id;
            const end = start + count;
            // Deleted splats move outside packed storage; surviving splats close the gaps.
            const offset = isDeleted ? 1 << 30 : -removedCount;
            if (offset !== 0) {
                const prevRange = (rangeCount - 1) * 4;
                if (rangeCount > 0 && rangeArr[prevRange + 1] === start && rangeArr[prevRange + 2] === offset) {
                    rangeArr[prevRange + 1] = end;
                } else {
                    rangeArr[rangeCount * 4] = start;
                    rangeArr[rangeCount * 4 + 1] = end;
                    rangeArr[rangeCount * 4 + 2] = offset;
                    rangeCount++;
                }
            }
            if (isDeleted) {
                removedCount += count;
            } else {
                splatIndex++;
            }
            start = end;
        }
        reorderMaterial.count = rangeCount;

        const prevSplats = new Set(prevSplatCache.keys());
        for (const splat of splats) {
            if (!prevSplats.delete(splat.id)) {
                splat.updateMatrixWorld();
                prevSplatCache.set(splat.id, {
                    version: splat.version,
                    modelViewMatrix: splat.matrixWorld.clone(),
                    offset: -1,
                    count: 0,
                });
            }
        }
        for (const id of prevSplats) {
            prevSplatCache.delete(id);
        }

        const isSceneDirty = prevSceneVersion !== splatManager.sceneVersion;
        if (isSceneDirty) {
            this.prevSceneVersion = splatManager.sceneVersion;
        }
        const isCameraLayerDirty = prevSortCameraLayer.mask !== camera.netLayer.mask;
        if (isCameraLayerDirty) {
            prevSortCameraLayer.mask = camera.netLayer.mask;
        }
        camera.matrixWorld.getPosition(tempVec0);
        const packCameraRelativeCenterIsDirty =
            packCameraRelativeEnabled &&
            tempVec0.sub(packCameraRelativeOrigin).length() > packCameraRelativeUpdateDistanceThreshold;
        if (forceUpdate || packCameraRelativeCenterIsDirty) {
            if (packCameraRelativeEnabled) {
                camera.matrixWorld.getPosition(packCameraRelativeOrigin);
            } else {
                packCameraRelativeOrigin.set(0, 0, 0);
            }
        }
        const storageChanged = splatManager.totalCount > this.packAttachSize.width * this.packAttachSize.height;
        const cameraInverseMatrix = camera.matrixWorldInverse;
        let packedOffset = 0;
        for (let i = 0; i < splats.length; i++) {
            const splat = splats[i];
            const cache = prevSplatCache.get(splat.id)!;
            const offset = packedOffset;
            packedOffset += splat.counts;
            const isPackDirty =
                packForceUnstableEnabled ||
                forceUpdate ||
                storageChanged ||
                cache.offset !== offset ||
                cache.count !== splat.counts ||
                isCameraLayerDirty ||
                cache.version !== splat.version ||
                packCameraRelativeCenterIsDirty;
            if (isPackDirty) {
                cache.offset = offset;
                cache.count = splat.counts;
                cache.version = splat.version;
                packQueue.add(i);
            }

            tempMat.multiplyMatrices(cameraInverseMatrix, splat.matrixWorld);
            let isDirty = packQueue.has(i);
            if (!isDirty) {
                cache.modelViewMatrix.decompose(tempVec0, tempQuat0, tempVec2);
                tempMat.decompose(tempVec1, tempQuat1, tempVec2);
                const distance = tempVec0.distanceTo(tempVec1);
                const coorient = Math.abs(tempQuat0.dot(tempQuat1));
                isDirty = distance > sortSplatDistance || coorient < sortSplatCoorient;
            }
            if (!isDirty) {
                continue;
            }
            cache.modelViewMatrix.copy(tempMat);
            precalculateQueue.add(i);
        }

        let isSortDirty = forceUpdate || isSceneDirty || !prevSortCameraMatrix || !!packQueue.size;
        if (!isSortDirty) {
            this.prevSortCameraMatrix!.decompose(tempVec0, tempQuat0, tempVec2);
            camera.matrixWorld.decompose(tempVec1, tempQuat1, tempVec2);
            const distance = tempVec0.distanceTo(tempVec1);
            const coorient = Math.abs(tempQuat0.dot(tempQuat1));
            isSortDirty = distance > sortCameraDistance || coorient < sortCameraCoorient;
        }
        if (isSortDirty) {
            this.prevSortCameraMatrix = camera.matrixWorld.clone();
        }
        this.isSortDirty = this.isSortDirty || isSortDirty;
        this.reorderIsDirty = this.reorderIsDirty || isSceneDirty || packForceUnstableEnabled;
        this.forceUpdate = false;
    }

    private updateEffectWebGPU(sceneAdaptor: SceneAdaptor) {
        const manager = sceneAdaptor.scene.splatManager;
        const sceneChanged = this.prevSceneVersion !== manager.sceneVersion;
        this.shouldRenderNextFrame ||= this.forceUpdate || sceneChanged;
        if (sceneChanged) {
            this.prevSplatCache.clear();
        }
        this.prevSceneVersion = manager.sceneVersion;
        this.forceUpdate = false;
        const camera = sceneAdaptor.camera;
        camera.updateMatrixWorld();
        for (const splat of manager.splats) {
            tempMat.multiplyMatrices(camera.matrixWorldInverse, splat.matrixWorld);
            let cache = this.prevSplatCache.get(splat.id);
            if (!cache) {
                this.prevSplatCache.set(
                    splat.id,
                    (cache = { version: -1, modelViewMatrix: new Matrix4(), offset: -1, count: 0 }),
                );
            }
            if (
                cache.version !== splat.version ||
                cache.offset !== splat.offset ||
                cache.count !== splat.counts ||
                !cache.modelViewMatrix.equals(tempMat)
            ) {
                this.shouldRenderNextFrame = true;
                cache.version = splat.version;
                cache.offset = splat.offset;
                cache.count = splat.counts;
                cache.modelViewMatrix.copy(tempMat);
            }
        }
    }

    updateFrameSize() {
        this.reorderIsDirty = true;
        this.packAttachSize.width = 1;
        this.packAttachSize.height = 1;
    }

    updateGraphHash(hasher: HashKeyBuilder) {
        hasher
            .bool(this.enabled)
            .bool(this.packHighPrecisionEnabled)
            .bool(this.precalculateEnabled)
            .bool(this.sortPingPongTarget.evenTick)
            .bool(this.compositeEnabled)
            .bool(this.compositeHighPrecisionEnabled)
            .bool(this.highlightKernelEnabled);
    }

    updateRenderGraph(graph: RenderGraph) {
        if (this.renderer.renderer.backend === RendererBackend.WEBGPU_WASM) {
            this.updateRenderGraphWebGPU(graph);
            return;
        }
        const {
            scene,
            packHighPrecisionEnabled,
            packMaterial,
            packQuad,
            packAttachSize,
            packCameraRelativeOrigin,
            precalculateEnabled,
            precalculateMaterial,
            precalculateQuad,
            sortMaterial,
            sortQuad,
            sortPingPongTarget,
            reorderQuad,
            compositeEnabled,
            compositeHighPrecisionEnabled,
            highlightKernelEnabled,
        } = this;
        const splatManager = scene.scene.splatManager;

        const packedSplatsCovAttachment = colorAttachment('packed_splat_cov_attachment').modify(des => {
            des.format = TextureFormat.Rgba32Uint;
            des.sampler.magFilter = des.sampler.minFilter = SamplerFilter.Nearest;
        });

        const resourceSizeFN = () => {
            const pixels = splatManager.totalCount;
            const width = Math.min(
                2 ** Math.ceil(Math.log2(Math.sqrt(pixels))),
                this.renderer.renderer.limits.maxTextureDimension2D,
            );
            if (width > packAttachSize.width) {
                packAttachSize.width = width;
                packAttachSize.height = 1;
            }
            let height = Math.ceil(pixels / packAttachSize.width);
            if (splatManager.splats.length > 1) {
                height = Math.min(
                    2 ** Math.ceil(Math.log2(height)),
                    this.renderer.renderer.limits.maxTextureDimension2D,
                );
            }
            packAttachSize.height = Math.max(height, packAttachSize.height);
            return packAttachSize;
        };

        const packTarget = target('pack_splat_target', false, false)
            .attach(
                colorAttachment('pack_splat_center_attachment').modify(des => {
                    des.format = packHighPrecisionEnabled ? TextureFormat.Rgba32Float : TextureFormat.Rgba16Float;
                    des.sampler.magFilter = des.sampler.minFilter = SamplerFilter.Nearest;
                }),
            )
            .attach(packedSplatsCovAttachment)
            .modify(node => {
                if (packHighPrecisionEnabled) {
                    node.attach(
                        colorAttachment('pack_splat_cov_ext_attachment').modify(des => {
                            des.format = TextureFormat.Rgba32Uint;
                            des.sampler.magFilter = des.sampler.minFilter = SamplerFilter.Nearest;
                        }),
                    );
                }
                if (precalculateEnabled) {
                    node.attach(
                        colorAttachment('pack_splat_color_attachment').modify(des => {
                            des.format = packHighPrecisionEnabled
                                ? TextureFormat.Rgba16Float
                                : TextureFormat.Rgba8Unorm;
                            des.sampler.magFilter = des.sampler.minFilter = SamplerFilter.Nearest;
                        }),
                    );
                }
            })
            .keepContent()
            .resize(resourceSizeFN)
            .from([
                pass('pack_splat_pass')
                    .disableClear()
                    .use((renderer, target) => {
                        if (!this.packQueue.size) {
                            return;
                        }

                        const { width, height } = target!;
                        packMaterial.layer.copy(scene.camera.netLayer);
                        packMaterial.resolution.set(width, height);
                        packMaterial.origin.copy(packCameraRelativeOrigin);

                        const splats = splatManager.splats;
                        let start: number = 0;
                        for (let i = 0; i < splats.length; i++) {
                            const splat = splats[i];
                            if (!this.packQueue.has(i)) {
                                start += splat.counts;
                                continue;
                            }

                            const end = start + splat.counts;
                            const xOffset = start % width;
                            const yOffset = Math.floor(start / width);
                            const h = Math.min(height - yOffset, Math.ceil((end - start + xOffset) / width));
                            packMaterial.offset = start;
                            packMaterial.update(splat);
                            renderer.renderer.setViewportInRenderPass(0, height - yOffset - h, width, h);
                            packQuad.render(renderer);
                            if (splat.autoFreeResourceOnGpuPacked) {
                                splat.stateTex?.freeGPU();
                                splat.onGpuDataPacked();
                            }
                            start = end;
                        }
                        this.packQueue.clear();
                    }),
            ]);

        let precalculateTarget = packTarget;
        if (precalculateEnabled) {
            precalculateTarget = target('precalculate_target', false, false)
                .attach(packedSplatsCovAttachment)
                .keepContent()
                .resize(resourceSizeFN)
                .from([
                    pass('precalculate_pass')
                        .disableClear()
                        .input('centerTex', packTarget, 0)
                        .input('colorTex', packTarget, packHighPrecisionEnabled ? 3 : 2)
                        .use((renderer, target) => {
                            if (!this.precalculateQueue.size) {
                                return;
                            }
                            const { width, height } = target!;
                            precalculateMaterial.resolution.set(width, height);

                            const splats = splatManager.splats;
                            let start: number = 0;
                            for (let i = 0; i < splats.length; i++) {
                                const splat = splats[i];
                                if (!this.precalculateQueue.has(i)) {
                                    start += splat.counts;
                                    continue;
                                }

                                precalculateMaterial.update(scene.camera, splat);
                                precalculateMaterial.origin.sub(packCameraRelativeOrigin);

                                const end = start + splat.counts;
                                const xOffset = start % width;
                                const yOffset = Math.floor(start / width);
                                const h = Math.min(height - yOffset, Math.ceil((end - start + xOffset) / width));
                                precalculateMaterial.offset = start;
                                renderer.renderer.setViewportInRenderPass(0, height - yOffset - h, width, h);
                                precalculateQuad.render(renderer);
                                start = end;
                            }
                            this.precalculateQueue.clear();
                        }),
                ]);
        }

        const reorderTarget = target('reorder_target', false, false)
            .attach(
                colorAttachment('reorder_attachment').modify(des => {
                    des.format = TextureFormat.R32Uint;
                    des.sampler.magFilter = des.sampler.minFilter = SamplerFilter.Nearest;
                }),
            )
            .keepContent()
            .resize(() => {
                const orderTex = this.reorderMaterial.orderTex;
                return { width: orderTex.width, height: orderTex.height };
            })
            .from([
                pass('reorder_pass')
                    .disableClear()
                    .use(renderer => {
                        if (!this.reorderIsDirty) {
                            return;
                        }
                        this.reorderIsDirty = false;
                        reorderQuad.render(renderer);
                    }),
            ]);

        const sortTarget = sortPingPongTarget
            .ping()
            .resize(() => {
                const pixels = Math.ceil(splatManager.totalCount / (this.sortHighPrecisionEnabled ? 1 : 2));
                const width = Math.min(
                    2 ** Math.ceil(Math.log2(Math.sqrt(pixels))),
                    this.renderer.renderer.limits.maxTextureDimension2D,
                );
                const height = Math.ceil(pixels / width);
                return { width, height };
            })
            .from([
                pass('sort_splat_pass')
                    .disableClear()
                    .input('centerTex', packTarget, 0)
                    .use((renderer, target) => {
                        if (!this.isSortDirty || performance.now() - this.sortLastTime < this.sortMinIntervalMs) {
                            return;
                        }
                        const { width, height } = target!;
                        const count = splatManager.totalCount;
                        sortMaterial.update(scene.camera);
                        sortMaterial.centerOrigin.copy(packCameraRelativeOrigin);
                        sortMaterial.resolution.set(width, height);
                        sortMaterial.count = count;
                        sortQuad.render(renderer);
                        this.addSortTask(count, target!, splatManager.splats);
                        this.flushSortTask();
                        this.sortLastTime = performance.now();
                        this.isSortDirty = false;
                    }),
            ]);

        graph.addPass([
            pass('splatting_pass')
                .depend(precalculateTarget)
                .depend(sortTarget)
                .disableClear()
                .input('orderTex', reorderTarget)
                .input('centerTex', packTarget, 0)
                .input('covTex', packTarget, 1)
                .modify(node => {
                    if (packHighPrecisionEnabled) {
                        node.input('covExtTex', packTarget, 2);
                    }
                })
                .use(renderer => {
                    const m = this.splattingMaterial;
                    m.origin.copy(packCameraRelativeOrigin);
                    renderer.activeResources.forEach((input, name) => ((m as any)[name] = input));
                    renderer.renderer.renderDrawcall(
                        this.splattingGeometry,
                        this.splattingMaterial,
                        this.splattingMesh,
                        null,
                    );
                    this.shouldRenderNextFrame = false;
                    splatManager.splats.forEach(item => item.onUpdateRenderingStability(!this.isSorting));
                }),
        ]);

        if (compositeEnabled) {
            const splattingTarget = target('splatting_target', false, true)
                .attach(
                    colorAttachment('splatting_color_attachment').modify(des => {
                        des.format = compositeHighPrecisionEnabled
                            ? TextureFormat.Rgba16Float
                            : TextureFormat.Rgba8Unorm;
                    }),
                )
                .from(graph.removeAllPasses());
            graph.addPass([
                pass('tone_mapping_pass')
                    .disableClear()
                    .input('tDiffuse', splattingTarget)
                    .use(drawQuad(this.toneMappingMaterial)),
            ]);
        }

        if (highlightKernelEnabled) {
            graph.addPass([
                pass('highlight_kernel_pass')
                    .disableClear()
                    .input('orderTex', reorderTarget)
                    .input('centerTex', packTarget, 0)
                    .use(renderer => {
                        const m = this.highlightKernelMaterial;
                        m.origin.copy(packCameraRelativeOrigin);
                        renderer.activeResources.forEach((input, name) => ((m as any)[name] = input));
                        renderer.renderer.renderDrawcall(
                            this.highlightKernelGeometry,
                            this.highlightKernelMaterial,
                            this.highlightKernelMesh,
                            null,
                        );
                    }),
            ]);
        }
    }

    private updateRenderGraphWebGPU(graph: RenderGraph) {
        const { compositeEnabled, compositeHighPrecisionEnabled, highlightKernelEnabled } = this;
        graph.addPass([
            pass('splatting_pass')
                .disableClear()
                .before(({ renderer, target }) => {
                    const camera = this.scene.camera;
                    camera.updateMatrixWorld();
                    renderer.renderer.prepareSplats!(
                        this,
                        this.scene.scene.splatManager.splats,
                        camera,
                        target ?? renderer,
                        {
                            preBlurAmount: this.splattingMaterial.preBlurAmount,
                            blurAmount: this.splattingMaterial.blurAmount,
                            focalAdjustment: this.splattingMaterial.focalAdjustment,
                            maxStdDev: this.splattingMaterial.maxStdDev,
                            maxPixelRadius: this.splattingMaterial.maxPixelRadius,
                            detailCullingThreshold: this.splattingMaterial.detailCullingThreshold,
                            normalizedFalloff: this.splattingMaterial.normalizedFalloff,
                            renderMode: this.splattingMaterial.renderMode,
                            selectedColor: this.splattingMaterial.selectedColor,
                            ringSize: this.splattingMaterial.ringSize,
                            highlightKernelEnabled: this.highlightKernelEnabled,
                            highPrecisionEnabled: this.packHighPrecisionEnabled,
                            precalculateEnabled: this.precalculateEnabled,
                            cameraRelativeEnabled: this.packCameraRelativeEnabled,
                        },
                    );
                })
                .use(renderer => {
                    renderer.renderer.renderSplats!(this);
                    this.shouldRenderNextFrame = false;
                    for (const splat of this.scene.scene.splatManager.splats) {
                        splat.onSorted();
                        splat.onUpdateRenderingStability(true);
                    }
                }),
        ]);

        if (compositeEnabled) {
            const splattingTarget = target('splatting_target', false, true)
                .attach(
                    colorAttachment('splatting_color_attachment').modify(des => {
                        des.format = compositeHighPrecisionEnabled
                            ? TextureFormat.Rgba16Float
                            : TextureFormat.Rgba8Unorm;
                    }),
                )
                .from(graph.removeAllPasses());
            graph.addPass([
                pass('tone_mapping_pass')
                    .disableClear()
                    .input('tDiffuse', splattingTarget)
                    .use(drawQuad(this.toneMappingMaterial)),
            ]);
        }

        if (highlightKernelEnabled) {
            graph.addPass([
                pass('highlight_kernel_pass')
                    .disableClear()
                    .use(renderer => renderer.renderer.renderSplatKernels!(this, this.highlightKernelMaterial)),
            ]);
        }
    }

    createConfig() {
        return {
            enabled: {
                get: () => this._enabled,
                set: (v: boolean) => {
                    this._enabled = v;
                },
            },
            pack: {
                forceUnstableEnabled: {
                    get: () => this.packForceUnstableEnabled,
                    set: (v: boolean) => {
                        this.packForceUnstableEnabled = v;
                    },
                },
                highPrecisionEnabled: {
                    get: () => this.packHighPrecisionEnabled,
                    set: (v: boolean) => {
                        this.forceUpdate = true;
                        this.packHighPrecisionEnabled =
                            this.packMaterial.highPrecisionEnabled =
                            this.precalculateMaterial.highPrecisionEnabled =
                            this.splattingMaterial.highPrecisionEnabled =
                                v;
                        this.packMaterial.notifyRecompileShader();
                        this.precalculateMaterial.setColorWriteMasks(false, false, v, true);
                        this.precalculateMaterial.notifyRecompileShader();
                        this.splattingMaterial.notifyRecompileShader();
                    },
                },
                precalculateEnabled: {
                    get: () => this.precalculateEnabled,
                    set: (v: boolean) => {
                        this.forceUpdate = true;
                        this.precalculateEnabled = this.packMaterial.outputColorAttachment = v;
                    },
                },
                cameraRelativeEnabled: {
                    get: () => this.packCameraRelativeEnabled,
                    set: (v: boolean) => {
                        this.forceUpdate = true;
                        this.packCameraRelativeEnabled = v;
                    },
                },
                cameraRelativeUpdateDistanceThreshold: {
                    get: () => this.packCameraRelativeUpdateDistanceThreshold,
                    set: (v: number) => {
                        this.packCameraRelativeUpdateDistanceThreshold = v;
                    },
                },
            },
            raster: {
                mode: {
                    get: () => this.splattingMaterial.renderMode,
                    set: (v: SplattingRenderMode) => {
                        this.splattingMaterial.updateRenderMode(v);
                    },
                },
                preBlurAmount: {
                    get: () => this.splattingMaterial.preBlurAmount,
                    set: (v: number) => {
                        this.splattingMaterial.preBlurAmount = v;
                    },
                },
                blurAmount: {
                    get: () => this.splattingMaterial.blurAmount,
                    set: (v: number) => {
                        this.splattingMaterial.blurAmount = v;
                    },
                },
                focalAdjustment: {
                    get: () => this.splattingMaterial.focalAdjustment,
                    set: (v: number) => {
                        this.splattingMaterial.focalAdjustment = v;
                    },
                },
                maxStdDev: {
                    get: () => this.splattingMaterial.maxStdDev,
                    set: (v: number) => {
                        this.splattingMaterial.maxStdDev = Math.max(0, Math.min(v, Math.sqrt(8)));
                    },
                },
                maxPixelRadius: {
                    get: () => this.splattingMaterial.maxPixelRadius,
                    set: (v: number) => {
                        this.splattingMaterial.maxPixelRadius = v;
                    },
                },
                detailCullingThreshold: {
                    get: () => this.splattingMaterial.detailCullingThreshold,
                    set: (v: number) => {
                        this.splattingMaterial.detailCullingThreshold = v;
                    },
                },
                normalizedFalloff: {
                    get: () => this.splattingMaterial.normalizedFalloff,
                    set: (v: boolean) => {
                        this.splattingMaterial.normalizedFalloff = v;
                        this.splattingMaterial.notifyRecompileShader();
                    },
                },
                selectedColor: {
                    get: () => this.splattingMaterial.selectedColor.clone(),
                    set: (v: Vector4) => {
                        this.splattingMaterial.selectedColor.copy(v);
                    },
                },
                ringSize: {
                    get: () => this.splattingMaterial.ringSize,
                    set: (v: number) => {
                        this.splattingMaterial.ringSize = v;
                    },
                },
            },
            sort: {
                highPrecisionEnabled: {
                    get: () => this.sortHighPrecisionEnabled,
                    set: (v: boolean) => {
                        this.isSortDirty = true;
                        this.sortHighPrecisionEnabled = this.sortMaterial.highPrecisionEnabled = v;
                        this.sortMaterial.notifyRecompileShader();
                    },
                },
                minIntervalMs: {
                    get: () => this.sortMinIntervalMs,
                    set: (v: number) => {
                        this.sortMinIntervalMs = v;
                    },
                },
                sortSplatDistance: {
                    get: () => this.sortSplatDistance,
                    set: (v: number) => {
                        this.sortSplatDistance = v;
                    },
                },
                sortSplatCoorient: {
                    get: () => this.sortSplatCoorient,
                    set: (v: number) => {
                        this.sortSplatCoorient = v;
                    },
                },
                sortCameraDistance: {
                    get: () => this.sortCameraDistance,
                    set: (v: number) => {
                        this.sortCameraDistance = v;
                    },
                },
                sortCameraCoorient: {
                    get: () => this.sortCameraCoorient,
                    set: (v: number) => {
                        this.sortCameraCoorient = v;
                    },
                },
                depthBias: {
                    get: () => this.sortMaterial.depthBias,
                    set: (v: number) => {
                        this.sortMaterial.depthBias = v;
                    },
                },
            },
            composite: {
                enabled: {
                    get: () => this.compositeEnabled,
                    set: (v: boolean) => {
                        this.compositeEnabled = v;
                    },
                },
                highPrecisionEnabled: {
                    get: () => this.compositeHighPrecisionEnabled,
                    set: (v: boolean) => {
                        this.compositeHighPrecisionEnabled = v;
                    },
                },
                toneMapping: {
                    get: () => this.toneMappingMaterial.toneMapping,
                    set: (v: ToneMapping) => {
                        this.toneMappingMaterial.toneMapping = v;
                        this.toneMappingMaterial.notifyRecompileShader();
                    },
                },
                exposure: {
                    get: () => this.toneMappingMaterial.exposure,
                    set: (v: number) => {
                        this.toneMappingMaterial.exposure = v;
                    },
                },
            },
            highlightKernel: {
                enabled: {
                    get: () => this.highlightKernelEnabled,
                    set: (v: boolean) => {
                        this.highlightKernelEnabled = v;
                    },
                },
                size: {
                    get: () => this.highlightKernelMaterial.size,
                    set: (v: number) => {
                        this.highlightKernelMaterial.size = v;
                    },
                },
                color: {
                    get: () => this.highlightKernelMaterial.color.getHex(),
                    set: (v: number) => {
                        this.highlightKernelMaterial.color.setHex(v);
                    },
                },
                selectedColor: {
                    get: () => this.highlightKernelMaterial.selectedColor.clone(),
                    set: (v: Vector4) => {
                        this.highlightKernelMaterial.selectedColor.copy(v);
                    },
                },
            },
        };
    }

    notifyChanged() {
        this.forceUpdate = true;
        this.pendingSortTask = undefined;
    }
}
