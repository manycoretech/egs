import { Color } from '../../Color.js';
import { Vector2 } from '../../Vector2.js';
import { Path } from './Path.js';
import { Shape } from './Shape.js';
import type { SerializerableDelegatedAsReference, Serializer, Deserializer } from '../../../utils/Serialization.js';
import { _Math } from '../../Math.js';
import type { Box2 } from '../../../math/Box2.js';
import { logger } from '../../../utils/Logger.js';

/**
 * This class is used to draw a text in the scene.
 */
export class FontPath implements SerializerableDelegatedAsReference {
    private _uuid: string | null = null;
    getUUID(): string {
        if (this._uuid === null) {
            this._uuid = _Math.generateUUID();
        }
        return this._uuid;
    }

    className(): string {
        return 'FontPath';
    }
    subPaths: Path[];
    currentPath: Path;
    color: Color;

    constructor() {
        this.color = new Color();
        this.subPaths = [];
        this.currentPath = new Path();
    }

    moveTo(x: number, y: number): void {
        this.currentPath = new Path();
        this.subPaths.push(this.currentPath);
        this.currentPath.moveTo(x, y);
    }

    lineTo(x: number, y: number): void {
        this.currentPath.lineTo(x, y);
    }

    quadraticCurveTo(aCPx: number, aCPy: number, aX: number, aY: number): void {
        this.currentPath.quadraticCurveTo(aCPx, aCPy, aX, aY);
    }

    bezierCurveTo(aCP1x: number, aCP1y: number, aCP2x: number, aCP2y: number, aX: number, aY: number): void {
        this.currentPath.bezierCurveTo(aCP1x, aCP1y, aCP2x, aCP2y, aX, aY);
    }

    splineThru(pts: Vector2[]): void {
        this.currentPath.splineThru(pts);
    }

    closePath() {
        this.currentPath.closePath();
    }

    toShapes(noHoles?: boolean): Shape[] {
        function toShapesNoHoles(inSubPaths: Path[]): Shape[] {
            const _shapes = [];
            for (let i = 0, l = inSubPaths.length; i < l; i++) {
                const _tmpPath = inSubPaths[i];
                const _tmpShape = new Shape();
                _tmpShape.curves = _tmpPath.curves;
                _shapes.push(_tmpShape);
            }
            return _shapes;
        }

        const isClockWise = Shape.isClockWise;
        const subPaths = this.subPaths;
        if (subPaths.length === 0) {
            return [];
        }
        if (noHoles) {
            return toShapesNoHoles(subPaths);
        }

        interface PathInfo {
            p: Path;
            b: Box2;
            boxArea: number;
            cw: boolean;
            s: Shape;
        }
        const paths: PathInfo[] = [];
        const tempVec = new Vector2();

        subPaths.forEach(path => {
            // TODO: find a cheaper way to get bounds and orientation.
            const cw = isClockWise(path.getPoints());
            // Use area of Bounding Box instead of Path, just it is cheaper to get.
            const box = path.getBounds();
            box.getSize(tempVec);
            const boxArea = tempVec.x * tempVec.y;
            paths.push({
                p: path,
                b: box,
                boxArea,
                cw,
                s: null!,
            });
        });

        const result: Shape[] = [];
        // It is unknown which orientation is frame, but the biggest path must be frame
        // If frame's orientation is explicit, the sort can be saved.
        paths.sort((pv, cv) => {
            return cv.boxArea - pv.boxArea;
        });
        const FrameOrientation = paths[0].cw;

        for (let i = 0; i < paths.length; i++) {
            const path = paths[i];
            if (path.cw === FrameOrientation) {
                // If a path orientation is frame, build it as shape
                const shape = new Shape();
                shape.curves = path.p.curves;
                result.push(shape);
                path.s = shape;
            } else {
                // If a path orientation is reversed, find a smallest but bigger than it as its frame.
                for (let j = i - 1; j >= 0; j--) {
                    const tempPath = paths[j];
                    if (tempPath.b.containsBox(path.b) && tempPath.s) {
                        tempPath.s.holes.push(path.p);
                        break;
                    }
                }
            }
        }

        return result;
    }

    serialize(ctx: Serializer<any>): void {
        ctx.puts<FontPath>(['subPaths', 'currentPath', 'color']);
    }
    deserialize(ctx: Deserializer): void {
        ctx.reads<FontPath>(['subPaths', 'currentPath', 'color']);
    }
}

