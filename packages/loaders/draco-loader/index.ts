import { deferred } from '@qunhe/egs-lib';
import DracoDecoderModule, {
    type DecoderModule,
    type Decoder,
    type PointCloud,
    type Mesh,
    type Attribute,
    type TypedArray,
} from './draco_decoder_wrapper';
import DracoDecoderWasm from './draco_decoder.wasm';

let DecoderModule: Promise<DecoderModule> | undefined;
function getDracoDecoderModule(): Promise<DecoderModule> {
    if (!DecoderModule) {
        const { promise, resolve } = deferred<DecoderModule>();
        DracoDecoderModule({
            wasmBinary: DracoDecoderWasm,
            onModuleLoaded(decoder: DecoderModule) {
                resolve(decoder);
            },
        });
        // oxlint-disable-next-line no-import-assign
        DecoderModule = promise;
    }

    return DecoderModule;
}

interface IAttribute<T extends TypedArray = TypedArray> {
    array: T;
    itemSize: number;
}

enum AttributeType {
    Float32Array,
    Int32Array,
    Int16Array,
    Int8Array,
    Uint32Array,
    Uint16Array,
    Uint8Array,
}

interface IGroup {
    start: number;
    count: number;
    materialIndex: number;
    block: { name: string; index: number };
}

interface IDracoGeometry {
    isPointCloud: boolean;
    index?: IAttribute<Uint32Array>;
    position: IAttribute;
    normal?: IAttribute;
    uv?: IAttribute;
    color?: IAttribute;
    groups: IGroup[];
}

function decodeAttribute(
    draco: DecoderModule,
    decoder: Decoder,
    dracoGeometry: PointCloud,
    attributeType: AttributeType,
    attribute: Attribute,
): IAttribute {
    const itemSize = attribute.num_components();
    const numValues = dracoGeometry.num_points() * itemSize;

    let array: TypedArray;
    switch (attributeType) {
        case AttributeType.Float32Array: {
            const dataSize = numValues * 4;
            const ptr = draco._malloc(dataSize);
            decoder.GetAttributeDataArrayForAllPoints(dracoGeometry, attribute, draco.DT_FLOAT32, dataSize, ptr);
            array = new Float32Array(draco.HEAPF32.buffer, ptr, numValues).slice();
            draco._free(ptr);
            break;
        }
        case AttributeType.Int8Array: {
            const ptr = draco._malloc(numValues);
            decoder.GetAttributeDataArrayForAllPoints(dracoGeometry, attribute, draco.DT_INT8, numValues, ptr);
            array = new Int8Array(draco.HEAP8.buffer, ptr, numValues).slice();
            draco._free(ptr);
            break;
        }
        case AttributeType.Int16Array: {
            const dataSize = numValues * 2;
            const ptr = draco._malloc(dataSize);
            decoder.GetAttributeDataArrayForAllPoints(dracoGeometry, attribute, draco.DT_INT16, dataSize, ptr);
            array = new Int16Array(draco.HEAP16.buffer, ptr, numValues).slice();
            draco._free(ptr);
            break;
        }
        case AttributeType.Int32Array: {
            const dataSize = numValues * 4;
            const ptr = draco._malloc(dataSize);
            decoder.GetAttributeDataArrayForAllPoints(dracoGeometry, attribute, draco.DT_INT32, dataSize, ptr);
            array = new Int32Array(draco.HEAP32.buffer, ptr, numValues).slice();
            draco._free(ptr);
            break;
        }
        case AttributeType.Uint8Array: {
            const ptr = draco._malloc(numValues);
            decoder.GetAttributeDataArrayForAllPoints(dracoGeometry, attribute, draco.DT_UINT8, numValues, ptr);
            array = new Uint8Array(draco.HEAPU8.buffer, ptr, numValues).slice();
            draco._free(ptr);
            break;
        }
        case AttributeType.Uint16Array: {
            const dataSize = numValues * 2;
            const ptr = draco._malloc(dataSize);
            decoder.GetAttributeDataArrayForAllPoints(dracoGeometry, attribute, draco.DT_UINT16, dataSize, ptr);
            array = new Uint16Array(draco.HEAPU16.buffer, ptr, numValues).slice();
            draco._free(ptr);
            break;
        }
        case AttributeType.Uint32Array: {
            const dataSize = numValues * 4;
            const ptr = draco._malloc(dataSize);
            decoder.GetAttributeDataArrayForAllPoints(dracoGeometry, attribute, draco.DT_UINT32, dataSize, ptr);
            array = new Uint32Array(draco.HEAPU32.buffer, ptr, numValues).slice();
            draco._free(ptr);
            break;
        }
        default:
            throw new Error('EGS.DRACOLoader: Unexpected attribute type.');
    }

    return {
        array,
        itemSize,
    };
}

