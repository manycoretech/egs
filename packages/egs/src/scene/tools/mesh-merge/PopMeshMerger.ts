import { BufferAttribute } from '../../../elements/attributes/BufferAttribute';
import type { BufferGroup } from '../../../elements/geometries/containers/BufferGeometry';
import type { GeometryBase } from '../../../elements/geometries/containers/GeometryBase';
import type { PopBufferGeometry } from '../../../elements/geometries/containers/PopBufferGeometry';
import type { Material } from '../../../elements/materials/Material';
import {
    MergedMeshPhongMaterial, MergedMeshPhongMaterialDataTextureSchema
} from '../../../elements/materials/mesh/MergedMeshPhongMaterial';
import type { MeshPhongMaterial } from '../../../elements/materials/mesh/MeshPhongMaterial';
import { _Math } from '../../../math/Math';
import type { Nullable } from '../../../utils/Utils';
import type { Drawable } from '../../drawables/Drawable';
import type { PopMesh } from '../../drawables/PopMesh';
import { updateLODbyLevel } from '../DrawcallList';
import { TypeAssert } from '../TypeAssert';
import { createDataTexture } from './DataTextureCreator';
import { expandAttributeBySharedIndex, generateTransformedUVAttribute } from './GeometryProcess';
import { DrawcallMerger, type MergeDrawcallSource } from './Merger';
import type { IMetaBlock } from '../../../elements/geometries/containers/IPopBufferInfo';

function generateAccumulate(array: number[]): number[] {
    let countAcc = 0;
    const targetArray = [];
    for (let i = 0; i < array.length; i++) {
        countAcc += array[i];
        targetArray.push(countAcc);
    }
    return targetArray;
}

export class PopMeshMerger extends DrawcallMerger<PopMesh, MeshPhongMaterial, PopBufferGeometry> {
    downcastInputDrawable(input: Drawable): input is PopMesh {
        return TypeAssert.isPopMesh(input);
    }

    downcastInputMaterial(input: Material): input is MeshPhongMaterial {
        return TypeAssert.isMeshPhongMaterial(input);
    }

    downcastInputGeometry(input: GeometryBase): input is PopBufferGeometry {
        return TypeAssert.isBufferGeometry(input);
    }
    static MAX_COMBINED_TEXTURE = 8;

    extraCheck(inputs: Drawable[]) {
        return inputs.length === 1;
    }

    decideNextDrawcall(drawcall: MergeDrawcallSource<PopMesh, MeshPhongMaterial, PopBufferGeometry>): void {
        if (this.mergeGroup.length === 0) {
            this.mergeGroup.push([]);
        }
        const lastGroup = this.mergeGroup[this.mergeGroup.length - 1];
        if (drawcall.material.texture !== null) {
            this.textureCounter++;
            if (this.textureCounter === PopMeshMerger.MAX_COMBINED_TEXTURE) {
                this.textureCounter = 0;
                this.mergeGroup.push([drawcall]);
            } else {
                lastGroup.push(drawcall);
            }
        } else {
            lastGroup.push(drawcall);
        }
    }

    private textureCounter = 0;
    private modelBlockOffset = 0;
    private workingMesh: Nullable<PopMesh> = null;
    private newIndexAttribute: Nullable<Uint16Array | Uint32Array> = null;
    private newIndexFillOffset = 0;
    private mapIndexAttribute: Nullable<Float32Array> = null;
    private resultMaterialArray: MergedMeshPhongMaterial[] = [];
    private resultGroups: BufferGroup[] = [];
    private resultBlocks: IMetaBlock[] = [];
    private resultMesh: Nullable<PopMesh> = null;
    private newGeometry: Nullable<PopBufferGeometry> = null;

    reset() {
        super.reset();
        this.textureCounter = 0;
        this.modelBlockOffset = 0;
        this.newIndexFillOffset = 0;
        this.mapIndexAttribute = null;
        this.resultMaterialArray = [];
        this.resultGroups = [];
        this.resultBlocks = [];
        this.workingMesh = null;
        this.newIndexAttribute = null;
        this.resultMesh = null;
        this.newGeometry = null;
    }

