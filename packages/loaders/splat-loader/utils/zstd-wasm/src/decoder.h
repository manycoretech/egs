#pragma once

#include <cstddef>
#include <cstdint>
#include <memory>
#include <new>
#include <string>
#include <zstd.h>

class ZstdStream {
public:
    explicit ZstdStream(size_t chunk_size)
        : output_bytes_(new (std::nothrow) uint8_t[chunk_size]), output_ { output_bytes_.get(), chunk_size, 0 } {}

    bool initialize() { return stream_ && output_bytes_ && !ZSTD_isError(ZSTD_initDStream(stream_.get())); }
    bool at_frame_boundary() const { return hint_ == 0; }
    std::string error_name() const { return ZSTD_getErrorName(hint_); }
    size_t input_capacity() const { return sizeof(input_bytes_); }
    uintptr_t input_ptr() const { return reinterpret_cast<uintptr_t>(input_bytes_); }
    uintptr_t output_ptr() const { return reinterpret_cast<uintptr_t>(output_bytes_.get()); }

    void begin_input(uintptr_t source, size_t size, bool last) {
        compressed_ = { reinterpret_cast<const uint8_t*>(source), size, 0 };
        end_of_feed_ = last;
        pending_ = true;
    }

    int32_t next_output() {
        while (pending_) {
            hint_ = ZSTD_decompressStream(stream_.get(), &output_, &compressed_);
            if (ZSTD_isError(hint_)) {
                return -1;
            }
            const bool full = output_.pos == output_.size;
            pending_ = compressed_.pos < compressed_.size || (full && !at_frame_boundary());
            if (output_.pos && (full || at_frame_boundary() || end_of_feed_)) {
                const auto size = static_cast<int32_t>(output_.pos);
                output_.pos = 0;
                return size;
            }
        }
        return 0;
    }

private:
    std::unique_ptr<ZSTD_DStream, decltype(&ZSTD_freeDStream)> stream_ { ZSTD_createDStream(), ZSTD_freeDStream };
    uint8_t input_bytes_[ZSTD_BLOCKSIZE_MAX];
    std::unique_ptr<uint8_t[]> output_bytes_;
    ZSTD_inBuffer compressed_ {};
    ZSTD_outBuffer output_;
    size_t hint_ = 1;
    bool end_of_feed_ = false;
    bool pending_ = false;
};