function parseMesh(draco: DecoderModule, decoder: Decoder, dracoGeometry: Mesh): IDracoGeometry {
    const numFaces = dracoGeometry.num_faces();
    const numIndices = numFaces * 3;
    const dataSize = numIndices * 4;
    const ptr = draco._malloc(dataSize);
    decoder.GetTrianglesUInt32Array(dracoGeometry, dataSize, ptr);
    const index = new Uint32Array(draco.HEAPU32.buffer, ptr, numIndices).slice();
    draco._free(ptr);

    const indexAttr: IAttribute<Uint32Array> = { array: index, itemSize: 1 };
    let attributeID: number;
    // position
    attributeID = decoder.GetAttributeId(dracoGeometry, draco.POSITION);
    if (attributeID === -1) {
        throw new Error('EGS.DRACOLoader: must has position attribute.');
    }
    const attribute = decoder.GetAttribute(dracoGeometry, attributeID);
    const positionAttr = decodeAttribute(draco, decoder, dracoGeometry, AttributeType.Float32Array, attribute);
    // normal
    let normalAttr: IAttribute | undefined;
    attributeID = decoder.GetAttributeId(dracoGeometry, draco.NORMAL);
    if (attributeID !== -1) {
        const attribute = decoder.GetAttribute(dracoGeometry, attributeID);
        normalAttr = decodeAttribute(draco, decoder, dracoGeometry, AttributeType.Float32Array, attribute);
    }
    // uv
    let uvAttr: IAttribute | undefined;
    attributeID = decoder.GetAttributeId(dracoGeometry, draco.TEX_COORD);
    if (attributeID !== -1) {
        const attribute = decoder.GetAttribute(dracoGeometry, attributeID);
        uvAttr = decodeAttribute(draco, decoder, dracoGeometry, AttributeType.Float32Array, attribute);
    }
    // color
    let colorAttr: IAttribute | undefined;
    attributeID = decoder.GetAttributeId(dracoGeometry, draco.COLOR);
    if (attributeID !== -1) {
        const attribute = decoder.GetAttribute(dracoGeometry, attributeID);
        colorAttr = decodeAttribute(draco, decoder, dracoGeometry, AttributeType.Float32Array, attribute);
    }

    // material index
    const blockMap: Record<number, { name: string; index: number }> = {};
    let materialAttr: IAttribute | undefined;
    attributeID = decoder.GetAttributeIdByName(dracoGeometry, 'material');
    if (attributeID !== -1) {
        const attribute = decoder.GetAttribute(dracoGeometry, attributeID);
        materialAttr = decodeAttribute(draco, decoder, dracoGeometry, AttributeType.Float32Array, attribute);

        const querier = new draco.MetadataQuerier();
        const attrMetadata = decoder.GetAttributeMetadata(dracoGeometry, attributeID);
        const entryCount = querier.NumEntries(attrMetadata);
        for (let i = 0; i < entryCount; i++) {
            const name = querier.GetEntryName(attrMetadata, i);
            // skip dirty data
            if (name === 'name') {
                continue;
            }
            const int = querier.GetIntEntry(attrMetadata, name);
            blockMap[int] = {
                name,
                index: i,
            };
        }
    }

    // sort index and create group
    const groups: IGroup[] = [];
    if (materialAttr) {
        // gen block range
        const materialRange: number[] = [];
        const materialRangeIndex: number[] = [];
        const materialArr = materialAttr.array;
        let currentMaterialIndex = materialArr[0];
        for (let i = 0; i < materialArr.length; i++) {
            const materialIndex = materialArr[i];
            if (currentMaterialIndex !== materialIndex) {
                materialRange.push(i - 1);
                materialRangeIndex.push(currentMaterialIndex);
                currentMaterialIndex = materialIndex;
                continue;
            }
        }
        if (materialArr[materialArr.length - 1] !== materialRangeIndex[materialRangeIndex.length - 1]) {
            materialRange.push(materialArr.length);
            materialRangeIndex.push(materialArr[materialArr.length - 1]);
        }
        // fill index group array
        const indexGroups: number[][] = [];
        for (let i = 0; i < materialRangeIndex.length; i++) {
            indexGroups[materialRangeIndex[i]] = [];
        }
        // repack index
        const indexArr = indexAttr.array;
        for (let i = 0; i < indexArr.length; i += 3) {
            const index = indexArr[i];
            let rangeIndex: number = 0;
            for (let j = 0; j < materialRange.length; j++) {
                const end = materialRange[j];
                if (index < end) {
                    rangeIndex = j;
                    break;
                }
            }
            const materialIndex = materialRangeIndex[rangeIndex];
            indexGroups[materialIndex].push(index, indexArr[i + 1], indexArr[i + 2]);
        }

        const newIndexArr = (indexAttr.array = new Uint32Array(indexAttr.array.length));
        const materialGroups = Array.from(new Set(materialRangeIndex));
        let start: number = 0;
        for (let i = 0; i < materialGroups.length; i++) {
            const materialIndex = materialGroups[i];
            const indexGroup = indexGroups[materialIndex];
            newIndexArr.set(indexGroup, start);
            groups.push({
                start,
                count: indexGroup.length,
                materialIndex,
                block: {
                    name: blockMap[materialIndex].name,
                    index: materialIndex,
                },
            });
            start += indexGroup.length;
            indexGroups[materialIndex] = [];
        }
    }

    if (!groups.length) {
        groups.push({
            start: 0,
            count: indexAttr.array.length,
            materialIndex: 0,
            block: { name: '', index: 0 },
        });
    }

    return {
        isPointCloud: false,
        index: indexAttr,
        position: positionAttr,
        normal: normalAttr,
        uv: uvAttr,
        color: colorAttr,
        groups,
    };
}

