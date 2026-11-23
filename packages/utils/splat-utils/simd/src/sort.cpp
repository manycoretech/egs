#include <cstdint>
#include <cstring>
#include <emmintrin.h>
#include <limits>

namespace {

constexpr uint32_t KEY_SHIFT = 8;
constexpr uint32_t BUCKET_COUNT = 1u << (31 - KEY_SHIFT);
constexpr uint32_t DEPTH_LIMIT = 0x7f7fffff;
static uint32_t buckets[BUCKET_COUNT];
static uint32_t min_bucket, max_bucket;

inline __m128 dot3(__m128 x, __m128 y, __m128 z, __m128 dx, __m128 dy, __m128 dz) {
    const __m128 xy = _mm_add_ps(_mm_mul_ps(x, dx), _mm_mul_ps(y, dy));
    return _mm_add_ps(xy, _mm_mul_ps(z, dz));
}

template<bool Radial>
void project_depths(
    const float* centers, uint32_t* keys, uint32_t count, float cx, float cy, float cz,
    float dx, float dy, float dz, float bias) {
    const __m128 offset = _mm_set1_ps(Radial ? bias : bias - (cx * dx + cy * dy + cz * dz));
    const __m128 dir_x = _mm_set1_ps(dx), dir_y = _mm_set1_ps(dy), dir_z = _mm_set1_ps(dz);
    const __m128 zero = _mm_setzero_ps();
    const __m128 infinity = _mm_set1_ps(std::numeric_limits<float>::infinity());

    for (uint32_t i = 0; i < count; i += 4, centers += 16) {
        // Transpose four XYZW centers into x, y, z and w vectors.
        __m128 x = _mm_load_ps(centers);
        __m128 y = _mm_load_ps(centers + 4);
        __m128 z = _mm_load_ps(centers + 8);
        __m128 w = _mm_load_ps(centers + 12);
        _MM_TRANSPOSE4_PS(x, y, z, w);
        if constexpr (Radial) {
            x = _mm_sub_ps(x, _mm_set1_ps(cx));
            y = _mm_sub_ps(y, _mm_set1_ps(cy));
            z = _mm_sub_ps(z, _mm_set1_ps(cz));
        }
        __m128 depth = _mm_add_ps(dot3(x, y, z, dir_x, dir_y, dir_z), offset);
        const __m128 visible = _mm_and_ps(_mm_cmpgt_ps(depth, zero), _mm_cmpgt_ps(w, zero));
        if constexpr (Radial) {
            depth = _mm_sqrt_ps(dot3(x, y, z, x, y, z));
        }
        const __m128 key = _mm_or_ps(_mm_and_ps(visible, depth), _mm_andnot_ps(visible, infinity));
        _mm_store_si128(reinterpret_cast<__m128i*>(keys + i), _mm_castps_si128(key));
    }
}

} // namespace

extern "C" {

void reset_buckets() {
    std::memset(buckets, 0, sizeof(buckets));
    min_bucket = BUCKET_COUNT;
    max_bucket = 0;
}

// Both buffers are 16-byte aligned and have space for all four lanes of the final group.
void project_chunk(const float* centers, uint32_t* keys, uint32_t count, float cx, float cy, float cz,
    float dx, float dy, float dz, float bias, bool radial) {
    if (radial) {
        project_depths<true>(centers, keys, count, cx, cy, cz, dx, dy, dz, bias);
    } else {
        project_depths<false>(centers, keys, count, cx, cy, cz, dx, dy, dz, bias);
    }
    // Count the chunk while its depth keys are still in cache.
    uint32_t lo = min_bucket, hi = max_bucket;
    for (uint32_t i = 0; i < count; ++i) {
        if (keys[i] < DEPTH_LIMIT) {
            uint32_t bucket = keys[i] >> KEY_SHIFT;
            ++buckets[bucket];
            if (bucket < lo) {
                lo = bucket;
            }
            if (bucket > hi) {
                hi = bucket;
            }
        }
    }
    min_bucket = lo;
    max_bucket = hi;
}

uint32_t write_order(const uint32_t* keys, uint32_t count, uint32_t* order) {
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