    // if the split result shows no effect, just return the origin mesh
    earlyReturn(group: Array<Array<MergeDrawcallSource<PopMesh, MeshPhongMaterial, PopBufferGeometry>>>) {
        if (group.length === this.inputs[0].materials.length) {
            return true;
        }
        return false;
    }

    mergeImpl(group: Array<MergeDrawcallSource<PopMesh, MeshPhongMaterial, PopBufferGeometry>>): Nullable<PopMesh> {
        const pivot = group[0];

        // merging the first group
        if (this.workingMesh === null) {
            this.workingMesh = pivot.drawable;
            const geometry = this.workingMesh.geometry;
            updateLODbyLevel(this.workingMesh, geometry, 100); // need setup max level before any geometry processing

            this.newGeometry = geometry.clone();
            const expandResult = expandAttributeBySharedIndex(geometry);
            if (expandResult) {
                this.newGeometry.index = expandResult.index;
                this.newGeometry.addAttribute('position', expandResult.position);
                this.newGeometry.addAttribute('uv', expandResult.uv);
                this.newGeometry.addAttribute('normal', expandResult.normal);
            }
            // gen expand uv as new attribute
            const newUV = generateTransformedUVAttribute(this.newGeometry, this.workingMesh.getMaterials());
            this.newGeometry.uv.array = newUV;

            // do geometry expansion, directly modify geometry
            this.newGeometry.model = {
                ...geometry.model,
                vertices: this.newGeometry.position.array as Float32Array,
                normals: this.newGeometry.getAttribute('normal')!.array as Float32Array,
                textures: this.newGeometry.uv.array as Float32Array,
                indices: this.newGeometry.index.array,
            };

            this.newIndexAttribute = this.newGeometry.index.array.slice();
            this.mapIndexAttribute = new Float32Array(this.newGeometry.position.count * 2);
        }

        const resultMaterial = new MergedMeshPhongMaterial();
        // do basic property copy
        resultMaterial.transparent = pivot.material.transparent;
        resultMaterial.side = pivot.material.side;
        resultMaterial.polygonOffset = pivot.material.polygonOffset;
        resultMaterial.polygonOffsetFactor = pivot.material.polygonOffsetFactor;
        resultMaterial.polygonOffsetUnits = pivot.material.polygonOffsetUnits;
        resultMaterial.blending = pivot.material.blending;
        resultMaterial.blendDst = pivot.material.blendDst;
        resultMaterial.blendDstAlpha = pivot.material.blendDstAlpha;
        resultMaterial.blendEquation = pivot.material.blendEquation;
        resultMaterial.blendEquationAlpha = pivot.material.blendEquationAlpha;
        resultMaterial.blendSrc = pivot.material.blendSrc;
        resultMaterial.blendSrcAlpha = pivot.material.blendSrcAlpha;
        resultMaterial.depthFunc = pivot.material.depthFunc;
        resultMaterial.depthTest = pivot.material.depthTest;
        resultMaterial.depthWrite = pivot.material.depthWrite;
        resultMaterial.colorWrite = pivot.material.colorWrite;

        // collect map and get indexMap data
        // -2 -1 0 1 2 3
        //  t  t v v v v
        // t: texture v: value
        let mapCount = 0; // start from 0
        group.forEach((g, i) => {
            let mapIndex = i;
            if (g.material.texture !== null) {
                resultMaterial.setTextureUnit(g.material.texture, mapCount);
                mapCount++;
                mapIndex = -mapCount;
            }

            // set map index
            const geometryGroup = g.geometry.getGroup(g.groupIndex)!;
            const index = this.newGeometry!.index.array;
            for (let j = 0; j < geometryGroup.count; ++j) {
                this.mapIndexAttribute![index[geometryGroup.start + j] * 2] = mapIndex;
                this.mapIndexAttribute![index[geometryGroup.start + j] * 2 + 1] = i;
            }
        });
        const dataTexture = createDataTexture(MergedMeshPhongMaterialDataTextureSchema.info, group.map(g => g.material));
        resultMaterial.dataTexture = dataTexture;
        this.resultMaterialArray.push(resultMaterial);

        // generate pop block and group
        const popBlockInfo = this.createModelBlock(this.resultGroups.length, group);
        this.resultBlocks.push(popBlockInfo);
        this.resultGroups.push({
            start: popBlockInfo.start,
            count: popBlockInfo.count,
            materialIndex: this.resultGroups.length
        });

        return null;
    }

