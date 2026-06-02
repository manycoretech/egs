
import { BufferAttribute } from '../../../../elements/attributes/BufferAttribute';
import { Geometry } from '../../../../elements/geometries/containers/Geometry';
import { Vector2 } from '../../../../math/Vector2';
import { Vector3 } from '../../../../math/Vector3';
import { Curve } from '../../../../math/shape/curves/Curve';
import { Shape } from '../../../../math/shape/plane/Shape';
import { BufferGeometry } from '../../../../elements/geometries/containers/BufferGeometry';
import { logger } from '../../../../utils/Logger';
import { computeNormalsByPosition } from '../../../../elements/geometries/operators/Renormalize';
import { Font } from '../../../../math/shape/plane/Font';

const WorldUVGenerator = {
    generateTopUV(_geometry: Geometry, vertices: number[], indexA: number, indexB: number, indexC: number) {
        const a_x = vertices[indexA * 3];
        const a_y = vertices[indexA * 3 + 1];
        const b_x = vertices[indexB * 3];
        const b_y = vertices[indexB * 3 + 1];
        const c_x = vertices[indexC * 3];
        const c_y = vertices[indexC * 3 + 1];
        return [
            new Vector2(a_x, a_y),
            new Vector2(b_x, b_y),
            new Vector2(c_x, c_y)
        ];
    },

    generateSideWallUV(_geometry: Geometry, vertices: number[], indexA: number, indexB: number, indexC: number, indexD: number) {
        const a_x = vertices[indexA * 3];
        const a_y = vertices[indexA * 3 + 1];
        const a_z = vertices[indexA * 3 + 2];
        const b_x = vertices[indexB * 3];
        const b_y = vertices[indexB * 3 + 1];
        const b_z = vertices[indexB * 3 + 2];
        const c_x = vertices[indexC * 3];
        const c_y = vertices[indexC * 3 + 1];
        const c_z = vertices[indexC * 3 + 2];
        const d_x = vertices[indexD * 3];
        const d_y = vertices[indexD * 3 + 1];
        const d_z = vertices[indexD * 3 + 2];

        if (Math.abs(a_y - b_y) < 0.01) {
            return [
                new Vector2(a_x, 1 - a_z),
                new Vector2(b_x, 1 - b_z),
                new Vector2(c_x, 1 - c_z),
                new Vector2(d_x, 1 - d_z)
            ];
        } else {
            return [
                new Vector2(a_y, 1 - a_z),
                new Vector2(b_y, 1 - b_z),
                new Vector2(c_y, 1 - c_z),
                new Vector2(d_y, 1 - d_z)
            ];
        }
    }
};
export interface ExtrudeOptions {
    steps: number,
    depth: number,
    bevelEnabled: boolean,
    bevelThickness: number,
    bevelSize: number,
    bevelSegments: number,
    curveSegments: number,
    UVGenerator: typeof WorldUVGenerator
    extrudePath: Curve<Vector3>,
}
export interface TextShapeParameter {
    font?: Font;
    size?: number;
    height?: number;
    curveSegments?: number;
    bevelEnabled?: boolean;
    bevelThickness?: number;
    bevelSize?: number;
}

export function extrude(shapes: Shape | Shape[], options?: Partial<ExtrudeOptions>): BufferGeometry {
    return new ExtrudeBufferGeometry(shapes, options);
}
export function text(text: string, params: Partial<TextShapeParameter>): BufferGeometry {
    const font = params.font;
    if (!(font && font.isFont)) {
        logger.invalidInput('EGS.TextGeometry: font parameter is not an instance of EGS.Font.');
        return new BufferGeometry();
    }

    // translate parameters to ExtrudeBufferGeometry API
    (params as any).depth = params.height !== undefined ? params.height : 50;

    // defaults
    if (params.bevelThickness === undefined) {
        params.bevelThickness = 10;
    }
    if (params.bevelSize === undefined) {
        params.bevelSize = 8;
    }
    if (params.bevelEnabled === undefined) {
        params.bevelEnabled = false;
    }
    const shapes = font.generateShapes(text, params.size);
    return extrude(shapes, params);
}

