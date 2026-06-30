import { Texture2D } from '../../elements/textures/Texture2D.js';
import { WebGLPixelFormat } from '../../renderer/webgl/WGLConstants.js';
import type { WGLProgram } from '../../renderer/webgl/WGLProgram.js';
import { TextureDataType } from '../../utils/Constants.js';
import { singleton } from '../../utils/Utils.js';
import { Light } from './Light.js';
import { ContentBridge } from '../../ContentAPI.js';
import ltc1 from './data1.ltc.js';
import ltc2 from './data2.ltc.js';

const createLUT1 = singleton(() =>
    Texture2D.createByMainLayerSource(new Float32Array(ltc1), WebGLPixelFormat.RGBA, TextureDataType.FloatType, 64, 64)
        .configAsDataTexture()
        .configDoubleLinear(),
);

const createLUT2 = singleton(() =>
    Texture2D.createByMainLayerSource(new Float32Array(ltc2), WebGLPixelFormat.RGBA, TextureDataType.FloatType, 64, 64)
        .configAsDataTexture()
        .configDoubleLinear(),
);

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
