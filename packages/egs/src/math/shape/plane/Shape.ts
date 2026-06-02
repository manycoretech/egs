import { Vector2 } from '../../Vector2';
import { Deserializer, Serializer } from '../../../utils/Serialization';
import { Path } from './Path';
/**
 * Defines a 2d shape plane which uses paths.
 */
export class Shape extends Path {
    /**
     * Make a 2d shaped hole on this shaped plane.
     */
    holes: Path[];
    protected _isInvalid = false;

    constructor(points?: Vector2[]) {
        super(points);
        this.type = 'Shape';
        this.holes = [];
    }

    invalidate() {
        this._isInvalid = true;
    }
    /**
     * @internal
     */
    serialize(ctx: Serializer) {
        super.serialize(ctx);
        ctx.puts<Shape>(['holes']);
    }
    /**
     * @internal
     */
    deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        ctx.reads<Shape>(['holes']);
    }

    className(): string {
        return 'Shape';
    }
    /**
     * Make a 2d shaped hole on this shaped plane.
     */
    getPoints(divisions?: number): Vector2[] {
        if (this._isInvalid) {
            this.curves = [];
            this.draw();
            this._isInvalid = false;
        }
        const points = super.getPoints(divisions);
        return points;
    }

    draw() {
    }
    /**
     * Get points of holes (key points based on segments parameter).
     */
    getPointsHoles(divisions?: number): Vector2[][] {
        const holesPts: Vector2[][] = [];
        for (let i = 0, l = this.holes.length; i < l; i++) {
            holesPts[i] = this.holes[i].getPoints(divisions);
        }
        return holesPts;
    }
    /**
     * Get points of shape and holes (key points based on segments parameter).
     */
    extractPoints(divisions?: number) {
        return {
            shape: this.getPoints(divisions),
            holes: this.getPointsHoles(divisions)
        };
    }
    /**
     * Return an object with two arrays store the points and holes.
     */
    extractArray(divisions?: number) {
        const result = this.extractPoints(divisions);
        //
        const points = result.shape.reduce((pv: number[], cv) => { pv.push(cv.x, cv.y); return pv; }, []);
        const holes = result.holes.reduce((pv: number[][], cv) => {
            const arr = cv.reduce((pv1: number[], cv1) => {
                pv1.push(cv1.x, cv1.y); return pv1;
            }, []); pv.push(arr); return pv;
        }, []);

        return { points, holes };
    }

    copy(source: Shape) {
        super.copy(source);
        this.holes = [];
        for (let i = 0, l = source.holes.length; i < l; i++) {
            const hole = source.holes[i];
            this.holes.push(hole.clone());
        }
        return this;
    }

    toJSON() {
        const data = super.toJSON();
        data.uuid = this.uuid;
        data.holes = [];

        for (let i = 0, l = this.holes.length; i < l; i++) {
            const hole = this.holes[i];
            data.holes.push(hole.toJSON());
        }
        return data;
    }

    fromJSON(json: any) {
        super.fromJSON(json);
        this.uuid = json.uuid;
        this.holes = [];
        for (let i = 0, l = json.holes.length; i < l; i++) {
            const hole = json.holes[i];
            this.holes.push(new Path().fromJSON(hole));
        }
        return this;
    }

    static area(contour: Vector2[]): number {
        const n = contour.length;
        let a = 0.0;
        for (let p = n - 1, q = 0; q < n; p = q++) {
            a += contour[p].x * contour[q].y - contour[q].x * contour[p].y;
        }
        return a * 0.5;
    }

    static isClockWise(pts: Vector2[]): boolean {
        return Shape.area(pts) < 0;
    }
    /**
     * Triangulate the shape into faces.
     */
    static triangulateShape(contour: Vector2[], holes: Vector2[][], dim = 2) {
        const vertices: number[] = []; // flat array of vertices like [ x0,y0, x1,y1, x2,y2, ... ]
        const holeIndices: number[] = []; // array of hole indices
        const faces: number[][] = []; // final array of vertex indices like [ [ a,b,d ], [ b,c,d ] ]

        removeDupEndPts(contour);
        addContour(vertices, contour);

        let holeIndex = contour.length;
        holes.forEach(removeDupEndPts);
        for (let i = 0; i < holes.length; i++) {
            holeIndices.push(holeIndex);
            holeIndex += holes[i].length;
            addContour(vertices, holes[i]);
        }

        const triangles = triangulate(vertices, holeIndices, dim);

        for (let i = 0; i < triangles.length; i += 3) {
            faces.push(triangles.slice(i, i + 3));
        }
        return faces;
    }
}

