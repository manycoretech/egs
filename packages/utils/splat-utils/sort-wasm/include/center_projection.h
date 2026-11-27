#pragma once

#include <algorithm>
#include <bit>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <emmintrin.h>
#include <limits>
#include <smmintrin.h>
#include <xmmintrin.h>

namespace splat_sort {

inline __m128 dot_product(__m128 x, __m128 y, __m128 z, __m128 dx, __m128 dy, __m128 dz) {
    const __m128 xy = _mm_add_ps(_mm_mul_ps(x, dx), _mm_mul_ps(y, dy));
    return _mm_add_ps(xy, _mm_mul_ps(z, dz));
}

struct CenterBatch {
    __m128 x, y, z, enabled;
};

inline CenterBatch load_center_batch(const float* sorting) {
    __m128 x = _mm_load_ps(sorting), y = _mm_load_ps(sorting + 4);
    __m128 z = _mm_load_ps(sorting + 8), w = _mm_load_ps(sorting + 12);
    _MM_TRANSPOSE4_PS(x, y, z, w);
    return { x, y, z, _mm_cmpgt_ps(w, _mm_setzero_ps()) };
}

struct SortView {
    __m128 cx, cy, cz, dx, dy, dz, offset;

    SortView(float x, float y, float z, float dir_x, float dir_y, float dir_z, float bias, bool radial)
        : cx(_mm_set1_ps(x)), cy(_mm_set1_ps(y)), cz(_mm_set1_ps(z)),
          dx(_mm_set1_ps(dir_x)), dy(_mm_set1_ps(dir_y)), dz(_mm_set1_ps(dir_z)),
          offset(_mm_set1_ps(radial ? bias : bias - (x * dir_x + y * dir_y + z * dir_z))) {}
};

struct StoreDepths {
    void operator()(uint32_t* keys, __m128i depths) const {
        _mm_store_si128(reinterpret_cast<__m128i*>(keys), depths);
    }
};

template<bool Radial, bool Inside = false, class Key, class ReadBatch, class Store = StoreDepths>
void project_depths(Key* keys, uint32_t count, const SortView& view, ReadBatch read, Store store = {}) {
    const __m128 infinity = _mm_set1_ps(std::numeric_limits<float>::infinity());
    for (uint32_t index = 0; index < count; index += 4) {
        auto [x, y, z, enabled] = read(index);
        if constexpr (Radial) {
            x = _mm_sub_ps(x, view.cx);
            y = _mm_sub_ps(y, view.cy);
            z = _mm_sub_ps(z, view.cz);
        }
        __m128 depth, visible;
        if constexpr (!Inside || !Radial) {
            depth = _mm_add_ps(dot_product(x, y, z, view.dx, view.dy, view.dz), view.offset);
            if constexpr (!Inside) {
                visible = _mm_and_ps(_mm_cmpgt_ps(depth, _mm_setzero_ps()), enabled);
            }
        }
        if constexpr (Radial) {
            depth = _mm_sqrt_ps(dot_product(x, y, z, x, y, z));
        }
        if constexpr (!Inside) {
            depth = _mm_or_ps(_mm_and_ps(visible, depth), _mm_andnot_ps(visible, infinity));
        }
        store(keys + index, _mm_castps_si128(depth));
    }
}

constexpr uint32_t TILE_SIZE = 256;
constexpr uint32_t AXIS_BITS = 10;
constexpr uint32_t LOW_BITS = 23 - AXIS_BITS;
constexpr uint32_t DELTA_MASK = ((1u << AXIS_BITS) - 1) << LOW_BITS;

struct CenterTile {
    uint32_t base[3];
    uint16_t count;
    bool packed;
    bool can_test_plane;

    bool prepare(const float* sorting, uint32_t size) {
        uint32_t difference = 0;
        for (uint32_t axis = 0; axis < 3; ++axis) {
            base[axis] = std::bit_cast<uint32_t>(sorting[axis]) - ((1u << (AXIS_BITS - 1)) << LOW_BITS);
            difference |= std::bit_cast<uint32_t>(sorting[(size - 1) * 4 + axis]) - base[axis];
        }
        return !(difference & ~DELTA_MASK);
    }
};

template<bool Radial>
bool tile_in_front(const CenterTile& tile, const SortView& view) {
    if (!tile.can_test_plane) {
        return false;
    }
    const auto base_bits = _mm_setr_epi32(tile.base[0], tile.base[1], tile.base[2], 0);
    const auto base = _mm_castsi128_ps(base_bits);
    const auto end = _mm_castsi128_ps(_mm_add_epi32(base_bits, _mm_setr_epi32(DELTA_MASK, DELTA_MASK, DELTA_MASK, 0)));
    const auto direction = _mm_setr_ps(_mm_cvtss_f32(view.dx), _mm_cvtss_f32(view.dy), _mm_cvtss_f32(view.dz), 0);
    const auto reversed = _mm_xor_ps(base, direction);
    auto first = _mm_blendv_ps(base, end, reversed);
    auto last = _mm_blendv_ps(end, base, reversed);
    if constexpr (Radial) {
        const auto eye = _mm_setr_ps(_mm_cvtss_f32(view.cx), _mm_cvtss_f32(view.cy), _mm_cvtss_f32(view.cz), 0);
        first = _mm_sub_ps(first, eye);
        last = _mm_sub_ps(last, eye);
    }
    const auto project = [&](__m128 corner) {
        alignas(16) float terms[4];
        _mm_store_ps(terms, _mm_mul_ps(corner, direction));
        return ((terms[0] + terms[1]) + terms[2]) + _mm_cvtss_f32(view.offset);
    };
    return project(first) > 0 && std::isfinite(project(last));
}
struct TileCoordinates {
    __m128i base_x, base_y, base_z;

