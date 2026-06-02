import { Box3 } from '../math/Box3';
import { Size } from '../utils/Utils';
import { Matrix4 } from '../math/Matrix4';

/**
 * Result states returned by snapshot rendering.
 */
export enum SnapshotResultResultType {
    Success,
    Empty,
    Error,
}

/**
 * Camera matrices captured with a snapshot result.
 */
export interface SnapshotCameraInfo {
    projectionMatrix: Matrix4,
    worldMatrix: Matrix4
}
/**
 * Result object returned from snapshot rendering.
 */
export class SnapshotResult {
    type: SnapshotResultResultType = SnapshotResultResultType.Success;
    reason?: any;

    constructor(public data: Uint8Array, public size: Size, public cameraInfo: SnapshotCameraInfo, public worldBox?: Box3) { }

    static exception(type: SnapshotResultResultType, reason?: any) {
        const result = new SnapshotResult(
            new Uint8Array([0, 0, 0, 0]),
            { width: 1, height: 1 },
            { projectionMatrix: new Matrix4(), worldMatrix: new Matrix4() }
        );
        result.type = type;
        result.reason = reason;
        return result;
    }

    flipY() {
        const { data, size: { width: w, height: h } } = this;
        const middleAxle = Math.floor(h / 2), rowAisles = w * 4;

        for (let curRow = 0; curRow < middleAxle; curRow++) {
            let aisleStart = curRow * rowAisles,
                mirrorStart = (h - curRow - 1) * rowAisles;

            for (; aisleStart < rowAisles * (curRow + 1); aisleStart += 4, mirrorStart += 4) {
                const tr = data[aisleStart],
                    tg = data[aisleStart + 1],
                    tb = data[aisleStart + 2],
                    ta = data[aisleStart + 3];

                data[aisleStart] = data[mirrorStart];
                data[aisleStart + 1] = data[mirrorStart + 1];
                data[aisleStart + 2] = data[mirrorStart + 2];
                data[aisleStart + 3] = data[mirrorStart + 3];

                data[mirrorStart] = tr;
                data[mirrorStart + 1] = tg;
                data[mirrorStart + 2] = tb;
                data[mirrorStart + 3] = ta;
            }
        }
        return this;
    }

    createDataURL(): string {
        const canvas = document.createElement('canvas');
        canvas.width = this.size.width;
        canvas.height = this.size.height;

        const ctx = canvas.getContext('2d')!;
        const data = ctx.createImageData(this.size.width, this.size.height);
        data.data.set(this.data);
        ctx.putImageData(data, 0, 0);
        return canvas.toDataURL();
    }

    downloadImage(name: string = 'debug.png') {
        const link = document.createElement('a');
        link.download = name;
        link.href = this.createDataURL();
        link.click();
    }
}
