import { EventType } from '../utils/EventDispatcher';

export interface ToggleWebWebGpuPayload {
    enabled: boolean;
    offscreen: boolean;
    canvas: HTMLCanvasElement;
}

export const ToggleWebGPUEvent = new EventType<ToggleWebWebGpuPayload>('TOGGLE_WEBGPU');
export const WebGPUUnstable = new EventType('WEBGPU_UNSTABLE');
export const WebGPUValidationFailed = new EventType<number>('WEBGPU_VALIDATION_FAILED');