    explicit TileCoordinates(const CenterTile& tile)
        : base_x(_mm_set1_epi32(tile.base[0])), base_y(_mm_set1_epi32(tile.base[1])),
          base_z(_mm_set1_epi32(tile.base[2])) {}

    __m128i encode(const CenterBatch& points, __m128i& used_bits) const {
        const auto x = _mm_sub_epi32(_mm_castps_si128(points.x), base_x);
        const auto y = _mm_sub_epi32(_mm_castps_si128(points.y), base_y);
        const auto z = _mm_sub_epi32(_mm_castps_si128(points.z), base_z);
        used_bits = _mm_or_si128(used_bits, _mm_or_si128(x, _mm_or_si128(y, z)));
        const auto xy = _mm_or_si128(_mm_srli_epi32(x, LOW_BITS), _mm_srli_epi32(y, LOW_BITS - AXIS_BITS));
        const auto enabled = _mm_and_si128(_mm_castps_si128(points.enabled), _mm_set1_epi32(INT32_MIN));
        return _mm_or_si128(xy, _mm_or_si128(_mm_slli_epi32(z, 2 * AXIS_BITS - LOW_BITS), enabled));
    }

    CenterBatch decode(__m128i codes) const {
        const auto mask = _mm_set1_epi32(DELTA_MASK);
        const auto x = _mm_and_si128(_mm_slli_epi32(codes, LOW_BITS), mask);
        const auto y = _mm_and_si128(_mm_slli_epi32(codes, LOW_BITS - AXIS_BITS), mask);
        const auto z = _mm_and_si128(_mm_srli_epi32(codes, 2 * AXIS_BITS - LOW_BITS), mask);
        return { _mm_castsi128_ps(_mm_add_epi32(base_x, x)), _mm_castsi128_ps(_mm_add_epi32(base_y, y)),
            _mm_castsi128_ps(_mm_add_epi32(base_z, z)), _mm_castsi128_ps(_mm_srai_epi32(codes, 31)) };
    }
};

uint32_t tile_count(uint32_t capacity) {
    return capacity / TILE_SIZE + (capacity % TILE_SIZE != 0);
}

template<bool Radial, class Key, class Store = StoreDepths>
void project_tiles(const float* sorting, Key* keys, uint32_t count, const SortView& view, CenterTile* tiles, uint32_t* codes, Store store = {}) {
    if (!tiles) {
        project_depths<Radial>(keys, count, view, [sorting](uint32_t index) { return load_center_batch(sorting + index * 4); }, store);
        return;
    }
    for (uint32_t start = 0; start < count; start += TILE_SIZE) {
        const uint32_t size = std::min(TILE_SIZE, count - start);
        const float* points = sorting + start * 4;
        CenterTile& tile = tiles[start / TILE_SIZE];
        const auto read = [points](uint32_t index) { return load_center_batch(points + index * 4); };
        if (tile.count != size) {
            tile.count = size;
            tile.packed = tile.prepare(points, size);
            if (tile.packed) {
                const TileCoordinates coordinates(tile);
                auto used_bits = _mm_setzero_si128();
                auto enabled = _mm_castsi128_ps(_mm_set1_epi32(-1));
                project_depths<Radial>(keys + start, size, view, [&](uint32_t index) {
                    const CenterBatch batch = read(index);
                    enabled = _mm_and_ps(enabled, batch.enabled);
                    _mm_storeu_si128(reinterpret_cast<__m128i*>(codes + start + index), coordinates.encode(batch, used_bits));
                    return batch; }, store);
                const auto base = _mm_setr_epi32(tile.base[0], tile.base[1], tile.base[2], 0);
                const auto end = _mm_add_epi32(base, _mm_setr_epi32(DELTA_MASK, DELTA_MASK, DELTA_MASK, 0));
                const auto magnitude = _mm_set1_epi32(INT32_MAX);
                const auto extrema = _mm_max_epu32(_mm_and_si128(base, magnitude), _mm_and_si128(end, magnitude));
                const auto finite = _mm_cmplt_epi32(extrema, _mm_set1_epi32(0x7f800000));
                tile.can_test_plane = _mm_movemask_ps(enabled) == 0xf &&
                                      _mm_movemask_ps(_mm_castsi128_ps(_mm_xor_si128(base, end))) == 0 &&
                                      _mm_movemask_ps(_mm_castsi128_ps(finite)) == 0xf;
                tile.packed = _mm_testz_si128(used_bits, _mm_set1_epi32(~DELTA_MASK));
                continue;
            }
        }
        if (tile.packed) {
            const TileCoordinates coordinates(tile);
            const auto decode = [&](uint32_t index) {
                return coordinates.decode(_mm_loadu_si128(reinterpret_cast<const __m128i*>(codes + start + index)));
            };
            if (tile_in_front<Radial>(tile, view)) {
                project_depths<Radial, true>(keys + start, size, view, decode, store);
                continue;
            }
            project_depths<Radial>(keys + start, size, view, decode, store);
        } else {
            project_depths<Radial>(keys + start, size, view, read, store);
        }
    }
}
} // namespace splat_sort
