import { EventDispatcher, EventType } from '../../utils/EventDispatcher.js';
import type { Camera3D } from '../cameras/Camera3D.js';
import { Object3DChangeEvent } from '../Object3D.js';

export const CameraStartChangeEvent = new EventType();
export const CameraChangeEvent = new EventType();
export const CameraEndChangeEvent = new EventType();

export class CameraWatcher extends EventDispatcher {
    private camera?: Camera3D;
    private changing: boolean = false; // this for avoiding performance issue caused by overhead of too many setTimeout and clearTimeout
    private startTimeStamp = 0; // last time triggered setTimeout
    private canceled = false;
    private hasSet = false;
    private timeThreshold = 200; // ms;

    setCamera(camera: Camera3D): void {
        this.watch(camera);
        if (this.camera !== undefined) {
            this.unwatch(this.camera);
        }

        this.camera = camera;
        this.cancelResetChanging();
        this.changing = false;
        this.onChange();
    }

    private watch(camera: Camera3D): void {
        camera.on(Object3DChangeEvent, this.onChange);
    }

    private unwatch(camera: Camera3D): void {
        camera.off(Object3DChangeEvent, this.onChange);
    }

    private resetChanging = () => {
        this.changing = false;
        this.emit(CameraEndChangeEvent);
    };

    private refreshResetChanging(): void {
        this.cancelResetChanging();
        this.setTimeoutPref(this.resetChanging, this.timeThreshold);
    }

    private cancelResetChanging = () => {
        this.clearTimeoutPref();
    };

    private onChange = () => {
        this.emit(CameraChangeEvent);
        if (!this.changing) {
            this.emit(CameraStartChangeEvent);
            this.changing = true;
        }
        this.refreshResetChanging();
    };

    private wrap(cb: Function, time: number): Function {
        const fn = () => {
            const delta = performance.now() - this.startTimeStamp;
            if (this.canceled) {
                this.canceled = false;
                this.hasSet = false;
                return;
            }
            if (delta > time) {
                cb();
                this.hasSet = false;
            } else {
                // need set another timer to continue
                setTimeout(this.wrap(cb, time - delta), time - delta);
            }
        };
        return fn;
    }

    private setTimeoutPref(cb: Function, time: number): void {
        this.canceled = false;
        this.startTimeStamp = performance.now();
        if (this.hasSet) {
            return;
        }
        setTimeout(this.wrap(cb, time), time);
        this.hasSet = true;
    }

    private clearTimeoutPref(): void {
        this.canceled = true;
    }

    dispose(): void {
        this.clearAllListeners();
        if (this.camera) {
            this.unwatch(this.camera);
            this.camera = undefined;
        }
        this.cancelResetChanging();
        this.changing = false;
    }
}
