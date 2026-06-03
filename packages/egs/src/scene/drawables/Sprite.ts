
import { Vector3 } from '../../math/Vector3';
import { Vector2 } from '../../math/Vector2';
import { Matrix4 } from '../../math/Matrix4';
import { Drawable } from './Drawable';
import type { Raycaster, Intersection } from '../tools/Raycaster';
import { Triangle } from '../../math/Triangle';
import type { Serializer, Deserializer } from '../../utils/Serialization';
import type { BufferGeometry } from '../../elements/geometries/containers/BufferGeometry';
import type { SpriteMaterial } from '../../elements/materials/mesh/SpriteMaterial';
import { Sphere } from '../../math/Sphere';
import { SpriteBufferGeometry } from '../../elements/geometries/containers/SpriteBufferGeometry';

const intersectPoint = new Vector3();
const worldScale = new Vector3();
const mvPosition = new Vector3();

const alignedPosition = new Vector2();
const rotatedPosition = new Vector2();
const viewWorldMatrix = new Matrix4();
const sphere = new Sphere();

const vA = new Vector3();
const vB = new Vector3();
const vC = new Vector3();

const uvA = new Vector2();
const uvB = new Vector2();
const uvC = new Vector2();

function transformVertex(vertexPosition: Vector2, mvPosition: Vector2, center: Vector2, scale: Vector2, sin?: number, cos?: number) {
    // compute position in camera space
    alignedPosition.subVectors(vertexPosition, center).addScalar(0.5).multiply(scale);

    // to check if rotation is not zero
    if (sin !== undefined) {
        rotatedPosition.x = (cos! * alignedPosition.x) - (sin * alignedPosition.y);
        rotatedPosition.y = (sin * alignedPosition.x) + (cos! * alignedPosition.y);
    } else {
        rotatedPosition.copy(alignedPosition);
    }

    vertexPosition.copy(mvPosition);
    vertexPosition.x += rotatedPosition.x;
    vertexPosition.y += rotatedPosition.y;

    // transform to world space
    vertexPosition.applyMatrix4(viewWorldMatrix);

}
/**
 * A sprite is a plane that always faces towards the camera, generally with a partially transparent texture applied.
 */
export class Sprite extends Drawable<SpriteMaterial, BufferGeometry> {
    /**
     * The sprite's anchor point, and the point around which the sprite rotates.
     * A value of (0.5, 0.5) corresponds to the midpoint of the sprite.
     * A value of (0, 0) corresponds to the lower left corner of the sprite. The default is (0.5, 0.5).
     */
    center: Vector2;// = new Vector2(0.5, 0.5);
    /**
     * The type of this Object3D.
     */
    type: 'Sprite';
    /**
     * Check the type whether it belongs to Sprite.
     * This value should not be changed by user.
     */
    isSprite: true;
    /**
     * The name of instance's class.
     */
    className() {
        return 'Sprite';
    }

    constructor(material: SpriteMaterial) {
        // should be singleton?
        super(new SpriteBufferGeometry(), material);
        this.center = new Vector2(0.5, 0.5);
        this.type = 'Sprite';
        this.isSprite = true;
    }

    /**
     * Get intersections between a casted {@link Ray| ray} and this Sprite.
     * The method {@link Raycaster.intersectObject| intersectObject()} will call this method, but the results are not ordered.
     * @param {Raycaster} raycaster the instance of Raycaster is used to get the data for calculation.
     * @param {Intersection} intersects the result will be stored here.
     */
    raycastJsImpl(raycaster: Raycaster, intersects: Intersection[]) {
        const camera = raycaster._camera;
        if (!camera) {
            return;
        }

        sphere.copy(this.geometry.getBoundingSphere()).applyMatrix4(this.matrixWorld);
        if (!raycaster.ray.intersectsSphere(sphere)) {
            return;
        }

        // model view matrix may not update. E.G: culled by camera....
        this.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse, this.matrixWorld);
        worldScale.setFromMatrixScale(this.matrixWorld);
        viewWorldMatrix.getInverse(this.modelViewMatrix).premultiply(this.matrixWorld);
        mvPosition.setFromMatrixPosition(this.modelViewMatrix);

        const rotation = this.expectOnlyMaterial().rotation;
        let sin: number | undefined;
        let cos: number | undefined;
        if (rotation !== 0) {
            cos = Math.cos(rotation);
            sin = Math.sin(rotation);
        }
        const center = this.center;

        // TODO: fix type error
        transformVertex(vA.set(-0.5, -0.5, 0) as any, mvPosition as any, center, worldScale as any, sin, cos);
        transformVertex(vB.set(0.5, -0.5, 0) as any, mvPosition as any, center, worldScale as any, sin, cos);
        transformVertex(vC.set(0.5, 0.5, 0) as any, mvPosition as any, center, worldScale as any, sin, cos);

        uvA.set(0, 0);
        uvB.set(1, 0);
        uvC.set(1, 1);

        // check first triangle
        let intersect = raycaster.ray.intersectTriangle(vA, vB, vC, false, intersectPoint);
        if (intersect === null) {
            // check second triangle
            transformVertex(vB.set(-0.5, 0.5, 0) as any, mvPosition as any, center, worldScale as any, sin, cos);
            uvB.set(0, 1);

            intersect = raycaster.ray.intersectTriangle(vA, vC, vB, false, intersectPoint);
            if (intersect === null) {
                return;
            }
        }

        const distance = raycaster.ray.origin.distanceTo(intersectPoint);

        if (distance < raycaster.near || distance > raycaster.far) {
            return;
        }

        intersects.push({
            distance,
            point: intersectPoint.clone(),
            uv: Triangle.getUV(intersectPoint, vA, vB, vC, uvA, uvB, uvC, new Vector2()),
            primitiveIndex: 0,
            face: undefined,
            object: this
        });
    }
    /**
     * Return a cloned instance of this class.
     */
    clone(): Sprite {
        return new Sprite(this.expectOnlyMaterial()).copy(this);
    }
    /**
     * Copy the data to this instance from other instance.
     * @param {Sprite} other the source of copied data
     */
    copy(source: Sprite) {
        super.copy(source);
        if (source.center !== undefined) { this.center.copy(source.center); }
        return this;
    }
    /**
     * Store the attributes of this class into string as serializing format.
     * @param {Serializer} ctx an instance used to store the data of scene objects.
     */
    serialize(ctx: Serializer) {
        super.serialize(ctx);
        ctx.puts<Sprite>([
            'center'
        ]);
    }
    /**
     * Parse the data for this class from string according to serializing format.
     * @param {Deserializer} ctx an instance give the method to take the data for attribute.
     */
    deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        ctx.reads<Sprite>([
            'center'
        ]);
    }
}