////////////////////////////////////////////////////////
// helper inner functions to triangulate the curve
function removeDupEndPts(points: Vector2[]) {
    const l = points.length;
    if (l > 2 && points[l - 1].equals(points[0])) {
        points.pop();
    }
}

function addContour(_vertices: number[], _contour: Vector2[]): void {
    for (let i = 0; i < _contour.length; i++) {
        _vertices.push(_contour[i].x);
        _vertices.push(_contour[i].y);
    }
}

class Node {
    i: number;
    x: number; // vertex coordinates
    y: number;
    prev: Node; // previous and next vertice nodes in a polygon ring
    next: Node;
    z: number; // z-order curve value
    prevZ: Node; // previous and next nodes in z-order
    nextZ: Node;
    steiner: boolean; // indicates whether this is a steiner point

    constructor(i: number, x: number, y: number) {
        this.i = i;
        this.x = x;
        this.y = y;
        this.prev = null!;
        this.next = null!;
        this.z = null!;
        this.prevZ = null!;
        this.nextZ = null!;
        this.steiner = false;
    }
}

// create a node and optionally link it with previous one (in a circular doubly linked list)
function insertNode(i: number, x: number, y: number, last?: Node): Node {
    const p = new Node(i, x, y);

    if (!last) {
        p.prev = p;
        p.next = p;
    } else {
        p.next = last.next;
        p.prev = last;
        last.next.prev = p;
        last.next = p;
    }
    return p;
}

function removeNode(p: Node): void {
    p.next.prev = p.prev;
    p.prev.next = p.next;
    if (p.prevZ) {
        p.prevZ.nextZ = p.nextZ;
    }
    if (p.nextZ) {
        p.nextZ.prevZ = p.prevZ;
    }
}

function signedArea(data: number[], start: number, end: number, dim: number): number {
    let sum = 0;
    for (let i = start, j = end - dim; i < end; i += dim) {
        sum += (data[j] - data[i]) * (data[i + 1] + data[j + 1]);
        j = i;
    }
    return sum;
}

// check if two points are equal
function equals(p1: Node, p2: Node): boolean {
    return p1.x === p2.x && p1.y === p2.y;
}

// create a circular doubly linked list from polygon points in the specified winding order
function linkedList(data: number[], start: number, end: number, dim: number, clockwise: boolean): Node {
    let i: number;
    let last: Node | undefined;
    if (clockwise === (signedArea(data, start, end, dim) > 0)) {
        for (i = start; i < end; i += dim) {
            last = insertNode(i, data[i], data[i + 1], last);
        }
    } else {
        for (i = end - dim; i >= start; i -= dim) {
            last = insertNode(i, data[i], data[i + 1], last);
        }
    }
    if (last && equals(last, last.next)) {
        removeNode(last);
        last = last.next;
    }
    return last!;
}

// find the leftmost node of a polygon ring
function getLeftmost(start: Node): Node {
    let p = start;
    let leftmost = start;

    do {
        if (p.x < leftmost.x) {
            leftmost = p;
        }
        p = p.next;
    } while (p !== start);
    return leftmost;
}

// check if a point lies within a convex triangle
function pointInTriangle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, px: number, py: number): boolean {
    return (cx - px) * (ay - py) - (ax - px) * (cy - py) >= 0 &&
        (ax - px) * (by - py) - (bx - px) * (ay - py) >= 0 &&
        (bx - px) * (cy - py) - (cx - px) * (by - py) >= 0;
}