function createPath(char: string, scale: number, offsetX: number, offsetY: number, data: OpentypeFont) {
    const glyph = data.charToGlyph(char);
    if (!glyph) {
        logger.error(
            'EGS.Font: character "' +
                char +
                '" does not exists in font family ' +
                JSON.stringify(data.names.fontFamily) +
                '.',
        );
        return;
    }
    const path = new FontPath();
    let x: number, y: number, cpx: number, cpy: number, cpx1: number, cpy1: number, cpx2: number, cpy2: number;
    if (glyph.path) {
        let path0 = glyph.path;
        if (typeof path0 === 'function') {
            path0 = path0();
        }
        const commands = path0.commands;

        for (let i = 0, l = commands.length; i < l;) {
            const command = commands[i++];
            switch (command.type) {
                case 'M': // moveTo
                    x = command.x * scale + offsetX;
                    y = command.y * scale + offsetY;
                    path.moveTo(x, y);
                    break;
                case 'L': // lineTo
                    x = command.x * scale + offsetX;
                    y = command.y * scale + offsetY;
                    path.lineTo(x, y);
                    break;
                case 'Q': // quadraticCurveTo
                    cpx = command.x * scale + offsetX;
                    cpy = command.y * scale + offsetY;
                    cpx1 = command.x1 * scale + offsetX;
                    cpy1 = command.y1 * scale + offsetY;
                    path.quadraticCurveTo(cpx1, cpy1, cpx, cpy);
                    break;
                case 'C': // bezierCurveTo
                    cpx = command.x * scale + offsetX;
                    cpy = command.y * scale + offsetY;
                    cpx1 = command.x1 * scale + offsetX;
                    cpy1 = command.y1 * scale + offsetY;
                    cpx2 = command.x2 * scale + offsetX;
                    cpy2 = command.y2 * scale + offsetY;
                    path.bezierCurveTo(cpx1, cpy1, cpx2, cpy2, cpx, cpy);
                    break;
                case 'Z':
                    path.closePath();
                    break;
                default:
                    break;
            }
        }
    }
    return { offsetX: glyph.advanceWidth * scale, path };
}

function createPaths(
    text: string,
    size: number,
    lineHeight: number,
    data: OpentypeFont,
    align: 'left' | 'center' | 'right' = 'left',
): FontPath[] {
    const scale = size / data.unitsPerEm;
    const line_height = lineHeight;
    const paths: FontPath[] = [];
    let offsetX = 0;
    let offsetY = 0;

    const lines = text.split('\n');

    const lineWidths: number[] = [];
    let maxLineWidth = 0;
    for (let i = 0, ni = lines.length; i < ni; i++) {
        const lineStr = lines[i];
        if (i > 0) {
            offsetX = 0;
        }
        const chars = Array.from ? Array.from(lineStr) : String(lineStr).split(''); // see #13988
        for (let j = 0, nj = chars.length; j < nj; j++) {
            const char = chars[j];
            if (char.charCodeAt(0) === 9) {
                offsetX += 20;
            } else {
                const glyph = data.charToGlyph(char);
                if (glyph) {
                    offsetX += glyph.advanceWidth * scale;
                }
            }
        }
        lineWidths[i] = offsetX;
        maxLineWidth = Math.max(maxLineWidth, offsetX);
    }

    for (let i = 0, ni = lines.length; i < ni; i++) {
        const lineStr = lines[i];
        offsetX = 0;
        offsetY = -line_height * i;
        if (align === 'center') {
            offsetX = (maxLineWidth - lineWidths[i]) / 2;
        } else if (align === 'right') {
            offsetX = maxLineWidth - lineWidths[i];
        }

        const chars = Array.from ? Array.from(lineStr) : String(lineStr).split(''); // see #13988
        for (let j = 0, nj = chars.length; j < nj; j++) {
            const char = chars[j];
            if (char.charCodeAt(0) === 9) {
                offsetX += 20;
            } else {
                const ret = createPath(char, scale, offsetX, offsetY, data);
                if (ret) {
                    offsetX += ret.offsetX;
                    paths.push(ret.path);
                }
            }
        }
    }
    return paths;
}
/**
 * This class is used to help draw font .
 */
export class Font implements SerializerableDelegatedAsReference {
    private _uuid: string | null = null;
    getUUID(): string {
        if (this._uuid === null) {
            this._uuid = _Math.generateUUID();
        }
        return this._uuid;
    }

    className(): string {
        return 'Font';
    }

    /**
     * 2D contour triangulation
     * @param contours Contour list
     * @returns positions Vertex coordinate list
     */
    static triangulate: (contours: number[][]) => number[];

    private _isCIDFont: boolean = false;
    set isCIDFont(v) {
        this._isCIDFont = v;
    }
    get isCIDFont() {
        return this._isCIDFont;
    }
    /**
     * The geometry data of all font.
     */
    data: OpentypeFont;
    /**
     * Used to check type of this or extended instance.
     * This value should not be changed by user.
     */
    isFont = true;
    private charGeometryCache: {
        [char: string]: {
            path: FontPath;
            width: number;
        };
    } = {};
    unitsPerEm = 256;

