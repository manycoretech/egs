#include "center_projection.h"
#include "thread_pool.h"
#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <emmintrin.h>
#include <functional>
#include <future>
#include <numeric>
#include <smmintrin.h>
#include <vector>

namespace splat_sort {

constexpr uint32_t KEY_SHIFT = 8;
constexpr uint32_t BUCKET_COUNT = 1u << (31 - KEY_SHIFT);
constexpr uint32_t DEPTH_LIMIT = 0x7f7fffff;
constexpr uint32_t CHUNK_SIZE = 4096;
constexpr uint32_t BAND_SIZE = 1024;
constexpr uint32_t MAX_SORT_THREADS = 4;
using BandTotals = std::array<uint32_t, BUCKET_COUNT / BAND_SIZE>;

struct KeyBlock {
    uint32_t base = UINT32_MAX;
    bool visible = false;
};

struct Partition {
    uint32_t start = 0, end = 0, first = BUCKET_COUNT, last = 0;
    std::vector<KeyBlock> blocks;
    std::vector<uint32_t> histogram, deferred;
    BandTotals bands;
};

std::array<Partition, MAX_SORT_THREADS> partitions;
BandTotals band_offsets;

template<class F>
void parallel_lanes(uint32_t lanes, F&& work) {
    if (lanes == 1) {
        work(0);
        return;
    }
    auto& pool = default_pool();
    std::array<std::future<void>, MAX_SORT_THREADS - 1> pending;
    for (uint32_t lane = 1; lane < lanes; ++lane) {
        pending[lane - 1] = pool.submit_task(std::ref(work), lane);
    }
    work(0);
    for (uint32_t lane = 1; lane < lanes; ++lane) {
        pending[lane - 1].get();
    }
}

template<bool Radial>
KeyBlock project_block(const float* sorting, uint32_t* keys, uint32_t size, const SortView& view, CenterTile* tiles, uint32_t* codes, uint32_t& lowest, uint32_t& highest) {
    if (size % 4 == 0) {
        auto minima = _mm_set1_epi32(-1), maxima = _mm_setzero_si128();
        auto* residues = reinterpret_cast<uint16_t*>(keys);
        project_tiles<Radial>(sorting, residues, size, view, tiles, codes, [&](uint16_t* dest, __m128i depth) {
            minima = _mm_min_epu32(minima, depth);
            maxima = _mm_max_epu32(maxima, depth);
            const auto bins = _mm_and_si128(_mm_srli_epi32(depth, KEY_SHIFT), _mm_set1_epi32(UINT16_MAX));
            _mm_storel_epi64(reinterpret_cast<__m128i*>(dest), _mm_packus_epi32(bins, bins));
        });
        const auto min_pairs = _mm_min_epu32(minima, _mm_srli_si128(minima, 8));
        const auto max_pairs = _mm_max_epu32(maxima, _mm_srli_si128(maxima, 8));
        lowest = _mm_cvtsi128_si32(_mm_min_epu32(min_pairs, _mm_srli_si128(min_pairs, 4)));
        highest = _mm_cvtsi128_si32(_mm_max_epu32(max_pairs, _mm_srli_si128(max_pairs, 4)));
        if (lowest >= DEPTH_LIMIT) {
            return {};
        }
        const uint32_t first = lowest >> KEY_SHIFT, last = highest >> KEY_SHIFT;
        if (highest < DEPTH_LIMIT && last - first <= UINT16_MAX) {
            const uint32_t page = first & ~uint32_t(UINT16_MAX);
            if (last - page <= UINT16_MAX) {
                return { page, true };
            }
            const auto base = _mm_set1_epi16(static_cast<int16_t>(first));
            uint32_t index = 0;
            for (; size - index >= 8; index += 8) {
                auto* dest = reinterpret_cast<__m128i*>(residues + index);
                _mm_storeu_si128(dest, _mm_sub_epi16(_mm_loadu_si128(dest), base));
            }
            for (; index < size; ++index) {
                residues[index] -= static_cast<uint16_t>(first);
            }
            return { first, true };
        }
    }
    project_tiles<Radial>(sorting, keys, size, view, tiles, codes);
    if (size % 4) {
        for (uint32_t index = 0; index < size; ++index) {
            lowest = std::min(lowest, keys[index]);
            highest = std::max(highest, keys[index]);
        }
        if (lowest >= DEPTH_LIMIT) {
            return {};
        }
    }
    if (highest < DEPTH_LIMIT) {
        return { UINT32_MAX, true };
    }
    highest = 0;
    for (uint32_t index = 0; index < size; ++index) {
        if (keys[index] < DEPTH_LIMIT) {
            highest = std::max(highest, keys[index]);
        }
    }
    return { UINT32_MAX, true };
}

void count_block(Partition& part, KeyBlock block, const uint32_t* keys, uint32_t size) {
    auto* counts = part.histogram.data();
    if (block.base != UINT32_MAX) {
        const uint32_t bias = block.base - part.first;
        const auto* bins = reinterpret_cast<const uint16_t*>(keys);
        const uint32_t quarter = size / 4;
        for (uint32_t index = 0; index < quarter; ++index) {
            ++counts[bias + bins[index]];
            ++counts[bias + bins[index + quarter]];
            ++counts[bias + bins[index + 2 * quarter]];
            ++counts[bias + bins[index + 3 * quarter]];
        }
        for (uint32_t index = 4 * quarter; index < size; ++index) {
            ++counts[bias + bins[index]];
        }
    } else {
        for (uint32_t index = 0; index < size; ++index) {
            if (keys[index] < DEPTH_LIMIT) {
                ++counts[(keys[index] >> KEY_SHIFT) - part.first];
            }
        }
    }
}

void prepare_partition(Partition& part, const float* sorting, uint32_t* keys, const SortView& view, bool radial, CenterTile* tiles, uint32_t* codes) {
    uint32_t first = BUCKET_COUNT, last = 0;
    part.blocks.clear();
    part.deferred.clear();
    std::fill(part.histogram.begin(), part.histogram.end(), 0u);
    for (uint32_t start = part.start; start < part.end; start += CHUNK_SIZE) {
        const uint32_t size = std::min(CHUNK_SIZE, part.end - start);
        uint32_t lowest = UINT32_MAX, highest = 0;
        const auto* points = sorting + static_cast<size_t>(start) * 4;
        auto* cache = tiles ? tiles + start / TILE_SIZE : nullptr;
        auto* packed = codes ? codes + start : nullptr;
        const auto block = radial ? project_block<true>(points, keys + start, size, view, cache, packed, lowest, highest)
                                  : project_block<false>(points, keys + start, size, view, cache, packed, lowest, highest);
        part.blocks.push_back(block);
        if (!block.visible) {
            continue;
        }
        lowest >>= KEY_SHIFT;
        highest >>= KEY_SHIFT;
        first = std::min(first, lowest);
        last = std::max(last, highest);
        if (lowest >= part.first && highest - part.first < part.histogram.size()) {
            count_block(part, block, keys + start, size);
        } else {
            part.deferred.push_back(start);
        }
    }
    auto& histogram = part.histogram;
    if (first >= part.first + histogram.size() || last < part.first) {
        histogram.clear();
    } else if (first > part.first) {
        histogram.erase(histogram.begin(), histogram.begin() + (first - part.first));
    } else if (first < part.first) {
        histogram.resize(std::min<size_t>(histogram.size(), last + 1 - part.first));
        histogram.insert(histogram.begin(), part.first - first, 0u);
    }
    histogram.resize(first > last ? 0 : last - first + 1);
    part.first = first;
    part.last = last;
    for (const uint32_t start : part.deferred) {
        count_block(part, part.blocks[(start - part.start) / CHUNK_SIZE], keys + start, std::min(CHUNK_SIZE, part.end - start));
    }
    for (uint32_t start = first; start <= last;) {
        const uint32_t band = start / BAND_SIZE, end = std::min(last + 1, (band + 1) * BAND_SIZE);
        const auto counts = part.histogram.begin();
        part.bands[band] = std::accumulate(counts + (start - first), counts + (end - first), 0u);
        start = end;
    }
}

uint32_t prefix_partitions(uint32_t threads) {
    uint32_t first = BUCKET_COUNT, last = 0;
    for (uint32_t lane = 0; lane < threads; ++lane) {
        first = std::min(first, partitions[lane].first);
        last = std::max(last, partitions[lane].last);
    }
    if (first > last) {
        return 0;
    }
    const uint32_t first_band = first / BAND_SIZE, last_band = last / BAND_SIZE;
    uint32_t active = 0;
    for (uint32_t band = last_band + 1; band > first_band;) {
        --band;
        band_offsets[band] = active;
        for (uint32_t lane = 0; lane < threads; ++lane) {
            const auto& part = partitions[lane];
            if (band >= part.first / BAND_SIZE && band <= part.last / BAND_SIZE) {
                active += part.bands[band];
            }
        }
    }
    parallel_lanes(threads, [&](uint32_t lane) {
        for (uint32_t band = first_band + lane; band <= last_band; band += threads) {
            const uint32_t start = band * BAND_SIZE;
            uint32_t cursor = band_offsets[band];
            for (uint32_t key = std::min(start + BAND_SIZE, last + 1); key > std::max(start, first);) {
                --key;
                for (uint32_t index = 0; index < threads; ++index) {
                    auto& part = partitions[index];
                    if (key >= part.first && key <= part.last) {
                        auto& cell = part.histogram[key - part.first];
                        const uint32_t count = cell;
                        cell = cursor;
                        cursor += count;
                    }
                }
            }
        }
    });
    return active;
}

void scatter_partition(Partition& part, const uint32_t* __restrict keys, uint32_t* __restrict ordering) {
    auto* cursors = part.histogram.data();
    uint32_t start = part.start;
    for (const KeyBlock block : part.blocks) {
        const uint32_t size = std::min(CHUNK_SIZE, part.end - start);
        if (block.base != UINT32_MAX) {
            const uint32_t bias = block.base - part.first;
            const auto* bins = reinterpret_cast<const uint16_t*>(keys + start);
            uint32_t index = 0;
            for (; size - index >= 4; index += 4) {
                const auto first = cursors[bias + bins[index]]++;
                const auto second = cursors[bias + bins[index + 1]]++;
                const auto third = cursors[bias + bins[index + 2]]++;
                const auto fourth = cursors[bias + bins[index + 3]]++;
                ordering[first] = start + index;
                ordering[second] = start + index + 1;
                ordering[third] = start + index + 2;
                ordering[fourth] = start + index + 3;
            }
            for (; index < size; ++index) {
                ordering[cursors[bias + bins[index]]++] = start + index;
            }
        } else if (block.visible) {
            for (uint32_t index = start; index < start + size; ++index) {
                if (keys[index] < DEPTH_LIMIT) {
                    ordering[cursors[(keys[index] >> KEY_SHIFT) - part.first]++] = index;
                }
            }
        }
        start += size;
    }
}

uint32_t sort_partitions(uint32_t count, const float* sorting, uint32_t* keys, uint32_t* ordering, const SortView& view, bool radial, CenterTile* tiles, uint32_t* codes) {
    const uint32_t tiles_count = tile_count(count);
    const uint32_t available = static_cast<uint32_t>(default_pool().thread_count()) + 1;
    const uint32_t threads = std::min(available, 1 + (count - 1) / CHUNK_SIZE);
    parallel_lanes(threads, [&](uint32_t lane) {
        auto& part = partitions[lane];
        part.start = std::min(count, tiles_count * lane / threads * TILE_SIZE);
        part.end = std::min(count, tiles_count * (lane + 1) / threads * TILE_SIZE);
        prepare_partition(part, sorting, keys, view, radial, tiles, codes);
    });
    const uint32_t active = prefix_partitions(threads);
    if (active) {
        parallel_lanes(threads, [&](uint32_t lane) { scatter_partition(partitions[lane], keys, ordering); });
    }
    return active;
}

} // namespace splat_sort