// signed area of a triangle
function area(p: Node, q: Node, r: Node): number {
    return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
}

// check if a polygon diagonal is locally inside the polygon
function locallyInside(a: Node, b: Node) {
    return area(a.prev, a, a.next) < 0 ?
        area(a, b, a.next) >= 0 && area(a, a.prev, b) >= 0 :
        area(a, b, a.prev) < 0 || area(a, a.next, b) < 0;
}

// David Eberly's algorithm for finding a bridge between hole and outer polygon
function findHoleBridge(hole: Node, outerNode: Node): Node | null {
    let p = outerNode;
    const hx = hole.x;
    const hy = hole.y;
    let qx = -Infinity;
    let m: Node | undefined;

    // find a segment intersected by a ray from the hole's leftmost point to the left;
    // segment's endpoint with lesser x will be potential connection point
    do {
        if (hy <= p.y && hy >= p.next.y && p.next.y !== p.y) {
            const x = p.x + (hy - p.y) * (p.next.x - p.x) / (p.next.y - p.y);
            if (x <= hx && x > qx) {
                qx = x;
                if (x === hx) {
                    if (hy === p.y) {
                        return p;
                    }
                    if (hy === p.next.y) {
                        return p.next;
                    }
                }
                m = p.x < p.next.x ? p : p.next;
            }
        }
        p = p.next;
    } while (p !== outerNode);
    if (!m) {
        return null;
    }
    if (hx === qx) {
        return m.prev; // hole touches outer segment; pick lower endpoint
    }
    // look for points inside the triangle of hole point, segment intersection and endpoint;
    // if there are no points found, we have a valid connection;
    // otherwise choose the point of the minimum angle with the ray as connection point
    const stop = m;
    const mx = m.x;
    const my = m.y;
    let tanMin = Infinity;
    let tan;
    p = m.next;
    while (p !== stop) {
        if (hx >= p.x && p.x >= mx && hx !== p.x &&
            pointInTriangle(hy < my ? hx : qx, hy, mx, my, hy < my ? qx : hx, hy, p.x, p.y)) {
            tan = Math.abs(hy - p.y) / (hx - p.x); // tangential
            if ((tan < tanMin || (tan === tanMin && p.x > m.x)) && locallyInside(p, hole)) {
                m = p;
                tanMin = tan;
            }
        }
        p = p.next;
    }
    return m;
}

// link two polygon vertices with a bridge; if the vertices belong to the same ring, it splits polygon into two;
// if one belongs to the outer ring and another to a hole, it merges it into a single ring
function splitPolygon(a: Node, b: Node): Node {
    const a2 = new Node(a.i, a.x, a.y);
    const b2 = new Node(b.i, b.x, b.y);
    const an = a.next;
    const bp = b.prev;

    a.next = b;
    b.prev = a;

    a2.next = an;
    an.prev = a2;

    b2.next = a2;
    a2.prev = b2;

    bp.next = b2;
    b2.prev = bp;

    return b2;
}

// eliminate colinear or duplicate points
function filterPoints(start: Node, end?: Node): Node {
    if (!start) {
        return start;
    }
    if (!end) {
        end = start;
    }
    let p = start;
    let again;
    do {
        again = false;
        if (!p.steiner && (equals(p, p.next) || area(p.prev, p, p.next) === 0)) {
            removeNode(p);
            p = end = p.prev;
            if (p === p.next) {
                break;
            }
            again = true;
        } else {
            p = p.next;
        }
    } while (again || p !== end);
    return end;
}

// find a bridge between vertices that connects hole with an outer ring and and link it
function eliminateHole(hole: Node, outerNode: Node) {
    const n = findHoleBridge(hole, outerNode);
    if (n) {
        const b = splitPolygon(n, hole);
        filterPoints(b, b.next);
    }
}

function compareX(a: Node, b: Node): number {
    return a.x - b.x;
}

