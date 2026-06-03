import type { Vector4 } from '../../math/Vector4';
import { PipelinePlugin } from './PipelinePlugin';
import type { HashKeyBuilder } from '../../utils/HashKeyBuilder';
import type { RenderGraph } from '../../rendergraph/RenderGraph';
import { pass, target, pingpong, colorAttachment } from '../../rendergraph/NodeMakers';
import { RendererBackend } from '../../renderer/IRenderer';
import type { SceneAdaptor, SceneAdaptorDispatcher } from '../SceneAdaptor';
import { drawQuad, type RendererAdaptor } from '../RendererAdaptor';
import { DrawMode, SamplerFilter } from '../../utils/Constants';
import { SplatPackMaterial } from '../../elements/materials/quad/SplatPackMaterial';
import { SplatSortMaterial } from '../../elements/materials/quad/SplatSortMaterial';
import { SplatPrecalculateMaterial } from '../../elements/materials/quad/SplatPrecalculateMaterial';
import type { RenderTarget } from '../../elements/textures/RenderTarget';
import { Mesh } from '../../scene/drawables/Mesh';
import { InstancedBufferGeometry } from '../../elements/geometries/containers/InstancedBufferGeometry';
import { SplattingMaterial } from '../../elements/materials/mesh/SplattingMaterial';
import { BufferAttribute } from '../../elements/attributes/BufferAttribute';
import { CopyMaterial } from '../../elements/materials/quad/CopyMaterial';
import { Capabilities } from '../../renderer/Capabilities';
import { SplatKernelHighlightMaterial } from '../../elements/materials/mesh/SplatKernelHighlightMaterial';
import { SplatRepackMaterial } from '../../elements/materials/quad/SplatRepackMaterial';
import { SplatReorderMaterial } from '../../elements/materials/quad/SplatReorderMaterial';
import { Matrix4 } from '../../math/Matrix4';
import { Layers } from '../../scene/tools/Layers';
import { Vector3 } from '../../math/Vector3';
import { Quaternion } from '../../math/Quaternion';
import { ToneMappingMaterial, type ToneMapping } from '../../elements/materials/quad/ToneMappingMaterial';
import { ColorTransfer } from '../../elements/materials/Material';
import type { Size } from '../../utils/Utils';
import type { Splat } from '../../scene/splat/Splat';
import { TextureFormat, TextureDimension, TextureViewDimension } from '../../elements/textures/types';
import { SourceTexture } from '../../elements/textures/SourceTexture';

let sortSplats: (splatCounts: number, sorting: Uint16Array, order: Uint32Array) => Promise<{ activeSplats: number; sorting: Uint16Array; ordering: Uint32Array; }>;
export function setSortSplats(fn: typeof sortSplats) {
    sortSplats = fn;
}

export enum SplattingRenderMode {
    Default,
    PickingId,
}

interface SplatCache {
    version: number;
    matrix: Matrix4;
    modelViewMatrix: Matrix4;
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

    private forceUpdate: boolean = false;
    private shouldRenderNextFrame: boolean = false;

    private packQueue = new Set<number>();
    private packMaterial = new SplatPackMaterial();
    private packQuad = drawQuad(this.packMaterial);
    private packHighPrecisionEnabled: boolean = false;
    private packAttachSize: Size = { width: 1, height: 1 };

    private precalculateEnabled: boolean = true;
    private precalculateQueue = new Set<number>();
    private precalculateMaterial = new SplatPrecalculateMaterial();
    private precalculateQuad = drawQuad(this.precalculateMaterial);

    private repackEnabled: boolean = false;
    private repackIsDirty: boolean = false;
    private repackAttachSize: Size = { width: 1, height: 1 };
    private repackMaterial = new SplatRepackMaterial();
    private repackQuat = drawQuad(this.repackMaterial);

    private isSortDirty: boolean = false;
    private isSorting: boolean = false;
    private sortMinDuration: number = 0;
    private sortLastTime: number = -Infinity;
    private sortPingPongTarget = pingpong('sorted_splats_target');
    private sortMaterial = new SplatSortMaterial();
    private sortQuad = drawQuad(this.sortMaterial);

    private reorderMaterial = new SplatReorderMaterial();
    private reorderQuad = drawQuad(this.reorderMaterial);