    afterMerge(): void {
        // assemble the result mesh
        const newGeometry = this.newGeometry!;
        newGeometry.index = new BufferAttribute(this.newIndexAttribute!, 1);
        newGeometry.model.indices = this.newIndexAttribute!;
        newGeometry.setAttribute('map_index', new BufferAttribute(this.mapIndexAttribute!, 2));
        newGeometry.setGroups(this.resultGroups);
        newGeometry.model.blocks = this.resultBlocks;
        if (!this.resultMesh) {
            this.resultMesh = this.workingMesh!.clone();
        }
        this.resultMesh.destroy();
        this.resultMesh.geometry = newGeometry;
        this.resultMesh.setMaterials(this.resultMaterialArray);
        this.resultMesh.isLODEnabled = this.workingMesh!.isLODEnabled;

        this.results.push(this.resultMesh);
    }

    private createModelBlock(blockIndex: number, group: Array<MergeDrawcallSource<PopMesh, MeshPhongMaterial, PopBufferGeometry>>): IMetaBlock {
        let vertexCount = 0;
        const inputGroups: Array<{ group: BufferGroup, groupIndex: number }> = [];
        group.forEach(g => {
            const geometryGroup = g.geometry.getGroup(g.groupIndex)!;
            inputGroups.push({ group: geometryGroup, groupIndex: g.groupIndex });
            vertexCount += geometryGroup.count;
        });

        const pivot = group[0];
        const index = this.newGeometry!.index.array;
        const constructor = index instanceof Uint16Array ? Uint16Array : Uint32Array;

        const newBlockFaceLevels: number[] = [];
        const newBlockVtxLevels: number[] = [];
        const levelCount = pivot.geometry.model.blocks[0].levelFaceCounts.length;
        for (let i = 0; i < levelCount; i++) {
            let levelFaceAcc = 0;
            let levelVrtAcc = 0;
            for (let j = 0; j < inputGroups.length; ++j) {
                const { group, groupIndex } = inputGroups[j];
                const block = pivot.geometry.model.blocks[groupIndex];
                const faceCount = block.levelFaceCounts[i];
                levelFaceAcc += faceCount;
                levelVrtAcc += block.levelVerticesCounts[i];
                if (faceCount > 0) {
                    const count = faceCount * 3;
                    const start = group.start + _Math.SumArraySection(block.levelFaceCounts, 0, i - 1) * 3;
                    const indexCopyView = new constructor(index.buffer as ArrayBuffer, start * index.BYTES_PER_ELEMENT, count);
                    this.newIndexAttribute!.set(indexCopyView, this.newIndexFillOffset);
                    this.newIndexFillOffset += count;
                }
            }
            newBlockFaceLevels.push(levelFaceAcc);
            newBlockVtxLevels.push(levelVrtAcc);
        }
        const newBlock: IMetaBlock = {
            index: blockIndex,
            name: 'merged block',
            start: this.modelBlockOffset,
            count: vertexCount,
            minLevelStart: 0,
            levelFaceCounts: newBlockFaceLevels,
            levelVerticesCounts: newBlockVtxLevels,
            levelFaceAccumulateCounts: generateAccumulate(newBlockFaceLevels),
            levelVerticesAccumulateCounts: generateAccumulate(newBlockVtxLevels),
        };
        this.modelBlockOffset += vertexCount;
        return newBlock;
    }
}