// link every hole into the outer loop, producing a single-ring polygon without holes
function eliminateHoles(data: number[], holeIndices: number[], outerNode: Node, dim: number): Node {
    const queue = [];
    let i, len, start, end, list;

    for (i = 0, len = holeIndices.length; i < len; i++) {
        start = holeIndices[i] * dim;
        end = i < len - 1 ? holeIndices[i + 1] * dim : data.length;
        list = linkedList(data, start, end, dim, false);
        if (list === list.next) {
            list.steiner = true;
        }
        queue.push(getLeftmost(list));
    }
    queue.sort(compareX);

    // process holes from left to right
    for (i = 0; i < queue.length; i++) {
        eliminateHole(queue[i], outerNode);
        outerNode = filterPoints(outerNode, outerNode.next);
    }
    return outerNode;
}

// z-order of a point given coords and inverse of the longer side of data bbox
function zOrder(x: number, y: number, minX: number, minY: number, invSize: number): number {
    // coords are transformed into non-negative 15-bit integer range
    x = 32767 * (x - minX) * invSize;
    y = 32767 * (y - minY) * invSize;

    x = (x | (x << 8)) & 0x00FF00FF;
    x = (x | (x << 4)) & 0x0F0F0F0F;
    x = (x | (x << 2)) & 0x33333333;
    x = (x | (x << 1)) & 0x55555555;

    y = (y | (y << 8)) & 0x00FF00FF;
    y = (y | (y << 4)) & 0x0F0F0F0F;
    y = (y | (y << 2)) & 0x33333333;
    y = (y | (y << 1)) & 0x55555555;
    return x | (y << 1);
}

// Simon Tatham's linked list merge sort algorithm
// http://www.chiark.greenend.org.uk/~sgtatham/algorithms/listsort.html
function sortLinked(list: Node): Node {
    let i, p, q, e, tail, numMerges, pSize, qSize, inSize = 1;

    do {
        p = list;
        list = null!;
        tail = null;
        numMerges = 0;
        while (p) {
            numMerges++;
            q = p;
            pSize = 0;
            for (i = 0; i < inSize; i++) {
                pSize++;
                q = q.nextZ;
                if (!q) {
                    break;
                }
            }
            qSize = inSize;
            while (pSize > 0 || (qSize > 0 && q)) {
                if (pSize !== 0 && (qSize === 0 || !q || p.z <= q.z)) {
                    e = p;
                    p = p.nextZ;
                    pSize--;
                } else {
                    e = q;
                    q = q.nextZ;
                    qSize--;
                }
                if (tail) {
                    tail.nextZ = e;
                } else {
                    list = e;
                }
                e.prevZ = tail!;
                tail = e;
            }
            p = q;
        }
        tail!.nextZ = null!;
        inSize *= 2;
    } while (numMerges > 1);
    return list;
}

// interlink polygon nodes in z-order
function indexCurve(start: Node, minX: number, minY: number, invSize: number): void {
    let p = start;
    do {
        if (p.z === null) {
            p.z = zOrder(p.x, p.y, minX, minY, invSize);
        }
        p.prevZ = p.prev;
        p.nextZ = p.next;
        p = p.next;

    } while (p !== start);
    p.prevZ.nextZ = null!;
    p.prevZ = null!;
    sortLinked(p);
}