export class ExtrudeBufferGeometry extends BufferGeometry {
    parameters: {
        shapes: Shape | Shape[],
        options: Partial<ExtrudeOptions>
    };
    /**
     * @param { number } shapes Shape or an array of shapes.
     * @param { number } options Object that can contain the following parameters. <br />
     * curveSegments — int. Number of points on the curves. Default is 12. <br />
     * steps — int. Number of points used for subdividing segments along the depth of the extruded spline. Default is 1. <br />
     * depth — float. Depth to extrude the shape. Default is 100. <br />
     * bevelEnabled — bool. Apply beveling to the shape. Default is true. <br />
     * bevelThickness — float. How deep into the original shape the bevel goes. Default is 6. <br />
     * bevelSize — float. Distance from the shape outline that the bevel extends. Default is bevelThickness - 2. <br />
     * bevelOffset — float. Distance from the shape outline that the bevel starts. Default is 0. <br />
     * bevelSegments — int. Number of bevel layers. Default is 3. <br />
     * extrudePath — Curve. A 3D spline path along which the shape should be extruded. <br />
     * UVGenerator — Object. object that provides UV generator functions. <br />
     * This object extrudes a 2D shape to a 3D geometry.
     * When creating a Mesh with this geometry, if you'd like to have a separate material used for its face and its extruded sides, you can use an array of materials.
     * The first material will be applied to the face; the second material will be applied to the sides.
     */
    constructor(shapes: Shape | Shape[] = [], options: Partial<ExtrudeOptions> = {}) {
        super();

        this.parameters = {
            shapes,
            options
        };
        shapes = Array.isArray(shapes) ? shapes : [shapes];
        const verticesArray: number[] = [];
        const uvArray: number[] = [];
        for (let i = 0, l = shapes.length; i < l; i++) {
            const shape = shapes[i];
            this.addShape(shape, verticesArray, uvArray);
        }

        // build geometry
        this.addAttribute('position', new BufferAttribute(new Float32Array(verticesArray), 3));
        this.addAttribute('uv', new BufferAttribute(new Float32Array(uvArray), 2));
        computeNormalsByPosition(this);
    }