    private splattingMesh = new Mesh();
    private splattingGeometry = new InstancedBufferGeometry();
    private splattingMaterial = new SplattingMaterial();
    private splattingRenderMode: SplattingRenderMode = SplattingRenderMode.Default;

    private compositeEnabled: boolean = false;
    private compositeHighPrecisionAttachEnabled: boolean = false;
    private copyMaterial = new CopyMaterial({ transparent: false });
    private toneMappingEnabled: boolean = false;
    private toneMappingMaterial = new ToneMappingMaterial();

    private highlightKernelEnabled: boolean = false;
    private highlightKernelMesh = new Mesh();
    private highlightKernelGeometry = new InstancedBufferGeometry();
    private highlightKernelMaterial = new SplatKernelHighlightMaterial();

    get envSupported() {
        const backend = this.renderer.renderer.backend;
        return backend === RendererBackend.WEBGL2_JS;
    }

    get enabled() {
        return this._enabled && this.scene.adaptor.scene.splatManager.splatCounts > 0;
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
            TextureDimension.D2, TextureViewDimension.D2, TextureFormat.R32Uint, 1, 1, 1, false, false
        ).configAsDataTexture().setLevelData(new Uint32Array([0]), 0);
        this.highlightKernelMesh.drawMode = DrawMode.Points;
        this.highlightKernelGeometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0]), 3));
    }

    private sortCurrentVersion: number = 0;
    private sortLastVersion: number = 0;
    private sortingBuffer?: Uint32Array;
    private sortTaskRunning: boolean = false;
    private pendingSortTask?: { counts: number, target: RenderTarget, splats: Splat[] };
    private orderBuffer?: Uint32Array;
    private orderLayout: Array<{ id: number, counts: number }> = [];
    private async flushSortTask() {
        // this.pendingSortTask maybe undefined because of async
        if (this.sortCurrentVersion === this.sortLastVersion || this.sortTaskRunning || !this.pendingSortTask) {
            return;
        }

        this.sortTaskRunning = true;
        this.isSorting = true;
        this.sortPingPongTarget.tick();

        const { renderer, reorderMaterial, sortLastVersion } = this;
        const { counts, target, splats } = this.pendingSortTask;
        const orderLayout: Array<{ id: number, counts: number }> = [];
        for (let i = 0; i < splats.length; i++) {
            const splat = splats[i];
            orderLayout[i] = { id: splat.id, counts: splat.counts };
        }

        const { width, height } = target;
        const pixelCounts = width * height;
        let sorting = this.sortingBuffer;
        if (!sorting || pixelCounts > sorting.length) {
            sorting = new Uint32Array(pixelCounts);
        }
        await renderer.renderer.readPixelsAsync(target, { x: 0, y: 0, width, height }, sorting);

        let orderBuffer = this.orderBuffer;
        if (!orderBuffer || counts > orderBuffer.length) {
            const width = Math.min(Math.ceil(Math.sqrt(counts) / 2) * 2, Capabilities.MAX_TEXTURE_SIZE);
            const height = Math.ceil(counts / width);
            orderBuffer = new Uint32Array(width * height);
        }
        const { activeSplats, sorting: backSorting, ordering } = await sortSplats(counts, new Uint16Array(sorting.buffer), orderBuffer);
        this.sortingBuffer = new Uint32Array(backSorting.buffer);
        const prevOrderTex = reorderMaterial.orderTex;
        if (prevOrderTex) {
            prevOrderTex.freeGPU();
            this.orderBuffer = prevOrderTex.getLevelLayerSource(0) as Uint32Array;
        }

        this.splattingGeometry.instancedCount = Math.ceil(activeSplats / SPLAT_BLOCK_COUNT);
        this.splattingMaterial.activeSplats =
            this.repackMaterial.activeSplats =
            this.highlightKernelGeometry.instancedCount = activeSplats;
        const w = Math.max(1, Math.min(Math.ceil(Math.sqrt(activeSplats) / 2) * 2, Capabilities.MAX_TEXTURE_SIZE));
        const h = Math.max(1, Math.ceil(activeSplats / w));
        reorderMaterial.orderTex = new SourceTexture(
            TextureDimension.D2, TextureViewDimension.D2, TextureFormat.R32Uint, w, h, 1,
            false, false
        ).configAsDataTexture().setLevelData(ordering.subarray(0, w * h), 0);

        renderer.renderer.queueFlushTexture(reorderMaterial.orderTex);
        renderer.renderer.flushCommands();
        this.orderLayout = orderLayout;
        for (let i = 0; i < splats.length; i++) {
            splats[i].onSorted();
        }

        this.sortTaskRunning = false;
        this.repackIsDirty = true;
        this.sortCurrentVersion = sortLastVersion;
        if (this.sortCurrentVersion >= this.sortLastVersion) {
            this.isSorting = false;
            this.shouldRenderNextFrame = true;
        }
        this.flushSortTask();
    }

    private addSortTask(counts: number, target: RenderTarget, splats: Splat[]) {
        this.pendingSortTask = { counts, target, splats };
        this.sortLastVersion++;
    }

    destroy() { }

    private sortSplatDistance: number = 0.1;
    private sortSplatCoorient: number = 0.99999;
    private sortCameraDistance: number = 1;
    private sortCameraCoorient: number = 0.99;
    private prevSceneVersion: number = 0;
    private prevSplatCache = new Map<number, SplatCache>(); // <objectId, SplatCache>
    private prevSortCameraMatrix?: Matrix4;
    private prevSortCameraLayer: Layers = new Layers();
    updateEffect(sceneAdaptor: SceneAdaptor) {
        const {
            forceUpdate,
            sortSplatDistance, sortSplatCoorient, sortCameraDistance, sortCameraCoorient,
            prevSceneVersion, prevSplatCache, prevSortCameraMatrix, prevSortCameraLayer,
            orderLayout, reorderMaterial,
            packQueue, precalculateQueue,
        } = this;

        const { scene: { splatManager }, camera } = sceneAdaptor;
        camera.updateMatrixWorld();

        const splats = splatManager.splats;
        const reorderLayout: Array<{ start: number, end: number, offset: number }> = [];
        let start = 0;
        let offset = 0;
        let orderIdx = 0;
        let reorderIdx = 0;
        for (; orderIdx < orderLayout.length; orderIdx++) {
            const { id, counts } = orderLayout[orderIdx];
            const isDeleted = id !== splats[reorderIdx]?.id;
            reorderLayout[orderIdx] = {
                start,
                end: start + counts,
                offset: isDeleted ? (1 << 30) : -offset,
            };
            if (isDeleted) {
                offset += counts;
            } else {
                reorderIdx++;
            }
            start += counts;
        }

        {
            const reorderData: Array<{ start: number, end: number, offset: number }> = [];
            let start = 0;
            let end = 0;
            let offset = 0;
            for (let i = 0; i < reorderLayout.length; i++) {
                const item = reorderLayout[i];
                if (offset === item.offset) {
                    end = item.end;
                    continue;
                }
                if (offset !== 0) {
                    reorderData.push({ start, end, offset });
                }
                start = item.start;
                end = item.end;
                offset = item.offset;
            }
            reorderData.push({ start, end, offset });

            reorderMaterial.counts = reorderData.length;
            for (let i = 0; i < reorderData.length; i++) {
                const item = reorderData[i];
                reorderMaterial.startArr[i] = item.start;
                reorderMaterial.endArr[i] = item.end;
                reorderMaterial.offsetArr[i] = item.offset;
            }
        }

        const prevSplats = new Set(prevSplatCache.keys());
        for (let i = 0; i < splats.length; i++) {
            const splat = splats[i];
            const key = splat.id;
            if (!prevSplats.delete(key)) {
                splat.updateMatrixWorld();
                prevSplatCache.set(key, {
                    version: splat.version,
                    matrix: splat.matrixWorld.clone(),
                    modelViewMatrix: splat.matrixWorld.clone(),
                });
            }
        }
        Array.from(prevSplats).forEach(v => prevSplatCache.delete(v));

        const isSceneDirty = prevSceneVersion !== splatManager.sceneVersion;
        if (isSceneDirty) {
            this.prevSceneVersion = splatManager.sceneVersion;
        }
        const isCameraLayerDirty = prevSortCameraLayer.mask !== camera.netLayer.mask;
        if (isCameraLayerDirty) {
            prevSortCameraLayer.mask = camera.netLayer.mask;
        }

        for (let i = 0; i < splats.length; i++) {
            const splat = splats[i];
            const cache = prevSplatCache.get(splat.id)!;
            const isDirty = forceUpdate || isSceneDirty || isCameraLayerDirty || (cache.version !== splat.version) || !splat.matrixWorld.equals(cache.matrix);
            if (!isDirty) {
                continue;
            }
            cache.version = splat.version;
            cache.matrix.copy(splat.matrixWorld);
            packQueue.add(i);
        }

        const cameraInverseMatrix = camera.matrixWorldInverse;
        for (let i = 0; i < splats.length; i++) {
            const splat = splats[i];
            tempMat.copy(splat.matrixWorld).multiply(cameraInverseMatrix);
            const cache = prevSplatCache.get(splat.id)!;
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

        this.forceUpdate = false;
    }

    updateFrameSize() { }

    updateGraphHash(hasher: HashKeyBuilder) {
        hasher
            .bool(this.enabled)
            .bool(this.packHighPrecisionEnabled)
            .bool(this.precalculateEnabled)
            .bool(this.repackEnabled)
            .bool(this.sortPingPongTarget.evenTick)
            .bool(this.compositeEnabled)
            .bool(this.compositeHighPrecisionAttachEnabled)
            .bool(this.highlightKernelEnabled)
            .bool(this.toneMappingEnabled);
    }

    updateRenderGraph(graph: RenderGraph) {
        const {
            scene,
            packHighPrecisionEnabled, packMaterial, packQuad, packAttachSize,
            precalculateEnabled, precalculateMaterial, precalculateQuad,
            sortMaterial, sortQuad, sortPingPongTarget,
            repackEnabled, repackMaterial, repackQuat, repackAttachSize,
            compositeEnabled, compositeHighPrecisionAttachEnabled,
            toneMappingEnabled, highlightKernelEnabled,
        } = this;
        const splatManager = scene.scene.splatManager;

        const packedSplatsCovAttachment = colorAttachment('packed_splat_cov_attachment').modify(des => {
            des.format = TextureFormat.Rgba32Uint;
            des.sampler.magFilter = des.sampler.minFilter = SamplerFilter.Nearest;
        });

        const resizeFN = () => {
            const pixels = splatManager.splatCounts;
            const width = Math.min(2 ** Math.ceil(Math.log2(Math.sqrt(pixels))), Capabilities.MAX_TEXTURE_SIZE);
            if (width > packAttachSize.width) {
                packAttachSize.width = width;
                packAttachSize.height = 1;
            }
            const height = Math.ceil(pixels / packAttachSize.width);
            packAttachSize.height = Math.max(height, packAttachSize.height);
            return packAttachSize;
        };

        const packTarget = target('pack_splat_target', false, false)
            .attach(packedSplatsCovAttachment)
            .attach(colorAttachment('pack_splat_center_attachment').modify(des => {
                des.format = packHighPrecisionEnabled ? TextureFormat.Rgba32Float : TextureFormat.Rgba16Float;
                des.sampler.magFilter = des.sampler.minFilter = SamplerFilter.Nearest;
            }))
            .modify(node => {
                if (precalculateEnabled) {
                    node.attach(colorAttachment('pack_splat_color_attachment').modify(des => {
                        des.format = packHighPrecisionEnabled ? TextureFormat.Rgba16Float : TextureFormat.Rgba8Unorm;
                        des.sampler.magFilter = des.sampler.minFilter = SamplerFilter.Nearest;
                    }));
                }
            })
            .keepContent()
            .resize(resizeFN)
            .from([
                pass('packing_splat_pass')
                    .disableClear()
                    .use((renderer, target) => {
                        if (!this.packQueue.size) {
                            return;
                        }

                        const { width, height } = target!;
                        packMaterial.layer.copy(scene.camera.netLayer);
                        packMaterial.resolution.set(width, height);

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
                                splat.groupTex?.freeGPU();
                                splat.groupTransformTex?.freeGPU();
                                splat.stateTex?.freeGPU();
                                splat.onGpuDataPacked();
                            }
                            start = end;
                        }
                        this.repackIsDirty = true;
                        this.packQueue.clear();
                    }),
            ]);

        let precalculateTarget = packTarget;
        if (precalculateEnabled) {
            precalculateTarget = target('precalculate_shN_target', false, false)
                .attach(packedSplatsCovAttachment)
                .keepContent()
                .resize(resizeFN)
                .from([
                    pass('precalculate_shN_pass')
                        .disableClear()
                        .input('centerTex', packTarget, 1)
                        .input('colorTex', packTarget, 2)
                        .use((renderer, target) => {
                            if (this.repackEnabled ? !this.repackIsDirty : !this.precalculateQueue.size) {
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
            .attach(colorAttachment('reorder_attachment').modify(des => {
                des.format = TextureFormat.R32Uint;
                des.sampler.magFilter = des.sampler.minFilter = SamplerFilter.Nearest;
            }))
            .keepContent()
            .resize(() => {
                const orderTex = this.reorderMaterial.orderTex;
                return { width: orderTex.width, height: orderTex.height };
            })
            .from([
                pass('reorder_pass')
                    .disableClear()
                    .use(this.reorderQuad),
            ]);

        let resourceTarget = packTarget;
        if (repackEnabled) {
            resourceTarget = target('repack_splat_target', false, false)
                .attach(colorAttachment('repack_splat_cov_attachment').modify(des => {
                    des.format = TextureFormat.Rgba32Uint;
                    des.sampler.magFilter = des.sampler.minFilter = SamplerFilter.Nearest;
                }))
                .attach(colorAttachment('repack_splat_center_attachment').modify(des => {
                    des.format = packHighPrecisionEnabled ? TextureFormat.Rgba32Float : TextureFormat.Rgba16Float;
                    des.sampler.magFilter = des.sampler.minFilter = SamplerFilter.Nearest;
                }))
                .keepContent()
                .resize(() => {
                    const pixels = this.splattingMaterial.activeSplats;
                    const width = Math.min(2 ** Math.ceil(Math.log2(Math.sqrt(pixels))), Capabilities.MAX_TEXTURE_SIZE);
                    if (width > repackAttachSize.width) {
                        repackAttachSize.width = width;
                        repackAttachSize.height = 1;
                    }
                    const height = Math.ceil(pixels / repackAttachSize.width);
                    repackAttachSize.height = Math.max(height, repackAttachSize.height);
                    return repackAttachSize;
                })
                .from([
                    pass('repacking_splat_pass')
                        .depend(precalculateTarget)
                        .disableClear()
                        .input('orderTex', reorderTarget)
                        .input('covTex', packTarget, 0)
                        .input('centerTex', packTarget, 1)
                        .use((renderer, target) => {
                            if (!this.repackIsDirty) {
                                return;
                            }
                            const { width, height } = target!;
                            const m = repackMaterial;
                            m.resolution.set(width, height);
                            renderer.activeResources.forEach((input, name) => (m as any)[name] = input);
                            repackQuat.render(renderer);
                            this.repackIsDirty = false;
                        }),
                ]);
        }

        const sortTarget = sortPingPongTarget
            .ping()
            .resize(() => {
                const pixels = Math.ceil(splatManager.splatCounts / 2);
                const width = Math.min(Math.ceil(Math.sqrt(pixels) / 2) * 2, Capabilities.MAX_TEXTURE_SIZE);
                const height = Math.ceil(pixels / width);
                return { width, height };
            })
            .from([
                pass('sort_splat_pass')
                    .disableClear()
                    .input('centerTex', packTarget, 1)
                    .use((renderer, target) => {
                        if (!this.isSortDirty || (performance.now() - this.sortLastTime) < this.sortMinDuration) {
                            return;
                        }
                        const { width, height } = target!;
                        const splatCounts = splatManager.splatCounts;
                        sortMaterial.update(scene.camera);
                        sortMaterial.resolution.set(width, height);
                        sortMaterial.splatCounts = splatCounts;
                        sortQuad.render(renderer);
                        this.addSortTask(splatCounts, target!, splatManager.splats);
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
                .input('covTex', resourceTarget, 0)
                .input('centerTex', resourceTarget, 1)
                .use(renderer => {
                    const m = this.splattingMaterial;
                    renderer.activeResources.forEach((input, name) => (m as any)[name] = input);
                    renderer.renderer.renderDrawcall(this.splattingGeometry, this.splattingMaterial, this.splattingMesh, null);
                    this.shouldRenderNextFrame = false;
                    splatManager.splats.forEach(item => item.onUpdateRenderingStability(!this.isSorting));
                })
        ]);

        if (compositeEnabled || toneMappingEnabled) {
            const splattingTarget = target('splatting_target', false, true)
                .attach(colorAttachment('splatting_color_attachment').modify(des => {
                    des.format = toneMappingEnabled || compositeHighPrecisionAttachEnabled ? TextureFormat.Rgba16Float : TextureFormat.Rgba8Unorm;
                }))
                .from(graph.removeAllPasses());
            if (toneMappingEnabled) {
                graph.addPass([
                    pass('tone_mapping_pass')
                        .disableClear()
                        .input('tDiffuse', splattingTarget)
                        .use(drawQuad(this.toneMappingMaterial)),
                ]);
            } else {
                graph.addPass([
                    pass('copy_pass')
                        .disableClear()
                        .input('tDiffuse', splattingTarget)
                        .use(drawQuad(this.copyMaterial)),
                ]);
            }
        }

        if (highlightKernelEnabled) {
            graph.addPass([
                pass('highlight_kernel_pass')
                    .disableClear()
                    .input('orderTex', reorderTarget)
                    .input('centerTex', packTarget, 1)
                    .use(renderer => {
                        const m = this.highlightKernelMaterial;
                        renderer.activeResources.forEach((input, name) => (m as any)[name] = input);
                        renderer.renderer.renderDrawcall(this.highlightKernelGeometry, this.highlightKernelMaterial, this.highlightKernelMesh, null);
                    }),
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
            precalculateEnabled: {
                get: () => this.precalculateEnabled,
                set: (v: boolean) => {
                    this.precalculateEnabled = this.packMaterial.outputColorAttachment = v;
                    this.forceUpdate = true;
                },
            },
            repackEnabled: {
                get: () => this.repackEnabled,
                set: (v: boolean) => {
                    this.repackEnabled = v;
                    this.repackIsDirty = true;
                    this.splattingMaterial.repackEnabled = v;
                    this.splattingMaterial.notifyRecompileShader();
                },
            },
            packHighPrecisionEnabled: {
                get: () => this.packHighPrecisionEnabled,
                set: (v: boolean) => {
                    this.packHighPrecisionEnabled = v;
                    this.forceUpdate = true;
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
                }
            },
            sort: {
                sortRadial: {
                    get: () => this.sortMaterial.sortRadial,
                    set: (v: boolean) => {
                        this.sortMaterial.sortRadial = v;
                    },
                },
                sortMinDuration: {
                    get: () => this.sortMinDuration,
                    set: (v: number) => {
                        this.sortMinDuration = v;
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
            },
            composite: {
                enabled: {
                    get: () => this.compositeEnabled,
                    set: (v: boolean) => {
                        this.compositeEnabled = v;
                    },
                },
                highPrecisionAttachEnabled: {
                    get: () => this.compositeHighPrecisionAttachEnabled,
                    set: (v: boolean) => {
                        this.compositeHighPrecisionAttachEnabled = v;
                    },
                }
            },
            toneMapping: {
                enabled: {
                    get: () => this.toneMappingEnabled,
                    set: (v: boolean) => {
                        this.toneMappingEnabled = v;
                        if (v) {
                            this.splattingMaterial.colorTransfer = ColorTransfer.SrgbToLinear;
                        } else {
                            this.splattingMaterial.colorTransfer = ColorTransfer.Linear;
                        }
                        this.splattingMaterial.notifyRecompileShader();
                    },
                },
                toneMapping: {
                    get: () => this.toneMappingMaterial.toneMapping,
                    set: (v: ToneMapping) => {
                        this.toneMappingMaterial.toneMapping = v;
                        this.toneMappingMaterial.notifyRecompileShader();
                    }
                },
                exposure: {
                    get: () => this.toneMappingMaterial.exposure,
                    set: (v: number) => {
                        this.toneMappingMaterial.exposure = v;
                    }
                }
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
            },
            __INTERNAL__: {
                renderMode: {
                    get: () => this.splattingRenderMode,
                    set: (v: SplattingRenderMode) => {
                        this.splattingRenderMode = v;
                        const { splattingMaterial } = this;
                        if (v === SplattingRenderMode.Default) {
                            splattingMaterial.depthWrite = false;
                            splattingMaterial.transparent = true;
                            splattingMaterial.shadingPickIdEnabled = false;
                        } else if (v === SplattingRenderMode.PickingId) {
                            splattingMaterial.depthWrite = true;
                            splattingMaterial.transparent = false;
                            splattingMaterial.shadingPickIdEnabled = true;
                        }
                        splattingMaterial.notifyRecompileShader();
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