function isEarHashed(ear: Node, minX: number, minY: number, invSize: number): boolean {
    const a = ear.prev;
    const b = ear;
    const c = ear.next;

    if (area(a, b, c) >= 0) {
        return false; // reflex, can't be an ear
    }

    // triangle bbox; min & max are calculated like this for speed
    const minTX = a.x < b.x ? (a.x < c.x ? a.x : c.x) : (b.x < c.x ? b.x : c.x);
    const minTY = a.y < b.y ? (a.y < c.y ? a.y : c.y) : (b.y < c.y ? b.y : c.y);
    const maxTX = a.x > b.x ? (a.x > c.x ? a.x : c.x) : (b.x > c.x ? b.x : c.x);
    const maxTY = a.y > b.y ? (a.y > c.y ? a.y : c.y) : (b.y > c.y ? b.y : c.y);

    // z-order range for the current triangle bbox;
    const minZ = zOrder(minTX, minTY, minX, minY, invSize);
    const maxZ = zOrder(maxTX, maxTY, minX, minY, invSize);

    // first look for points inside the triangle in increasing z-order
    let p = ear.nextZ;
    while (p && p.z <= maxZ) {
        if (p !== ear.prev && p !== ear.next && pointInTriangle(a.x, a.y, b.x, b.y, c.x, c.y, p.x, p.y) && area(p.prev, p, p.next) >= 0) {
            return false;
        }
        p = p.nextZ;
    }
    // then look for points in decreasing z-order
    p = ear.prevZ;
    while (p && p.z >= minZ) {
        if (p !== ear.prev && p !== ear.next && pointInTriangle(a.x, a.y, b.x, b.y, c.x, c.y, p.x, p.y) && area(p.prev, p, p.next) >= 0) {
            return false;
        }
        p = p.prevZ;
    }
    return true;
}

// check whether a polygon node forms a valid ear with adjacent nodes
function isEar(ear: Node): boolean {
    const a = ear.prev;
    const b = ear;
    const c = ear.next;

    if (area(a, b, c) >= 0) {
        return false; // reflex, can't be an ear
    }

    // now make sure we don't have other points inside the potential ear
    let p = ear.next.next;
    while (p !== ear.prev) {
        if (pointInTriangle(a.x, a.y, b.x, b.y, c.x, c.y, p.x, p.y) && area(p.prev, p, p.next) >= 0) {
            return false;
        }
        p = p.next;
    }
    return true;
}

// check if two segments intersect
function intersects(p1: Node, q1: Node, p2: Node, q2: Node): boolean {
    if ((equals(p1, q1) && equals(p2, q2)) || (equals(p1, q2) && equals(p2, q1))) {
        return true;
    }
    return area(p1, q1, p2) > 0 !== area(p1, q1, q2) > 0 && area(p2, q2, p1) > 0 !== area(p2, q2, q1) > 0;
}

// go through all polygon nodes and cure small local self-intersections
function cureLocalIntersections(start: Node, triangles: number[], dim: number): Node {
    let p = start;
    do {
        const a = p.prev;
        const b = p.next.next;
        if (!equals(a, b) && intersects(a, p, p.next, b) && locallyInside(a, b) && locallyInside(b, a)) {
            triangles.push(a.i / dim);
            triangles.push(p.i / dim);
            triangles.push(b.i / dim);

            // remove two nodes involved
            removeNode(p);
            removeNode(p.next);
            p = start = b;
        }
        p = p.next;
    } while (p !== start);
    return p;
}

// check if a polygon diagonal intersects any polygon segments
function intersectsPolygon(a: Node, b: Node): boolean {
    let p = a;
    do {
        if (p.i !== a.i && p.next.i !== a.i && p.i !== b.i && p.next.i !== b.i &&
            intersects(p, p.next, a, b)) {
            return true;
        }
        p = p.next;
    } while (p !== a);
    return false;
}

// check if the middle point of a polygon diagonal is inside the polygon
function middleInside(a: Node, b: Node): boolean {
    let p = a;
    let inside = false;
    const px = (a.x + b.x) / 2;
    const py = (a.y + b.y) / 2;

    do {
        if (((p.y > py) !== (p.next.y > py)) && p.next.y !== p.y && (px < (p.next.x - p.x) * (py - p.y) / (p.next.y - p.y) + p.x)) {
            inside = !inside;
        }
        p = p.next;
    } while (p !== a);
    return inside;
}

// check if a diagonal between two polygon nodes is valid (lies in polygon interior)
function isValidDiagonal(a: Node, b: Node): boolean {
    return a.next.i !== b.i && a.prev.i !== b.i && !intersectsPolygon(a, b) && locallyInside(a, b) && locallyInside(b, a) && middleInside(a, b);
}

