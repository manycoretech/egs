export type TypedArray = Float32Array | Uint32Array | Uint16Array | Uint8Array | Int32Array | Int16Array | Int8Array;

export interface BaseModule {
    Mesh: new () => Mesh;

    DracoFloat32Array: new () => DracoFloat32Array;
    DracoInt8Array: new () => DracoInt8Array;
    DracoInt16Array: new () => DracoInt16Array;
    DracoInt32Array: new () => DracoInt32Array;
    DracoUInt8Array: new () => DracoUInt8Array;
    DracoUInt16Array: new () => DracoUInt16Array;
    DracoUInt32Array: new () => DracoUInt32Array;

    POSITION: GeometryAttributeType;
    NORMAL: GeometryAttributeType;
    TEX_COORD: GeometryAttributeType;
    COLOR: GeometryAttributeType;
    GENERIC: GeometryAttributeType;
    INVALID: GeometryAttributeType;

    _malloc(ptr: number): number;
    _free(ptr: number): void;
    destroy(object: unknown): void;

    // Heap.
    HEAPF32: Float32Array;
    HEAP32: Int32Array;
    HEAP16: Int16Array;
    HEAP8: Int8Array;
    HEAPU32: Uint32Array;
    HEAPU16: Uint16Array;
    HEAPU8: Uint8Array;
}

export interface DracoDecoderModuleProps {
    wasmBinary?: ArrayBuffer;
    onModuleLoaded?(draco: DecoderModule): void;
}

function DracoDecoderModule(props: DracoDecoderModuleProps): Promise<DecoderModule>;

export interface DecoderModule extends BaseModule {
    Decoder: new () => Decoder;
    DecoderBuffer: new () => DecoderBuffer;
    PointCloud: new () => PointCloud;
    MetadataQuerier: new () => MetadataQuerier;

    // GeometryType.
    TRIANGULAR_MESH: GeometryType;
    POINT_CLOUD: GeometryType;

    // DataType.
    DT_FLOAT32: DataType;
    DT_INT8: DataType;
    DT_INT16: DataType;
    DT_INT32: DataType;
    DT_UINT8: DataType;
    DT_UINT16: DataType;
    DT_UINT32: DataType;
}

export interface Decoder {
    DecodeBufferToMesh(buffer: DecoderBuffer, mesh: Mesh): Status;
    DecodeBufferToPointCloud(buffer: DecoderBuffer, pointCloud: PointCloud): Status;
    GetAttributeByUniqueId(pointCloud: PointCloud, id: number): Attribute;
    GetFaceFromMesh(mesh: Mesh, index: number, array: DracoArray): number;
    GetTrianglesUInt16Array(mesh: Mesh, byteLength: number, ptr: number): void;
    GetTrianglesUInt32Array(mesh: Mesh, byteLength: number, ptr: number): void;
    GetAttributeDataArrayForAllPoints: (
        pointCloud: PointCloud,
        attribute: Attribute,
        type: DataType,
        byteLength: number,
        ptr: number,
    ) => void;
    GetAttributeFloatForAllPoints(pointCloud: PointCloud, attribute: Attribute, array: DracoArray): void;
    GetAttributeInt8ForAllPoints(pointCloud: PointCloud, attribute: Attribute, array: DracoArray): void;
    GetAttributeInt16ForAllPoints(pointCloud: PointCloud, attribute: Attribute, array: DracoArray): void;
    GetAttributeInt32ForAllPoints(pointCloud: PointCloud, attribute: Attribute, array: DracoArray): void;
    GetAttributeUInt8ForAllPoints(pointCloud: PointCloud, attribute: Attribute, array: DracoArray): void;
    GetAttributeUInt16ForAllPoints(pointCloud: PointCloud, attribute: Attribute, array: DracoArray): void;
    GetAttributeUInt32ForAllPoints(pointCloud: PointCloud, attribute: Attribute, array: DracoArray): void;
    GetEncodedGeometryType(buffer: DecoderBuffer): GeometryType;
    GetAttributeId(pointCloud: PointCloud, attributeType: number): number;
    GetAttributeIdByName(pointCloud: PointCloud, name: string): number;
    GetAttribute(pointCloud: PointCloud, id: number): Attribute;
    GetMetadata(pointCloud: PointCloud): Metadata;
    GetAttributeMetadata(pointCloud: PointCloud, attributeId: number): Metadata;
}

export interface DecoderBuffer {
    Init(array: Int8Array, byteLength: number): void;
}

export interface DracoArray {
    GetValue(index: number): number;
}

// oxlint-disable-next-line typescript/no-empty-interface
export interface DracoFloat32Array extends DracoArray {}
// oxlint-disable-next-line typescript/no-empty-interface
export interface DracoInt8Array extends DracoArray {}
// oxlint-disable-next-line typescript/no-empty-interface
export interface DracoInt16Array extends DracoArray {}
// oxlint-disable-next-line typescript/no-empty-interface
export interface DracoInt32Array extends DracoArray {}
// oxlint-disable-next-line typescript/no-empty-interface
export interface DracoUInt8Array extends DracoArray {}
// oxlint-disable-next-line typescript/no-empty-interface
export interface DracoUInt16Array extends DracoArray {}
// oxlint-disable-next-line typescript/no-empty-interface
export interface DracoUInt32Array extends DracoArray {}

export interface Status {
    ok(): boolean;
    error_msg(): string;
}

export interface Attribute {
    num_components(): number;
    normalized(): boolean;
}

export enum GeometryType {}

export enum GeometryAttributeType {}

export enum DataType {}

// oxlint-disable-next-line typescript/no-empty-interface
export interface Metadata {}

export interface MetadataQuerier {
    HasEntry(metadata: Metadata, entryName: string): boolean;
    GetIntEntry(metadata: Metadata, entryName: string): number;
    GetIntEntryArray(metadata: Metadata, entryName: string, outValues: DracoInt32Array): void;
    GetDoubleEntry(metadata: Metadata, entryName: string): number;
    GetStringEntry(metadata: Metadata, entryName: string): string;
    NumEntries(metadata: Metadata): number;
    GetEntryName(metadata: Metadata, entryId: number): string;
}

export interface PointCloud {
    ptr: number;
    num_attributes(): number;
    num_points(): number;
}

export interface Mesh extends PointCloud {
    num_faces(): number;
}

export default DracoDecoderModule;