    constructor(data?: OpentypeFont) {
        if (data) {
            this.data = data;
            this.unitsPerEm = data.unitsPerEm;
            this.isCIDFont = !!this.data.isCIDFont;
        }
    }

    generateShapes(
        text: string,
        size?: number,
        lineHeight?: number,
        align: 'left' | 'center' | 'right' = 'left',
    ): Shape[] {
        if (size === undefined) {
            size = 100;
        }
        if (lineHeight === undefined) {
            lineHeight = size * 1.25;
        }

        const shapes: Shape[] = [];
        const paths = createPaths(text, size, lineHeight, this.data, align);

        for (let p = 0, pl = paths.length; p < pl; p++) {
            Array.prototype.push.apply(shapes, paths[p].toShapes());
        }

        return shapes;
    }

    serialize(ctx: Serializer<any>): void {
        const tempGeometry: Record<string, any> = {};
        for (const i in this.charGeometryCache) {
            const g = {
                path: this.charGeometryCache[i].path,
                width: this.charGeometryCache[i].width,
            };
            tempGeometry[i] = g;
        }
        ctx.putRaw('CharGeometry', tempGeometry);
        ctx.putRaw('isCIDFont', this.isCIDFont);
        ctx.putRaw('unitsPerEm', this.unitsPerEm);
    }

    deserialize(ctx: Deserializer): void {
        const tempGeometry = ctx.readRaw('CharGeometry');
        for (const i in tempGeometry) {
            const g = {
                path: tempGeometry[i].path as FontPath,
                width: tempGeometry[i].width,
                geometry: {
                    points: [],
                    indices: [],
                },
                geometryOutline: {
                    points: [],
                    indices: [],
                },
            };
            this.charGeometryCache[i] = g;
        }
        this.isCIDFont = ctx.readRaw('isCIDFont');
        this.unitsPerEm = ctx.readRaw('unitsPerEm');
    }
}

interface OpentypeFont {
    names: { fontFamily: any };
    ascender: number;
    descender: number;
    unitsPerEm: number;
    charToGlyph: (char: string) => OpentypeGlyph;
    isCIDFont?: boolean;
}

interface OpentypeGlyph {
    advanceWidth: number;
    path: OpentypePath | (() => OpentypePath);
}

interface OpentypePath {
    commands: PathCommand[];
}

type PathCommand =
    | {
          type: 'M';
          x: number;
          y: number;
      }
    | {
          type: 'L';
          x: number;
          y: number;
      }
    | {
          type: 'C';
          x1: number;
          y1: number;
          x2: number;
          y2: number;
          x: number;
          y: number;
      }
    | {
          type: 'Q';
          x1: number;
          y1: number;
          x: number;
          y: number;
      }
    | {
          type: 'Z';
      };

/**
 * Tests whether a 2D point lies inside a polygon.
 */
export function isPointInsidePolygon(inPt: { x: number; y: number }, inPolygon: Array<{ x: number; y: number }>) {
    const polyLen = inPolygon.length;
    // inPt on polygon contour => immediate success or
    // toggling of inside/outside at every single! intersection point of an edge
    // with the horizontal line through inPt, left of inPt
    // not counting lowerY endpoints of edges and whole edges on that line
    let inside = false;
    for (let p = polyLen - 1, q = 0; q < polyLen; p = q++) {
        let edgeLowPt = inPolygon[p];
        let edgeHighPt = inPolygon[q];
        let edgeDx = edgeHighPt.x - edgeLowPt.x;
        let edgeDy = edgeHighPt.y - edgeLowPt.y;
        if (Math.abs(edgeDy) > Number.EPSILON) {
            // not parallel
            if (edgeDy < 0) {
                edgeLowPt = inPolygon[q];
                edgeDx = -edgeDx;
                edgeHighPt = inPolygon[p];
                edgeDy = -edgeDy;
            }
            if (inPt.y < edgeLowPt.y || inPt.y > edgeHighPt.y) {
                continue;
            }
            if (inPt.y === edgeLowPt.y) {
                if (inPt.x === edgeLowPt.x) {
                    return true;
                }
            } else {
                const perpEdge = edgeDy * (inPt.x - edgeLowPt.x) - edgeDx * (inPt.y - edgeLowPt.y);
                if (perpEdge === 0) {
                    return true; // inPt is on contour ?
                }
                if (perpEdge < 0) {
                    continue;
                }
                inside = !inside; // true intersection left of inPt
            }
        } else {
            // parallel or collinear
            if (inPt.y !== edgeLowPt.y) {
                continue; // parallel
            }
            // edge lies on the same horizontal line as inPt
            if (
                (edgeHighPt.x <= inPt.x && inPt.x <= edgeLowPt.x) ||
                (edgeLowPt.x <= inPt.x && inPt.x <= edgeHighPt.x)
            ) {
                return true; // inPt: Point on contour !
            }
            // continue;
        }
    }
    return inside;
}
