import { Camera3D } from '../cameras/Camera3D';
import { Matrix4 } from '../../math/Matrix4';
import { WGLProgram } from '../../renderer/webgl/WGLProgram';
import { Nullable } from '../../utils/Utils';
import { ShaderBuilder } from '../../renderer/shader/builders/ShaderBuilder';
import { ShaderBlockPool } from '../../renderer/shader/builders/ShaderBlockPool';
import { Object3D } from '../Object3D';
import { lightProperty } from '../../ContentAPI';
import { readonlyMath } from '../../math/Readonly';
import { Texture2D } from '../../elements/textures/Texture2D';
import { Deserializer, Serializer } from '../../utils/Serialization';
import { RenderAttachment } from '../../elements/textures/RenderTarget';

interface TargetLight extends Object3D {
    target: Object3D
}

export abstract class Shadow<M> {
    protected constructor(readonly light: Object3D) { }

    abstract className(): string;

    destroy() { }

    static _IN_TEMPORAL = false;
    static ENABLE_TEMPORAL_EFFECT = false;
    static JITTER_SIZE = 100;

    readonly isShadow = true;

    @lightProperty('enabled')
    private _enabled = false;
    get enabled() {
        return this._enabled;
    }
    set enabled(v: boolean) {
        this._enabled = v;
        if (!this._enabled) {
            this.map = null;
        }
    }

    @lightProperty()
    intensity = 0;

    @lightProperty()
    bias = 0;
    @lightProperty()
    normalBias = 0;
    @lightProperty()
    radius = 1;
    @lightProperty()
    mapSize = readonlyMath.vec2(512, 512);
    @lightProperty()
    map: Nullable<M> = null;

    abstract updateMapUniform(program: WGLProgram, mapName: string): void;
    abstract getMapOrDefault(): M;

    copy(other: Shadow<M>) {
        this.enabled = other.enabled;
        this.intensity = other.intensity;
        this.bias = other.bias;
        this.normalBias = other.normalBias;
        this.radius = other.radius;
        this.mapSize = other.mapSize;
    }

    updateUniforms(program: WGLProgram, prefix: string) {
        if (!this.enabled) {
            return;
        }
        this.updateUniformsImpl(program, prefix);
    }

    updateUniformsImpl(program: WGLProgram, prefix: string) {
        program.setUniform(prefix + '.shadowBias', this.bias);
        program.setUniform(prefix + '.shadowNormalBias', this.normalBias);
        program.setUniform(prefix + '.shadowRadius', this.radius);
        program.setUniform(prefix + '.shadowMapSize', this.mapSize);
        program.setUniform(prefix + '.shadowIntensity', this.intensity);
    }

    includeShadowMapCommon(builder: ShaderBuilder) {
        builder
            .addFragment(ShaderBlockPool.getShadowFrag)
            .addFragDefine('#define USE_SHADOWMAP');
    }

    deserialize(ctx: Deserializer) {
        ctx.reads<Shadow<M>>(['enabled', 'intensity', 'bias', 'normalBias', 'radius', 'mapSize']);
    }

    serialize(ctx: Serializer) {
        ctx.puts<Shadow<M>>(['enabled', 'intensity', 'bias', 'normalBias', 'radius', 'mapSize']);
    }
}

export abstract class SingleProjectShadow<C extends Camera3D> extends Shadow<RenderAttachment> {
    constructor(light: Object3D) {
        super(light);
    }

    camera: C;

    destroy() {
        this.camera.destroy();
    }

    @lightProperty()
    protected matrix = new Matrix4();

    updateCameraAndShadowMatrices(light: TargetLight) {
        light.updateWorldMatrix(true, false);
        this.updateCamera(light);
        this.updateShadowMatrix();
    }

    updateCamera(light: TargetLight) {
        if (!this.enabled) {
            return;
        }
        const shadowCamera = this.camera;
        light.getWorldPosition(shadowCamera.position);

        if (Shadow._IN_TEMPORAL && Shadow.ENABLE_TEMPORAL_EFFECT) {
            const randx = Math.random() - 0.5;
            const randy = Math.random() - 0.5;
            shadowCamera.position.x += Shadow.JITTER_SIZE * (randx * shadowCamera.matrixWorld._elements[0] + randy * shadowCamera.matrixWorld._elements[4]);
            shadowCamera.position.y += Shadow.JITTER_SIZE * (randx * shadowCamera.matrixWorld._elements[1] + randy * shadowCamera.matrixWorld._elements[5]);
            shadowCamera.position.z += Shadow.JITTER_SIZE * (randx * shadowCamera.matrixWorld._elements[2] + randy * shadowCamera.matrixWorld._elements[6]);
        }
        shadowCamera.lookAt(light.target.position);
        shadowCamera.updateMatrixWorld();
    }

    updateShadowMatrix() {
        if (!this.enabled) {
            return;
        }
        const shadowCamera = this.camera;
        const shadowMatrix = this.matrix;
        shadowMatrix.set(
            0.5, 0.0, 0.0, 0.5,
            0.0, 0.5, 0.0, 0.5,
            0.0, 0.0, 0.5, 0.5,
            0.0, 0.0, 0.0, 1.0
        );

        shadowMatrix.multiply(shadowCamera.projectionMatrix);
        shadowMatrix.multiply(shadowCamera.matrixWorldInverse);
        this.matrix = shadowMatrix;
    }

    updateUniformsImpl(program: WGLProgram, prefix: string) {
        super.updateUniformsImpl(program, prefix);
        program.setUniform(prefix + '.shadowMatrix', this.matrix);
    }

    updateMapUniform(program: WGLProgram, mapName: string): void {
        if (this.enabled) {
            program.setTexture2D(mapName, this.getMapOrDefault());
        }
    }

    getMapOrDefault(): RenderAttachment {
        if (this.enabled) {
            return this.map!;
        } else {
            return Texture2D.default as any;
        }
    }
}