using namespace splat_sort;

struct alignas(16) SortRegion {
    float* sorting;
    uint32_t* keys;
    uint32_t* ordering;
    CenterTile* tiles;
    uint32_t* codes;
    uint32_t capacity;
};

static SortRegion* allocate_region(uint64_t bytes) {
    if (bytes > SIZE_MAX) {
        return nullptr;
    }
    return static_cast<SortRegion*>(std::aligned_alloc(16, static_cast<size_t>(bytes)));
}

extern "C" {

void init_sort(uint32_t helpers) {
    configure_default_pool(std::min(helpers, MAX_SORT_THREADS - 1));
    default_pool();
}

SortRegion* alloc_sort(uint32_t capacity) {
    const uint64_t padded = (static_cast<uint64_t>(capacity) + 3) & ~uint64_t(3);
    const uint64_t base_bytes = sizeof(SortRegion) + padded * (4 * sizeof(float) + 2 * sizeof(uint32_t));
    const size_t tiles = tile_count(capacity);
    auto* region = allocate_region(base_bytes + tiles * sizeof(CenterTile) + padded * sizeof(uint32_t));
    const bool cached = region != nullptr;
    if (!region) {
        region = allocate_region(base_bytes);
    }
    if (!region) {
        return nullptr;
    }

    region->capacity = capacity;
    region->sorting = reinterpret_cast<float*>(region + 1);
    region->keys = reinterpret_cast<uint32_t*>(region->sorting + 4 * padded);
    region->ordering = region->keys + padded;
    region->tiles = cached ? reinterpret_cast<CenterTile*>(region->ordering + padded) : nullptr;
    region->codes = cached ? reinterpret_cast<uint32_t*>(region->tiles + tiles) : nullptr;
    if (cached) {
        std::memset(region->tiles, 0, tiles * sizeof(CenterTile));
    }
    return region;
}

float* sorting_buffer(SortRegion* region) { return region->sorting; }
uint32_t* ordering_buffer(SortRegion* region) { return region->ordering; }

void invalidate_sorting(SortRegion* region, uint32_t start, uint32_t end) {
    if (!region->tiles || start == end) {
        return;
    }
    for (uint32_t tile = start / TILE_SIZE; tile < tile_count(end); ++tile) {
        region->tiles[tile].count = 0;
    }
}

uint32_t sort_splats(SortRegion* region, uint32_t count, float cx, float cy, float cz, float dx, float dy, float dz, float bias, bool radial, bool use_cache) {
    if (!use_cache) {
        invalidate_sorting(region, 0, region->capacity);
    }
    if (!count) {
        return 0;
    }
    const SortView view(cx, cy, cz, dx, dy, dz, bias, radial);
    return sort_partitions(count, region->sorting, region->keys, region->ordering, view, radial, use_cache ? region->tiles : nullptr, use_cache ? region->codes : nullptr);
}
}
