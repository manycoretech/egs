import type { Matrix3 } from '@qunhe/egs';
import type { SplatOperator } from './SplatOperator.js';

//#region
/**
 * Rotate spherical harmonics up to band 3 based on https://github.com/andrewwillmott/sh-lib
 * This implementation calculates the rotation factors during construction which can then
 * be used to rotate multiple spherical harmonics cheaply.
 */
const kSqrt03_02 = Math.sqrt(3.0 / 2.0);
const kSqrt01_03 = Math.sqrt(1.0 / 3.0);
const kSqrt02_03 = Math.sqrt(2.0 / 3.0);
const kSqrt04_03 = Math.sqrt(4.0 / 3.0);
const kSqrt01_04 = Math.sqrt(1.0 / 4.0);
const kSqrt03_04 = Math.sqrt(3.0 / 4.0);
const kSqrt01_05 = Math.sqrt(1.0 / 5.0);
const kSqrt03_05 = Math.sqrt(3.0 / 5.0);
const kSqrt06_05 = Math.sqrt(6.0 / 5.0);
const kSqrt08_05 = Math.sqrt(8.0 / 5.0);
const kSqrt09_05 = Math.sqrt(9.0 / 5.0);
const kSqrt01_06 = Math.sqrt(1.0 / 6.0);
const kSqrt05_06 = Math.sqrt(5.0 / 6.0);
const kSqrt03_08 = Math.sqrt(3.0 / 8.0);
const kSqrt05_08 = Math.sqrt(5.0 / 8.0);
const kSqrt09_08 = Math.sqrt(9.0 / 8.0);
const kSqrt05_09 = Math.sqrt(5.0 / 9.0);
const kSqrt08_09 = Math.sqrt(8.0 / 9.0);
const kSqrt01_10 = Math.sqrt(1.0 / 10.0);
const kSqrt03_10 = Math.sqrt(3.0 / 10.0);
const kSqrt01_12 = Math.sqrt(1.0 / 12.0);
const kSqrt04_15 = Math.sqrt(4.0 / 15.0);
const kSqrt01_16 = Math.sqrt(1.0 / 16.0);
const kSqrt15_16 = Math.sqrt(15.0 / 16.0);
const kSqrt01_18 = Math.sqrt(1.0 / 18.0);
const kSqrt01_60 = Math.sqrt(1.0 / 60.0);
export function createSHRotateFn(mat: Matrix3) {
    const rot = mat.elements;

    const sh1 = [
        [rot[4], -rot[7], rot[1]],
        [-rot[5], rot[8], -rot[2]],
        [rot[3], -rot[6], rot[0]],
    ];

    const sh2 = [
        [
            kSqrt01_04 *
                (sh1[2][2] * sh1[0][0] + sh1[2][0] * sh1[0][2] + (sh1[0][2] * sh1[2][0] + sh1[0][0] * sh1[2][2])),
            sh1[2][1] * sh1[0][0] + sh1[0][1] * sh1[2][0],
            kSqrt03_04 * (sh1[2][1] * sh1[0][1] + sh1[0][1] * sh1[2][1]),
            sh1[2][1] * sh1[0][2] + sh1[0][1] * sh1[2][2],
            kSqrt01_04 *
                (sh1[2][2] * sh1[0][2] - sh1[2][0] * sh1[0][0] + (sh1[0][2] * sh1[2][2] - sh1[0][0] * sh1[2][0])),
        ],
        [
            kSqrt01_04 *
                (sh1[1][2] * sh1[0][0] + sh1[1][0] * sh1[0][2] + (sh1[0][2] * sh1[1][0] + sh1[0][0] * sh1[1][2])),
            sh1[1][1] * sh1[0][0] + sh1[0][1] * sh1[1][0],
            kSqrt03_04 * (sh1[1][1] * sh1[0][1] + sh1[0][1] * sh1[1][1]),
            sh1[1][1] * sh1[0][2] + sh1[0][1] * sh1[1][2],
            kSqrt01_04 *
                (sh1[1][2] * sh1[0][2] - sh1[1][0] * sh1[0][0] + (sh1[0][2] * sh1[1][2] - sh1[0][0] * sh1[1][0])),
        ],
        [
            kSqrt01_03 * (sh1[1][2] * sh1[1][0] + sh1[1][0] * sh1[1][2]) -
                kSqrt01_12 *
                    (sh1[2][2] * sh1[2][0] + sh1[2][0] * sh1[2][2] + (sh1[0][2] * sh1[0][0] + sh1[0][0] * sh1[0][2])),
            kSqrt04_03 * sh1[1][1] * sh1[1][0] - kSqrt01_03 * (sh1[2][1] * sh1[2][0] + sh1[0][1] * sh1[0][0]),
            sh1[1][1] * sh1[1][1] - kSqrt01_04 * (sh1[2][1] * sh1[2][1] + sh1[0][1] * sh1[0][1]),
            kSqrt04_03 * sh1[1][1] * sh1[1][2] - kSqrt01_03 * (sh1[2][1] * sh1[2][2] + sh1[0][1] * sh1[0][2]),
            kSqrt01_03 * (sh1[1][2] * sh1[1][2] - sh1[1][0] * sh1[1][0]) -
                kSqrt01_12 *
                    (sh1[2][2] * sh1[2][2] - sh1[2][0] * sh1[2][0] + (sh1[0][2] * sh1[0][2] - sh1[0][0] * sh1[0][0])),
        ],
        [
            kSqrt01_04 *
                (sh1[1][2] * sh1[2][0] + sh1[1][0] * sh1[2][2] + (sh1[2][2] * sh1[1][0] + sh1[2][0] * sh1[1][2])),
            sh1[1][1] * sh1[2][0] + sh1[2][1] * sh1[1][0],
            kSqrt03_04 * (sh1[1][1] * sh1[2][1] + sh1[2][1] * sh1[1][1]),
            sh1[1][1] * sh1[2][2] + sh1[2][1] * sh1[1][2],
            kSqrt01_04 *
                (sh1[1][2] * sh1[2][2] - sh1[1][0] * sh1[2][0] + (sh1[2][2] * sh1[1][2] - sh1[2][0] * sh1[1][0])),
        ],
        [
            kSqrt01_04 *
                (sh1[2][2] * sh1[2][0] + sh1[2][0] * sh1[2][2] - (sh1[0][2] * sh1[0][0] + sh1[0][0] * sh1[0][2])),
            sh1[2][1] * sh1[2][0] - sh1[0][1] * sh1[0][0],
            kSqrt03_04 * (sh1[2][1] * sh1[2][1] - sh1[0][1] * sh1[0][1]),
            sh1[2][1] * sh1[2][2] - sh1[0][1] * sh1[0][2],
            kSqrt01_04 *
                (sh1[2][2] * sh1[2][2] - sh1[2][0] * sh1[2][0] - (sh1[0][2] * sh1[0][2] - sh1[0][0] * sh1[0][0])),
        ],
    ];

    const sh3 = [
        [
            kSqrt01_04 *
                (sh1[2][2] * sh2[0][0] + sh1[2][0] * sh2[0][4] + (sh1[0][2] * sh2[4][0] + sh1[0][0] * sh2[4][4])),
            kSqrt03_02 * (sh1[2][1] * sh2[0][0] + sh1[0][1] * sh2[4][0]),
            kSqrt15_16 * (sh1[2][1] * sh2[0][1] + sh1[0][1] * sh2[4][1]),
            kSqrt05_06 * (sh1[2][1] * sh2[0][2] + sh1[0][1] * sh2[4][2]),
            kSqrt15_16 * (sh1[2][1] * sh2[0][3] + sh1[0][1] * sh2[4][3]),
            kSqrt03_02 * (sh1[2][1] * sh2[0][4] + sh1[0][1] * sh2[4][4]),
            kSqrt01_04 *
                (sh1[2][2] * sh2[0][4] - sh1[2][0] * sh2[0][0] + (sh1[0][2] * sh2[4][4] - sh1[0][0] * sh2[4][0])),
        ],
        [
            kSqrt01_06 * (sh1[1][2] * sh2[0][0] + sh1[1][0] * sh2[0][4]) +
                kSqrt01_06 *
                    (sh1[2][2] * sh2[1][0] + sh1[2][0] * sh2[1][4] + (sh1[0][2] * sh2[3][0] + sh1[0][0] * sh2[3][4])),
            sh1[1][1] * sh2[0][0] + (sh1[2][1] * sh2[1][0] + sh1[0][1] * sh2[3][0]),
            kSqrt05_08 * sh1[1][1] * sh2[0][1] + kSqrt05_08 * (sh1[2][1] * sh2[1][1] + sh1[0][1] * sh2[3][1]),
            kSqrt05_09 * sh1[1][1] * sh2[0][2] + kSqrt05_09 * (sh1[2][1] * sh2[1][2] + sh1[0][1] * sh2[3][2]),
            kSqrt05_08 * sh1[1][1] * sh2[0][3] + kSqrt05_08 * (sh1[2][1] * sh2[1][3] + sh1[0][1] * sh2[3][3]),
            sh1[1][1] * sh2[0][4] + (sh1[2][1] * sh2[1][4] + sh1[0][1] * sh2[3][4]),
            kSqrt01_06 * (sh1[1][2] * sh2[0][4] - sh1[1][0] * sh2[0][0]) +
                kSqrt01_06 *
                    (sh1[2][2] * sh2[1][4] - sh1[2][0] * sh2[1][0] + (sh1[0][2] * sh2[3][4] - sh1[0][0] * sh2[3][0])),
        ],
        [
            kSqrt04_15 * (sh1[1][2] * sh2[1][0] + sh1[1][0] * sh2[1][4]) +
                kSqrt01_05 * (sh1[0][2] * sh2[2][0] + sh1[0][0] * sh2[2][4]) -
                kSqrt01_60 *
                    (sh1[2][2] * sh2[0][0] + sh1[2][0] * sh2[0][4] - (sh1[0][2] * sh2[4][0] + sh1[0][0] * sh2[4][4])),
            kSqrt08_05 * sh1[1][1] * sh2[1][0] +
                kSqrt06_05 * sh1[0][1] * sh2[2][0] -
                kSqrt01_10 * (sh1[2][1] * sh2[0][0] - sh1[0][1] * sh2[4][0]),
            sh1[1][1] * sh2[1][1] +
                kSqrt03_04 * sh1[0][1] * sh2[2][1] -
                kSqrt01_16 * (sh1[2][1] * sh2[0][1] - sh1[0][1] * sh2[4][1]),
            kSqrt08_09 * sh1[1][1] * sh2[1][2] +
                kSqrt02_03 * sh1[0][1] * sh2[2][2] -
                kSqrt01_18 * (sh1[2][1] * sh2[0][2] - sh1[0][1] * sh2[4][2]),
            sh1[1][1] * sh2[1][3] +
                kSqrt03_04 * sh1[0][1] * sh2[2][3] -
                kSqrt01_16 * (sh1[2][1] * sh2[0][3] - sh1[0][1] * sh2[4][3]),
            kSqrt08_05 * sh1[1][1] * sh2[1][4] +
                kSqrt06_05 * sh1[0][1] * sh2[2][4] -
                kSqrt01_10 * (sh1[2][1] * sh2[0][4] - sh1[0][1] * sh2[4][4]),
            kSqrt04_15 * (sh1[1][2] * sh2[1][4] - sh1[1][0] * sh2[1][0]) +
                kSqrt01_05 * (sh1[0][2] * sh2[2][4] - sh1[0][0] * sh2[2][0]) -
                kSqrt01_60 *
                    (sh1[2][2] * sh2[0][4] - sh1[2][0] * sh2[0][0] - (sh1[0][2] * sh2[4][4] - sh1[0][0] * sh2[4][0])),
        ],
        [
            kSqrt03_10 * (sh1[1][2] * sh2[2][0] + sh1[1][0] * sh2[2][4]) -
                kSqrt01_10 *
                    (sh1[2][2] * sh2[3][0] + sh1[2][0] * sh2[3][4] + (sh1[0][2] * sh2[1][0] + sh1[0][0] * sh2[1][4])),
            kSqrt09_05 * sh1[1][1] * sh2[2][0] - kSqrt03_05 * (sh1[2][1] * sh2[3][0] + sh1[0][1] * sh2[1][0]),
            kSqrt09_08 * sh1[1][1] * sh2[2][1] - kSqrt03_08 * (sh1[2][1] * sh2[3][1] + sh1[0][1] * sh2[1][1]),
            sh1[1][1] * sh2[2][2] - kSqrt01_03 * (sh1[2][1] * sh2[3][2] + sh1[0][1] * sh2[1][2]),
            kSqrt09_08 * sh1[1][1] * sh2[2][3] - kSqrt03_08 * (sh1[2][1] * sh2[3][3] + sh1[0][1] * sh2[1][3]),
            kSqrt09_05 * sh1[1][1] * sh2[2][4] - kSqrt03_05 * (sh1[2][1] * sh2[3][4] + sh1[0][1] * sh2[1][4]),
            kSqrt03_10 * (sh1[1][2] * sh2[2][4] - sh1[1][0] * sh2[2][0]) -
                kSqrt01_10 *
                    (sh1[2][2] * sh2[3][4] - sh1[2][0] * sh2[3][0] + (sh1[0][2] * sh2[1][4] - sh1[0][0] * sh2[1][0])),
        ],
        [
            kSqrt04_15 * (sh1[1][2] * sh2[3][0] + sh1[1][0] * sh2[3][4]) +
                kSqrt01_05 * (sh1[2][2] * sh2[2][0] + sh1[2][0] * sh2[2][4]) -
                kSqrt01_60 *
                    (sh1[2][2] * sh2[4][0] + sh1[2][0] * sh2[4][4] + (sh1[0][2] * sh2[0][0] + sh1[0][0] * sh2[0][4])),
            kSqrt08_05 * sh1[1][1] * sh2[3][0] +
                kSqrt06_05 * sh1[2][1] * sh2[2][0] -
                kSqrt01_10 * (sh1[2][1] * sh2[4][0] + sh1[0][1] * sh2[0][0]),
            sh1[1][1] * sh2[3][1] +
                kSqrt03_04 * sh1[2][1] * sh2[2][1] -
                kSqrt01_16 * (sh1[2][1] * sh2[4][1] + sh1[0][1] * sh2[0][1]),
            kSqrt08_09 * sh1[1][1] * sh2[3][2] +
                kSqrt02_03 * sh1[2][1] * sh2[2][2] -
                kSqrt01_18 * (sh1[2][1] * sh2[4][2] + sh1[0][1] * sh2[0][2]),
            sh1[1][1] * sh2[3][3] +
                kSqrt03_04 * sh1[2][1] * sh2[2][3] -
                kSqrt01_16 * (sh1[2][1] * sh2[4][3] + sh1[0][1] * sh2[0][3]),
            kSqrt08_05 * sh1[1][1] * sh2[3][4] +
                kSqrt06_05 * sh1[2][1] * sh2[2][4] -
                kSqrt01_10 * (sh1[2][1] * sh2[4][4] + sh1[0][1] * sh2[0][4]),
            kSqrt04_15 * (sh1[1][2] * sh2[3][4] - sh1[1][0] * sh2[3][0]) +
                kSqrt01_05 * (sh1[2][2] * sh2[2][4] - sh1[2][0] * sh2[2][0]) -
                kSqrt01_60 *
                    (sh1[2][2] * sh2[4][4] - sh1[2][0] * sh2[4][0] + (sh1[0][2] * sh2[0][4] - sh1[0][0] * sh2[0][0])),
        ],
        [
            kSqrt01_06 * (sh1[1][2] * sh2[4][0] + sh1[1][0] * sh2[4][4]) +
                kSqrt01_06 *
                    (sh1[2][2] * sh2[3][0] + sh1[2][0] * sh2[3][4] - (sh1[0][2] * sh2[1][0] + sh1[0][0] * sh2[1][4])),
            sh1[1][1] * sh2[4][0] + (sh1[2][1] * sh2[3][0] - sh1[0][1] * sh2[1][0]),
            kSqrt05_08 * sh1[1][1] * sh2[4][1] + kSqrt05_08 * (sh1[2][1] * sh2[3][1] - sh1[0][1] * sh2[1][1]),
            kSqrt05_09 * sh1[1][1] * sh2[4][2] + kSqrt05_09 * (sh1[2][1] * sh2[3][2] - sh1[0][1] * sh2[1][2]),
            kSqrt05_08 * sh1[1][1] * sh2[4][3] + kSqrt05_08 * (sh1[2][1] * sh2[3][3] - sh1[0][1] * sh2[1][3]),
            sh1[1][1] * sh2[4][4] + (sh1[2][1] * sh2[3][4] - sh1[0][1] * sh2[1][4]),
            kSqrt01_06 * (sh1[1][2] * sh2[4][4] - sh1[1][0] * sh2[4][0]) +
                kSqrt01_06 *
                    (sh1[2][2] * sh2[3][4] - sh1[2][0] * sh2[3][0] - (sh1[0][2] * sh2[1][4] - sh1[0][0] * sh2[1][0])),
        ],
        [
            kSqrt01_04 *
                (sh1[2][2] * sh2[4][0] + sh1[2][0] * sh2[4][4] - (sh1[0][2] * sh2[0][0] + sh1[0][0] * sh2[0][4])),
            kSqrt03_02 * (sh1[2][1] * sh2[4][0] - sh1[0][1] * sh2[0][0]),
            kSqrt15_16 * (sh1[2][1] * sh2[4][1] - sh1[0][1] * sh2[0][1]),
            kSqrt05_06 * (sh1[2][1] * sh2[4][2] - sh1[0][1] * sh2[0][2]),
            kSqrt15_16 * (sh1[2][1] * sh2[4][3] - sh1[0][1] * sh2[0][3]),
            kSqrt03_02 * (sh1[2][1] * sh2[4][4] - sh1[0][1] * sh2[0][4]),
            kSqrt01_04 *
                (sh1[2][2] * sh2[4][4] - sh1[2][0] * sh2[4][0] - (sh1[0][2] * sh2[0][4] - sh1[0][0] * sh2[0][0])),
        ],
    ];

    const dp = (n: number, start: number, a: Float32Array, b: number[]) => {
        let sum = 0;
        for (let i = 0; i < n; i++) {
            sum += a[start + i] * b[i];
        }
        return sum;
    };

    const temp = new Float32Array(15);
    return (shN: number[]) => {
        temp.set(shN);

        if (shN.length < 3) {
            return;
        }
        shN[0] = dp(3, 0, temp, sh1[0]);
        shN[1] = dp(3, 0, temp, sh1[1]);
        shN[2] = dp(3, 0, temp, sh1[2]);

        if (shN.length < 8) {
            return;
        }
        shN[3] = dp(5, 3, temp, sh2[0]);
        shN[4] = dp(5, 3, temp, sh2[1]);
        shN[5] = dp(5, 3, temp, sh2[2]);
        shN[6] = dp(5, 3, temp, sh2[3]);
        shN[7] = dp(5, 3, temp, sh2[4]);

        if (shN.length < 15) {
            return;
        }
        shN[8] = dp(7, 8, temp, sh3[0]);
        shN[9] = dp(7, 8, temp, sh3[1]);
        shN[10] = dp(7, 8, temp, sh3[2]);
        shN[11] = dp(7, 8, temp, sh3[3]);
        shN[12] = dp(7, 8, temp, sh3[4]);
        shN[13] = dp(7, 8, temp, sh3[5]);
        shN[14] = dp(7, 8, temp, sh3[6]);
    };
}
//#endregion