function parsePointCloud(draco: DecoderModule, decoder: Decoder, dracoGeometry: PointCloud): IDracoGeometry {
    let attributeID: number;
    // position
    attributeID = decoder.GetAttributeId(dracoGeometry, draco.POSITION);
    if (attributeID === -1) {
        throw new Error('EGS.DRACOLoader: must has position attribute.');
    }
    const attribute = decoder.GetAttribute(dracoGeometry, attributeID);
    const positionAttr = decodeAttribute(draco, decoder, dracoGeometry, AttributeType.Float32Array, attribute);
    // color
    let colorAttr: IAttribute | undefined;
    attributeID = decoder.GetAttributeId(dracoGeometry, draco.COLOR);
    if (attributeID !== -1) {
        const attribute = decoder.GetAttribute(dracoGeometry, attributeID);
        colorAttr = decodeAttribute(draco, decoder, dracoGeometry, AttributeType.Float32Array, attribute);
    }

    return {
        isPointCloud: true,
        position: positionAttr,
        color: colorAttr,
        groups: [
            {
                start: 0,
                count: dracoGeometry.num_points(),
                materialIndex: 0,
                block: { name: '', index: 0 },
            },
        ],
    };
}

export interface ParseConfig {
    enableParseMesh: boolean;
    enableParsePointCloud: boolean;
}

export async function parseDracoBuffer(
    buffer: ArrayBuffer,
    config: Partial<ParseConfig> = {},
): Promise<IDracoGeometry> {
    const { enableParseMesh = true, enableParsePointCloud = false } = config;

    const draco = await getDracoDecoderModule();
    const decoder = new draco.Decoder();
    const decoderBuffer = new draco.DecoderBuffer();
    decoderBuffer.Init(new Int8Array(buffer), buffer.byteLength);

    let result: IDracoGeometry;
    const geometryType = decoder.GetEncodedGeometryType(decoderBuffer);
    if (enableParseMesh && geometryType === draco.TRIANGULAR_MESH) {
        const dracoGeometry = new draco.Mesh();
        const decodingStatus = decoder.DecodeBufferToMesh(decoderBuffer, dracoGeometry);
        if (!decodingStatus.ok() || dracoGeometry.ptr === 0) {
            throw new Error('EGS.DRACOLoader: Decoding failed: ' + decodingStatus.error_msg());
        }
        result = parseMesh(draco, decoder, dracoGeometry);
        draco.destroy(dracoGeometry);
    } else if (enableParsePointCloud && geometryType === draco.POINT_CLOUD) {
        const dracoGeometry = new draco.PointCloud();
        const decodingStatus = decoder.DecodeBufferToPointCloud(decoderBuffer, dracoGeometry);
        if (!decodingStatus.ok() || dracoGeometry.ptr === 0) {
            throw new Error('EGS.DRACOLoader: Decoding failed: ' + decodingStatus.error_msg());
        }
        result = parsePointCloud(draco, decoder, dracoGeometry);
        draco.destroy(dracoGeometry);
    } else {
        throw new Error('EGS.DRACOLoader: Unexpected geometry type.');
    }

    return result;
}