// try splitting polygon into two and triangulate them independently
function splitEarcut(start: Node, triangles: number[], dim: number, minX: number, minY: number, invSize: number): void {
    // look for a valid diagonal that divides the polygon into two
    let a = start;
    do {
        let b = a.next.next;
        while (b !== a.prev) {
            if (a.i !== b.i && isValidDiagonal(a, b)) {
                // split the polygon in two by the diagonal
                let c = splitPolygon(a, b);
                // filter colinear points around the cuts
                a = filterPoints(a, a.next);
                c = filterPoints(c, c.next);
                // run earcut on each half
                earcutLinked(a, triangles, dim, minX, minY, invSize);
                earcutLinked(c, triangles, dim, minX, minY, invSize);
                return;
            }
            b = b.next;
        }
        a = a.next;
    } while (a !== start);
}

// main ear slicing loop which triangulates a polygon (given as a linked list)
function earcutLinked(ear: Node, triangles: number[], dim: number, minX: number, minY: number, invSize: number, pass?: number): void {
    if (!ear) {
        return;
    }

    // interlink polygon nodes in z-order
    if (!pass && invSize) {
        indexCurve(ear, minX, minY, invSize);
    }
    let stop = ear;
    let prev;
    let next;
    // iterate through ears, slicing them one by one
    while (ear.prev !== ear.next) {
        prev = ear.prev;
        next = ear.next;
        if (invSize ? isEarHashed(ear, minX, minY, invSize) : isEar(ear)) {
            // cut off the triangle
            triangles.push(prev.i / dim);
            triangles.push(ear.i / dim);
            triangles.push(next.i / dim);
            removeNode(ear);
            // skipping the next vertice leads to less sliver triangles
            ear = next.next;
            stop = next.next;
            continue;
        }

        ear = next;
        // if we looped through the whole remaining polygon and can't find any more ears
        if (ear === stop) {
            // try filtering points and slicing again
            if (!pass) {
                earcutLinked(filterPoints(ear), triangles, dim, minX, minY, invSize, 1);
                // if this didn't work, try curing all small self-intersections locally
            } else if (pass === 1) {
                ear = cureLocalIntersections(ear, triangles, dim);
                earcutLinked(ear, triangles, dim, minX, minY, invSize, 2);
                // as a last resort, try splitting the remaining polygon into two
            } else if (pass === 2) {
                splitEarcut(ear, triangles, dim, minX, minY, invSize);
            }
            break;
        }
    }
}

function triangulate(data: number[], holeIndices: number[], dim = 2) {

    const hasHoles = holeIndices && holeIndices.length;
    const outerLen = hasHoles ? holeIndices[0] * dim : data.length;
    let outerNode = linkedList(data, 0, outerLen, dim, true);
    const triangles: number[] = [];

    if (!outerNode) {
        return triangles;
    }

    let minX: number, minY: number, maxX, maxY, x, y, invSize: number;

    if (hasHoles) {
        outerNode = eliminateHoles(data, holeIndices, outerNode, dim);
    }

    // if the shape is not too simple, we'll use z-order curve hash later; calculate polygon bbox
    if (data.length > 80 * dim) {
        minX = maxX = data[0];
        minY = maxY = data[1];

        for (let i = dim; i < outerLen; i += dim) {
            x = data[i];
            y = data[i + 1];
            if (x < minX) {
                minX = x;
            }
            if (y < minY) {
                minY = y;
            }
            if (x > maxX) {
                maxX = x;
            }
            if (y > maxY) {
                maxY = y;
            }
        }
        // minX, minY and invSize are later used to transform coords into integers for z-order calculation
        invSize = Math.max(maxX - minX, maxY - minY);
        invSize = invSize !== 0 ? 1 / invSize : 0;
    }
    earcutLinked(outerNode, triangles, dim, minX!, minY!, invSize!);
    return triangles;
}
