#include <cstdint>
#include <wasm_simd128.h>

using std::uint32_t;

namespace {

constexpr uint32_t KEY_SHIFT = 8;
constexpr uint32_t BUCKET_COUNT = 1u << (31 - KEY_SHIFT);
constexpr uint32_t DEPTH_LIMIT = 0x7f7fffff;
static uint32_t buckets[BUCKET_COUNT];
static uint32_t min_bucket, max_bucket;

using Float4 = float __attribute__((vector_size(16)));

static inline __attribute__((always_inline)) void project_depths(
    const float *centers, uint32_t *keys, uint32_t count, float cx, float cy, float cz,
    float dx, float dy, float dz, float bias, bool radial) {
    const float offset = radial ? bias : bias - (cx * dx + cy * dy + cz * dz);
    const Float4 infinity = (Float4)wasm_f32x4_splat(__builtin_inff());

    for (uint32_t i = 0; i < count; i += 4, centers += 16) {
        // Transpose four XYZW centers into x, y, z and w vectors.
        v128_t a = wasm_v128_load(centers), b = wasm_v128_load(centers + 4);
        v128_t c = wasm_v128_load(centers + 8), d = wasm_v128_load(centers + 12);
        v128_t ab_xy = wasm_i32x4_shuffle(a, b, 0, 4, 1, 5), cd_xy = wasm_i32x4_shuffle(c, d, 0, 4, 1, 5);
        v128_t ab_zw = wasm_i32x4_shuffle(a, b, 2, 6, 3, 7), cd_zw = wasm_i32x4_shuffle(c, d, 2, 6, 3, 7);
        Float4 x = (Float4)wasm_i32x4_shuffle(ab_xy, cd_xy, 0, 1, 4, 5);
        Float4 y = (Float4)wasm_i32x4_shuffle(ab_xy, cd_xy, 2, 3, 6, 7);
        Float4 z = (Float4)wasm_i32x4_shuffle(ab_zw, cd_zw, 0, 1, 4, 5);
        Float4 w = (Float4)wasm_i32x4_shuffle(ab_zw, cd_zw, 2, 3, 6, 7);
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

} // namespace

extern "C" {

void reset_buckets() {
    __builtin_memset(buckets, 0, sizeof(buckets));
    min_bucket = BUCKET_COUNT;
    max_bucket = 0;
}

void project_chunk(const float *centers, uint32_t *keys, uint32_t count, float cx, float cy, float cz,
                  float dx, float dy, float dz, float bias, bool radial) {
    if (radial) {
        project_depths(centers, keys, count, cx, cy, cz, dx, dy, dz, bias, true);
    } else {
        project_depths(centers, keys, count, cx, cy, cz, dx, dy, dz, bias, false);
    }
    // Count the chunk while its depth keys are still in cache.
    uint32_t lo = min_bucket, hi = max_bucket;
    for (uint32_t i = 0; i < count; ++i) {
        if (keys[i] < DEPTH_LIMIT) {
            uint32_t bucket = keys[i] >> KEY_SHIFT;
            ++buckets[bucket];
            if (bucket < lo) lo = bucket;
            if (bucket > hi) hi = bucket;
        }
    }
    min_bucket = lo;
    max_bucket = hi;
}

uint32_t write_order(const uint32_t *keys, uint32_t count, uint32_t *order) {
    uint32_t active_count = 0;
    for (uint32_t bucket = max_bucket + 1; bucket > min_bucket;) {
        uint32_t size = buckets[--bucket];
        buckets[bucket] = active_count;
        active_count += size;
    }
    for (uint32_t i = 0; i < count; ++i) {
        if (keys[i] < DEPTH_LIMIT) {
            order[buckets[keys[i] >> KEY_SHIFT]++] = i;
        }
    }
    return active_count;
}

} // extern "C"
