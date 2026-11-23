#include "decoder.h"
#include <emscripten/bind.h>

namespace {

std::unique_ptr<ZstdStream> with_output_chunk_size(size_t chunk_size) {
    if (chunk_size == 0 || chunk_size > INT32_MAX) {
        return nullptr;
    }
    std::unique_ptr<ZstdStream> decoder(new (std::nothrow) ZstdStream(chunk_size));
    if (!decoder || !decoder->initialize()) {
        return nullptr;
    }
    return decoder;
}

EMSCRIPTEN_BINDINGS(zstd) {
    emscripten::class_<ZstdStream>("ZstdDecompressor")
        .class_function("withOutputChunkSize", &with_output_chunk_size)
        .property("input_ptr", &ZstdStream::input_ptr)
        .property("input_capacity", &ZstdStream::input_capacity)
        .property("output_ptr", &ZstdStream::output_ptr)
        .function("begin_input", &ZstdStream::begin_input)
        .function("next_output", &ZstdStream::next_output)
        .function("at_frame_boundary", &ZstdStream::at_frame_boundary)
        .function("error_name", &ZstdStream::error_name);
}

} // namespace