const VOXEL_COUNTS = 65535;
export function computeDenseBox(operator: SplatOperator, ratio: number = 0.98) {
    const counts = operator.getActiveCounts();

    const positions = new Float32Array(counts * 3);
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    let offset = 0;
    operator.foreachSplatCenter((_i, x, y, z) => {
        positions[offset] = x;
        positions[offset + 1] = y;
        positions[offset + 2] = z;
        if (x < minX) {
            minX = x;
        }
        if (y < minY) {
            minY = y;
        }
        if (z < minZ) {
            minZ = z;
        }
        if (x > maxX) {
            maxX = x;
        }
        if (y > maxY) {
            maxY = y;
        }
        if (z > maxZ) {
            maxZ = z;
        }
        offset += 3;
    });

    const scaleX = VOXEL_COUNTS / Math.max(maxX - minX, 1e-9);
    const scaleY = VOXEL_COUNTS / Math.max(maxY - minY, 1e-9);
    const scaleZ = VOXEL_COUNTS / Math.max(maxZ - minZ, 1e-9);

    const xChunks = new Uint32Array(VOXEL_COUNTS);
    const yChunks = new Uint32Array(VOXEL_COUNTS);
    const zChunks = new Uint32Array(VOXEL_COUNTS);
    for (let i = 0; i < positions.length; i += 3) {
        xChunks[((positions[i] - minX) * scaleX) | 0]++;
        yChunks[((positions[i + 1] - minY) * scaleY) | 0]++;
        zChunks[((positions[i + 2] - minZ) * scaleZ) | 0]++;
    }

    const K = Math.ceil(counts * (1 - ratio));
    let startX = 0;
    let endX = VOXEL_COUNTS - 1;
    let countX = 0;
    while (countX < K) {
        if (xChunks[startX] > xChunks[endX]) {
            countX += xChunks[endX];
            endX--;
        } else {
            countX += xChunks[startX];
            startX++;
        }
    }

    let startY = 0;
    let endY = VOXEL_COUNTS - 1;
    let countY = 0;
    while (countY < K) {
        if (yChunks[startY] > yChunks[endY]) {
            countY += yChunks[endY];
            endY--;
        } else {
            countY += yChunks[startY];
            startY++;
        }
    }

    let startZ = 0;
    let endZ = VOXEL_COUNTS - 1;
    let countZ = 0;
    while (countZ < K) {
        if (zChunks[startZ] > zChunks[endZ]) {
            countZ += zChunks[endZ];
            endZ--;
        } else {
            countZ += zChunks[startZ];
            startZ++;
        }
    }

    return {
        boxMin: [startX / scaleX + minX, startY / scaleY + minY, startZ / scaleZ + minZ],
        boxMax: [endX / scaleX + minX, endY / scaleY + minY, endZ / scaleZ + minZ],
    };
}
