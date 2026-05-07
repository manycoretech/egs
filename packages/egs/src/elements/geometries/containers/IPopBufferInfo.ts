export interface IPopbufferInfo {
    version: number;
    attributes: IPopbufferAttributes; // popbuffer attributes recording its size and capacity
    indices: Uint16Array | Uint32Array;
    vertices: Float32Array;
    normals: Float32Array;
    textures: Float32Array;
    blocks: IMetaBlock[];
    maxPrecision: number; // the info max precision.
    levelPrecisions: number[]; // Precision in each level.
    /**
     * @deprecated
     */
    currentVertexCount: number; // all vertice size
    /**
     * @deprecated
     */
    currentBlockFaceCounts: number[]; // index number for every submesh
    /**
     * @deprecated
     */
    verticeDataLengthForEachLevel: any[];
}

export interface IMetaBlock {
    // similar to group
    index: number;
    name: string;
    start: number;
    count: number;
    // group index start index for minimal level, index after combined
    minLevelStart: number;
    // Triangle count at each level of this block
    levelFaceCounts: number[];
    levelVerticesCounts: number[];
    // levelFaceCounts cache for increase levels
    levelFaceAccumulateCounts: number[];
    levelVerticesAccumulateCounts: number[];
}

interface INumber3 {
    x: number;
    y: number;
    z: number;
}

export interface IPopbufferAttributes {
    boxMax: INumber3;
    boxMin: INumber3;
    vertexGridSize: number;
    vertexRepresentBit: INumber3;
    textureScale: number;
    normalScale: number;
    groupCount: number;
    blockNames: string[];
    faceCount: number; // all faces of sub meshes
    blockFaceCounts: number[]; // faces for each submeshes
    vertexCount: number; // all vertex number for submeshes
}
