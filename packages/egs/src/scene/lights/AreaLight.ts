import { Texture2D } from '../../elements/textures/Texture2D';
import { WebGLPixelFormat } from '../../renderer/webgl/WGLConstants';
import { WGLProgram } from '../../renderer/webgl/WGLProgram';
import { TextureDataType } from '../../utils/Constants';
import { singleton } from '../../utils/Utils';
import { Light } from './Light';
import { ContentBridge } from '../../ContentAPI';

const createLUT1 = singleton(() => Texture2D
    .createByMainLayerSource(new Float32Array(require('./data1.ltc').default), WebGLPixelFormat.RGBA, TextureDataType.FloatType, 64, 64)
    .configAsDataTexture().configDoubleLinear());

const createLUT2 = singleton(() => Texture2D
    .createByMainLayerSource(new Float32Array(require('./data2.ltc').default), WebGLPixelFormat.RGBA, TextureDataType.FloatType, 64, 64)
    .configAsDataTexture().configDoubleLinear());

export class AreaLight extends Light {
    constructor(color: number | string, intensity: number) {
        super(color, intensity);
        initLtc();
    }
    static get ltc_1_texture() {
        return createLUT1();
    }
    static get ltc_2_texture() {
        return createLUT2();
    }
    /**
     * The name of instance's class.
     */
    className() {
        return 'AreaLight';
    }

    static updateLTCUniform(program: WGLProgram) {
        program.setTexture2D('ltc_1', AreaLight.ltc_1_texture);
        program.setTexture2D('ltc_2', AreaLight.ltc_2_texture);
    }
}

let ltcInitialized = false;

export function initLtc() {
    if (!ltcInitialized) {
        ContentBridge.init_ltc(AreaLight.ltc_1_texture, AreaLight.ltc_2_texture);
        ltcInitialized = true;
    }
}
