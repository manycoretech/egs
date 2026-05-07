import { Vector3 } from '../math/Vector3';
import { Color } from '../math/Color';
/**
 * Triangular face used in {@link Geometry | Geometry }.
 * These are created automatically for all standard geometry types, however if you are building a custom geometry you will have to create them manually.
 */
export class Face3 {
    /**
     * Vertex A index.
     */
    public a: number;
    /**
     * Vertex B index.
     */
    public b: number;
    /**
     * Vertex C index.
     */
    public c: number;
    /**
     * (optional) Face normal {@link Vector3 | Vector3 } or array of vertex normals.
     * If a single vector is passed in, this sets {@link normal | normal }, otherwise if an array of three vectors is passed in this sets {@link vertexNormals | vertexNormals }.
     */
    public normal: Vector3;
    /**
     * Array of 3 vertex normals.
     */
    public vertexNormals: Vector3[];
    /**
     * Face color - for this to be used a material's vertexColors property must be set to FaceColors.
     * @defaultValue `new Color()`.
     */
    public color: Color;
    /**
     * Array of 3 vertex colors - for these to be used a material's vertexColors property must be set to {@link VertexColors | VertexColors }.
     * @defaultValue `0`.
     */
    public vertexColors: Color[];
    /**
     * Material index (points to an index in the associated array of materials).
     * @defaultValue `0`.
     */
    public materialIndex: number;

    constructor(
        a: number = 0, b: number = 0, c: number = 0,
        vertexNormals?: Vector3[] | Vector3, vertexColors?: Color[] | Color,
        materialIndex?: number) {
        this.a = a;
        this.b = b;
        this.c = c;

        this.normal = (vertexNormals && (vertexNormals as any).isVector3) ? vertexNormals as Vector3 : new Vector3();
        this.vertexNormals = Array.isArray(vertexNormals) ? vertexNormals : [];

        this.color = (vertexColors && (vertexColors as any).isColor) ? vertexColors as Color : new Color();
        this.vertexColors = Array.isArray(vertexColors) ? vertexColors : [];

        this.materialIndex = materialIndex !== undefined ? materialIndex : 0;
    }
    /**
     * Return a clone of this object.
     */
    public clone(): Face3 {
        return new Face3().copy(this);
    }
    /**
     * Copy the data to this object from source.
     * @param { Face3 } source the data source.
     */
    public copy(source: Face3): Face3 {
        this.a = source.a;
        this.b = source.b;
        this.c = source.c;
        this.normal.copy(source.normal);
        this.color.copy(source.color);
        this.materialIndex = source.materialIndex;

        for (let i = 0, il = source.vertexNormals.length; i < il; i++) {
            this.vertexNormals[i] = source.vertexNormals[i].clone();
        }

        for (let i = 0, il = source.vertexColors.length; i < il; i++) {
            this.vertexColors[i] = source.vertexColors[i].clone();
        }
        return this;
    }
}