    private addShape(shape: Shape, verticesArray: number[], uvArray: number[]): void {
        const placeholder: number[] = [];
        const scope = this;
        // options
        const curveSegments = scope.parameters.options.curveSegments !== undefined ? scope.parameters.options.curveSegments : 12;
        const steps = scope.parameters.options.steps !== undefined ? scope.parameters.options.steps : 1;
        const depth = scope.parameters.options.depth !== undefined ? scope.parameters.options.depth : 100;
        let bevelEnabled = scope.parameters.options.bevelEnabled !== undefined ? scope.parameters.options.bevelEnabled : true;
        let bevelThickness = scope.parameters.options.bevelThickness !== undefined ? scope.parameters.options.bevelThickness : 6;
        let bevelSize = scope.parameters.options.bevelSize !== undefined ? scope.parameters.options.bevelSize : bevelThickness - 2;
        let bevelSegments = scope.parameters.options.bevelSegments !== undefined ? scope.parameters.options.bevelSegments : 3;
        const extrudePath = scope.parameters.options.extrudePath;
        const uvgen = scope.parameters.options.UVGenerator !== undefined ? scope.parameters.options.UVGenerator : WorldUVGenerator;

        let extrudeByPath = false;
        let extrudePts: Vector3[], splineTube, biNormal: Vector3, normal: Vector3, position2: Vector3;
        if (extrudePath) {
            extrudePts = extrudePath.getSpacedPoints(steps);
            extrudeByPath = true;
            bevelEnabled = false; // bevels not supported for path extrusion
            // SETUP TNB variables
            // TODO1 - have a .isClosed in spline?
            splineTube = extrudePath.computeFrenetFrames(steps, false);

            biNormal = new Vector3();
            normal = new Vector3();
            position2 = new Vector3();
        }

        // Safeguards if bevels are not enabled
        if (!bevelEnabled) {
            bevelSegments = 0;
            bevelThickness = 0;
            bevelSize = 0;
        }

        // Variables initialization
        let ahole, h, hl; // looping of holes
        const shapePoints = shape.extractPoints(curveSegments);
        let vertices = shapePoints.shape;
        const holes = shapePoints.holes;
        const reverse = !Shape.isClockWise(vertices);
        if (reverse) {
            vertices = vertices.reverse();
            // Maybe we should also check if holes are in the opposite direction, just to be safe ...
            for (h = 0, hl = holes.length; h < hl; h++) {
                ahole = holes[h];
                if (Shape.isClockWise(ahole)) {
                    holes[h] = ahole.reverse();
                }
            }
        }
        const faces = Shape.triangulateShape(vertices, holes);
        /* Vertices */
        const contour = vertices; // vertices has all points but contour has only points of circumference
        for (h = 0, hl = holes.length; h < hl; h++) {
            ahole = holes[h];
            vertices = vertices.concat(ahole);
        }

        function scalePt2(pt: Vector2, vec: Vector2, size: number): Vector2 {
            if (!vec) {
                logger.invalidInput('EGS.ExtrudeBufferGeometry: vec does not exist');
            }
            return vec.clone().multiplyScalar(size).add(pt);
        }

        let b, bs, t, z, vert, face, i, j, k, s, il;
        const vlen = vertices.length;
        const flen = faces.length;
        // Find directions for point movement
        function getBevelVec(inPt: Vector2, inPrev: Vector2, inNext: Vector2) {
            // computes for inPt the corresponding point inPt' on a new contour shifted by 1 unit (length of normalized vector) to the left
            // if we walk along contour clockwise, this new contour is outside the old one
            // inPt' is the intersection of the two lines parallel to the two adjacent edges of inPt at a distance of 1 unit on the left side.
            let v_trans_x, v_trans_y, shrink_by; // resulting translation vector for inPt
            const v_prev_x = inPt.x - inPrev.x; // good reading for geometry algorithms (here: line-line intersection) http://geomalgorithms.com/a05-_intersect-1.html
            const v_prev_y = inPt.y - inPrev.y;
            const v_next_x = inNext.x - inPt.x;
            const v_next_y = inNext.y - inPt.y;
            const v_prev_lensq = (v_prev_x * v_prev_x + v_prev_y * v_prev_y);
            // check for collinear edges
            const collinear0 = (v_prev_x * v_next_y - v_prev_y * v_next_x);

            if (Math.abs(collinear0) > Number.EPSILON) {
                // not collinear, length of vectors for normalizing
                const v_prev_len = Math.sqrt(v_prev_lensq);
                const v_next_len = Math.sqrt(v_next_x * v_next_x + v_next_y * v_next_y);

                // shift adjacent points by unit vectors to the left
                const ptPrevShift_x = (inPrev.x - v_prev_y / v_prev_len);
                const ptPrevShift_y = (inPrev.y + v_prev_x / v_prev_len);
                const ptNextShift_x = (inNext.x - v_next_y / v_next_len);
                const ptNextShift_y = (inNext.y + v_next_x / v_next_len);

                // scaling factor for v_prev to intersection point
                const sf = ((ptNextShift_x - ptPrevShift_x) * v_next_y - (ptNextShift_y - ptPrevShift_y) * v_next_x) / (v_prev_x * v_next_y - v_prev_y * v_next_x);

                // vector from inPt to intersection point
                v_trans_x = (ptPrevShift_x + v_prev_x * sf - inPt.x);
                v_trans_y = (ptPrevShift_y + v_prev_y * sf - inPt.y);

                // Don't normalize!, otherwise sharp corners become ugly
                //  but prevent crazy spikes
                const v_trans_lensq = (v_trans_x * v_trans_x + v_trans_y * v_trans_y);
                if (v_trans_lensq <= 2) {
                    return new Vector2(v_trans_x, v_trans_y);
                } else {
                    shrink_by = Math.sqrt(v_trans_lensq / 2);
                }
            } else {
                // handle special case of collinear edges
                let direction_eq = false; // assumes: opposite
                if (v_prev_x > Number.EPSILON) {
                    if (v_next_x > Number.EPSILON) {
                        direction_eq = true;
                    }
                } else {
                    if (v_prev_x < - Number.EPSILON) {
                        if (v_next_x < - Number.EPSILON) {
                            direction_eq = true;
                        }
                    } else {
                        if (Math.sign(v_prev_y) === Math.sign(v_next_y)) {
                            direction_eq = true;
                        }
                    }
                }

                if (direction_eq) {
                    v_trans_x = - v_prev_y;
                    v_trans_y = v_prev_x;
                    shrink_by = Math.sqrt(v_prev_lensq);
                } else {
                    v_trans_x = v_prev_x;
                    v_trans_y = v_prev_y;
                    shrink_by = Math.sqrt(v_prev_lensq / 2);
                }
            }
            return new Vector2(v_trans_x / shrink_by, v_trans_y / shrink_by);
        }

        const contourMovements = [];
        for (i = 0, il = contour.length, j = il - 1, k = i + 1; i < il; i++ , j++ , k++) {
            if (j === il) {
                j = 0;
            }
            if (k === il) {
                k = 0;
            }
            contourMovements[i] = getBevelVec(contour[i], contour[j], contour[k]);
        }

        const holesMovements = [];
        let oneHoleMovements;
        let verticesMovements = contourMovements.concat();
        for (h = 0, hl = holes.length; h < hl; h++) {
            ahole = holes[h];
            oneHoleMovements = [];
            for (i = 0, il = ahole.length, j = il - 1, k = i + 1; i < il; i++ , j++ , k++) {
                if (j === il) {
                    j = 0;
                }
                if (k === il) {
                    k = 0;
                }
                //  (j)---(i)---(k)
                oneHoleMovements[i] = getBevelVec(ahole[i], ahole[j], ahole[k]);
            }
            holesMovements.push(oneHoleMovements);
            verticesMovements = verticesMovements.concat(oneHoleMovements);
        }

        // Loop bevelSegments, 1 for the front, 1 for the back
        for (b = 0; b < bevelSegments; b++) {
            t = b / bevelSegments;
            z = bevelThickness * Math.cos(t * Math.PI / 2);
            bs = bevelSize * Math.sin(t * Math.PI / 2);

            // contract shape
            for (i = 0, il = contour.length; i < il; i++) {
                vert = scalePt2(contour[i], contourMovements[i], bs);
                v(vert.x, vert.y, - z);
            }

            // expand holes
            for (h = 0, hl = holes.length; h < hl; h++) {
                ahole = holes[h];
                oneHoleMovements = holesMovements[h];
                for (i = 0, il = ahole.length; i < il; i++) {
                    vert = scalePt2(ahole[i], oneHoleMovements[i], bs);
                    v(vert.x, vert.y, - z);
                }
            }
        }

        bs = bevelSize;
        // Back facing vertices
        for (i = 0; i < vlen; i++) {
            vert = bevelEnabled ? scalePt2(vertices[i], verticesMovements[i], bs) : vertices[i];
            if (!extrudeByPath) {
                v(vert.x, vert.y, 0);
            } else {
                // v( vert.x, vert.y + extrudePts[ 0 ].y, extrudePts[ 0 ].x );
                normal!.copy(splineTube.normals[0]).multiplyScalar(vert.x);
                biNormal!.copy(splineTube.biNormals[0]).multiplyScalar(vert.y);
                position2!.copy(extrudePts![0]).add(normal!).add(biNormal!);
                v(position2!.x, position2!.y, position2!.z);
            }
        }

        // Add stepped vertices. Including front facing vertices
        for (s = 1; s <= steps; s++) {
            for (i = 0; i < vlen; i++) {
                vert = bevelEnabled ? scalePt2(vertices[i], verticesMovements[i], bs) : vertices[i];
                if (!extrudeByPath) {
                    v(vert.x, vert.y, depth / steps * s);
                } else {
                    // v( vert.x, vert.y + extrudePts[ s - 1 ].y, extrudePts[ s - 1 ].x );
                    normal!.copy(splineTube.normals[s]).multiplyScalar(vert.x);
                    biNormal!.copy(splineTube.biNormals[s]).multiplyScalar(vert.y);
                    position2!.copy(extrudePts![s]).add(normal!).add(biNormal!);
                    v(position2!.x, position2!.y, position2!.z);
                }
            }
        }

        // Add bevel segments planes
        for (b = bevelSegments - 1; b >= 0; b--) {
            t = b / bevelSegments;
            z = bevelThickness * Math.cos(t * Math.PI / 2);
            bs = bevelSize * Math.sin(t * Math.PI / 2);

            // contract shape
            for (i = 0, il = contour.length; i < il; i++) {
                vert = scalePt2(contour[i], contourMovements[i], bs);
                v(vert.x, vert.y, depth + z);
            }

            // expand holes
            for (h = 0, hl = holes.length; h < hl; h++) {
                ahole = holes[h];
                oneHoleMovements = holesMovements[h];
                for (i = 0, il = ahole.length; i < il; i++) {
                    vert = scalePt2(ahole[i], oneHoleMovements[i], bs);
                    if (!extrudeByPath) {
                        v(vert.x, vert.y, depth + z);
                    } else {
                        v(vert.x, vert.y + extrudePts![steps - 1].y, extrudePts![steps - 1].x + z);
                    }
                }
            }
        }

        /* Faces */
        // Top and bottom faces
        buildLidFaces();
        // Sides faces
        buildSideFaces();
        // Internal functions
        function buildLidFaces() {
            const start = verticesArray.length / 3;
            if (bevelEnabled) {
                let layer = 0; // steps + 1
                let offset = vlen * layer;
                // Bottom faces
                for (i = 0; i < flen; i++) {
                    face = faces[i];
                    f3(face[2] + offset, face[1] + offset, face[0] + offset);
                }
                layer = steps + bevelSegments * 2;
                offset = vlen * layer;
                // Top faces
                for (i = 0; i < flen; i++) {
                    face = faces[i];
                    f3(face[0] + offset, face[1] + offset, face[2] + offset);
                }
            } else {
                // Bottom faces
                for (i = 0; i < flen; i++) {
                    face = faces[i];
                    f3(face[2], face[1], face[0]);
                }
                // Top faces
                for (i = 0; i < flen; i++) {
                    face = faces[i];
                    f3(face[0] + vlen * steps, face[1] + vlen * steps, face[2] + vlen * steps);
                }
            }
            scope.addGroup(start, verticesArray.length / 3 - start, 0);
        }

        // Create faces for the z-sides of the shape
        function buildSideFaces() {
            const start = verticesArray.length / 3;
            let layerOffset = 0;
            sidewalls(contour, layerOffset);
            layerOffset += contour.length;

            for (h = 0, hl = holes.length; h < hl; h++) {
                ahole = holes[h];
                sidewalls(ahole, layerOffset);
                layerOffset += ahole.length;
            }
            scope.addGroup(start, verticesArray.length / 3 - start, 1);
        }

        function sidewalls(_contour: Vector2[], layerOffset: number) {
            i = _contour.length;
            while (--i >= 0) {
                j = i;
                k = i - 1;
                if (k < 0) {
                    k = _contour.length - 1;
                }
                const sl = steps + bevelSegments * 2;
                for (s = 0; s < sl; s++) {
                    const slen1 = vlen * s;
                    const slen2 = vlen * (s + 1);
                    const _a = layerOffset + j + slen1;
                    const _b = layerOffset + k + slen1;
                    const _c = layerOffset + k + slen2;
                    const _d = layerOffset + j + slen2;
                    f4(_a, _b, _c, _d);
                }
            }
        }

        function v(_x: number, _y: number, _z: number) {
            placeholder.push(_x);
            placeholder.push(_y);
            placeholder.push(_z);
        }

        function f3(_a: number, _b: number, _c: number) {
            addVertex(_a);
            addVertex(_b);
            addVertex(_c);

            const nextIndex = verticesArray.length / 3;
            const uvs = uvgen.generateTopUV(scope as any, verticesArray, nextIndex - 3, nextIndex - 2, nextIndex - 1);

            addUV(uvs[0]);
            addUV(uvs[1]);
            addUV(uvs[2]);
        }

        function f4(_a: number, _b: number, _c: number, _d: number) {
            addVertex(_a);
            addVertex(_b);
            addVertex(_d);
            addVertex(_b);
            addVertex(_c);
            addVertex(_d);

            const nextIndex = verticesArray.length / 3;
            const uvs = uvgen.generateSideWallUV(scope as any, verticesArray, nextIndex - 6, nextIndex - 3, nextIndex - 2, nextIndex - 1);
            addUV(uvs[0]);
            addUV(uvs[1]);
            addUV(uvs[3]);
            addUV(uvs[1]);
            addUV(uvs[2]);
            addUV(uvs[3]);
        }

        function addVertex(index: number) {
            verticesArray.push(placeholder[index * 3 + 0]);
            verticesArray.push(placeholder[index * 3 + 1]);
            verticesArray.push(placeholder[index * 3 + 2]);
        }

        function addUV(vector2: Vector2) {
            uvArray.push(vector2.x);
            uvArray.push(vector2.y);
        }
    }
}
