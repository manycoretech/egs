#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <emmintrin.h>
#include <limits>

namespace {

constexpr uint32_t KEY_SHIFT = 8;
constexpr uint32_t BUCKET_COUNT = 1u << (31 - KEY_SHIFT);
constexpr uint32_t DEPTH_LIMIT = 0x7f7fffff;
static uint32_t buckets[BUCKET_COUNT];
static uint32_t min_bucket, max_bucket;

constexpr uint32_t CHUNK_SIZE = 4096;
constexpr size_t CHUNK_BYTES = CHUNK_SIZE * 4 * sizeof(float);

class SortBuffer {
public:
    ~SortBuffer() { std::free(storage_); }

    float* reserve(uint32_t count) {
        const uint64_t key_slots = (static_cast<uint64_t>(count) + 3) / 4 * 4;
        const uint64_t bytes = CHUNK_BYTES + (key_slots + count) * sizeof(uint32_t);
        constexpr uintptr_t padding = alignof(__m128) - 1;
        if (bytes > capacity_) {
            if (bytes > std::numeric_limits<size_t>::max() - padding) {
                return nullptr;
            }
            void* next = std::realloc(storage_, static_cast<size_t>(bytes) + padding);
            if (!next) {
                return nullptr;
            }
            storage_ = next;
            capacity_ = static_cast<size_t>(bytes);
            centers_ = reinterpret_cast<float*>((reinterpret_cast<uintptr_t>(storage_) + padding) & ~padding);
            keys_ = reinterpret_cast<uint32_t*>(centers_ + CHUNK_SIZE * 4);
        }
        order_ = keys_ + static_cast<size_t>(key_slots);
        return centers_;
    }

    float* centers_ = nullptr;
    uint32_t* keys_ = nullptr;
    uint32_t* order_ = nullptr;

private:
    void* storage_ = nullptr;
    size_t capacity_ = 0;
};

SortBuffer buffer;

inline __m128 dot_product(__m128 x, __m128 y, __m128 z, __m128 dx, __m128 dy, __m128 dz) {
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
        __m128 depth = _mm_add_ps(dot_product(x, y, z, dir_x, dir_y, dir_z), offset);
        const __m128 visible = _mm_and_ps(_mm_cmpgt_ps(depth, zero), _mm_cmpgt_ps(w, zero));
        if constexpr (Radial) {
            depth = _mm_sqrt_ps(dot_product(x, y, z, x, y, z));
        }
        const __m128 key = _mm_or_ps(_mm_and_ps(visible, depth), _mm_andnot_ps(visible, infinity));
        _mm_store_si128(reinterpret_cast<__m128i*>(keys + i), _mm_castps_si128(key));
    }
}

} // namespace

extern "C" {

uint32_t sort_chunk_size() {
    return CHUNK_SIZE;
}

float* begin_sort(uint32_t count) {
    float* centers = buffer.reserve(count);
    if (!centers) {
        return nullptr;
    }
    std::memset(buckets, 0, sizeof(buckets));
    min_bucket = BUCKET_COUNT;
    max_bucket = 0;
    return centers;
}

// Both buffers are 16-byte aligned and have space for all four lanes of the final group.
void project_chunk(uint32_t start, uint32_t count, float cx, float cy, float cz,
    float dx, float dy, float dz, float bias, bool radial) {
    uint32_t* keys = buffer.keys_ + start;
    if (radial) {
        project_depths<true>(buffer.centers_, keys, count, cx, cy, cz, dx, dy, dz, bias);
    } else {
        project_depths<false>(buffer.centers_, keys, count, cx, cy, cz, dx, dy, dz, bias);
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

uint32_t write_order(uint32_t count) {
    uint32_t active_count = 0;
    for (uint32_t bucket = max_bucket + 1; bucket > min_bucket;) {
        uint32_t size = buckets[--bucket];
        buckets[bucket] = active_count;
        active_count += size;
    }
    for (uint32_t i = 0; i < count; ++i) {
        const uint32_t key = buffer.keys_[i];
        if (key < DEPTH_LIMIT) {
            buffer.order_[buckets[key >> KEY_SHIFT]++] = i;
        }
    }
    return active_count;
}

const uint32_t* sort_order() {
    return buffer.order_;
}
}
