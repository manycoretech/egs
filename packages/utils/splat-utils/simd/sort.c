#include <stdbool.h>
#include <stdint.h>
#include <wasm_simd128.h>

enum { KEY_SHIFT = 8, BUCKET_COUNT = 1 << (31 - KEY_SHIFT) };
static const uint32_t depthLimit = 0x7f7fffff;
static uint32_t buckets[BUCKET_COUNT];
static uint32_t minBucket, maxBucket;

void resetBuckets(void) {
    __builtin_memset(buckets, 0, sizeof(buckets));
    minBucket = BUCKET_COUNT;
    maxBucket = 0;
}

typedef float Float4 __attribute__((vector_size(16)));

static inline __attribute__((always_inline)) void projectDepths(
    const float *centers, uint32_t *keys, uint32_t count, float cx, float cy, float cz,
    float dx, float dy, float dz, float bias, bool radial) {
    const float offset = radial ? bias : bias - (cx * dx + cy * dy + cz * dz);
    const Float4 infinity = (Float4)wasm_f32x4_splat(__builtin_inff());

    for (uint32_t i = 0; i < count; i += 4, centers += 16) {
        // Transpose four XYZW centers into x, y, z and w vectors.
        v128_t a = wasm_v128_load(centers), b = wasm_v128_load(centers + 4);
        v128_t c = wasm_v128_load(centers + 8), d = wasm_v128_load(centers + 12);
        v128_t abXY = wasm_i32x4_shuffle(a, b, 0, 4, 1, 5), cdXY = wasm_i32x4_shuffle(c, d, 0, 4, 1, 5);
        v128_t abZW = wasm_i32x4_shuffle(a, b, 2, 6, 3, 7), cdZW = wasm_i32x4_shuffle(c, d, 2, 6, 3, 7);
        Float4 x = (Float4)wasm_i32x4_shuffle(abXY, cdXY, 0, 1, 4, 5);
        Float4 y = (Float4)wasm_i32x4_shuffle(abXY, cdXY, 2, 3, 6, 7);
        Float4 z = (Float4)wasm_i32x4_shuffle(abZW, cdZW, 0, 1, 4, 5);
        Float4 w = (Float4)wasm_i32x4_shuffle(abZW, cdZW, 2, 3, 6, 7);
        if (radial) {
            x -= cx;
            y -= cy;
            z -= cz;
        }
        Float4 depth = x * dx + y * dy + z * dz + offset;
        v128_t visible = (depth > 0.0f) & (w > 0.0f);
        if (radial) {
            depth = (Float4)wasm_f32x4_sqrt((v128_t)(x * x + y * y + z * z));
        }
        wasm_v128_store(keys + i, wasm_v128_bitselect((v128_t)depth, (v128_t)infinity, visible));
    }
}

void projectChunk(const float *centers, uint32_t *keys, uint32_t count, float cx, float cy, float cz,
                  float dx, float dy, float dz, float bias, bool radial) {
    if (radial) {
        projectDepths(centers, keys, count, cx, cy, cz, dx, dy, dz, bias, true);
    } else {
        projectDepths(centers, keys, count, cx, cy, cz, dx, dy, dz, bias, false);
    }
    // Count the chunk while its depth keys are still in cache.
    uint32_t lo = minBucket, hi = maxBucket;
    for (uint32_t i = 0; i < count; ++i) {
        if (keys[i] < depthLimit) {
            uint32_t bucket = keys[i] >> KEY_SHIFT;
            ++buckets[bucket];
            if (bucket < lo) lo = bucket;
            if (bucket > hi) hi = bucket;
        }
    }
    minBucket = lo;
    maxBucket = hi;
}

uint32_t writeOrder(const uint32_t *keys, uint32_t count, uint32_t *order) {
    uint32_t activeCount = 0;
    for (uint32_t bucket = maxBucket + 1; bucket > minBucket;) {
        uint32_t size = buckets[--bucket];
        buckets[bucket] = activeCount;
        activeCount += size;
    }
    for (uint32_t i = 0; i < count; ++i) {
        if (keys[i] < depthLimit) {
            order[buckets[keys[i] >> KEY_SHIFT]++] = i;
        }
    }
    return activeCount;
}
