cmake_minimum_required(VERSION 3.20)

project(splat_utils_simd LANGUAGES CXX)

if(NOT EMSCRIPTEN)
    message(FATAL_ERROR "Configure with emcmake cmake and the Ninja generator. See ../README.md.")
endif()

add_executable(sort src/sort.cpp)
set_target_properties(sort PROPERTIES
    COMPILE_FEATURES cxx_std_20
    CXX_EXTENSIONS OFF
    # Native sources use C++20 without importing C++ modules.
    CXX_SCAN_FOR_MODULES OFF
    OUTPUT_NAME "sort-module"
    SUFFIX ".js"
    COMPILE_OPTIONS "-msimd128;-mbulk-memory;-ffp-contract=off;-fno-exceptions;-fno-rtti"
    # Emscripten initializes the module and maintains its allocator and heap views.
    LINK_OPTIONS "-msimd128;-mbulk-memory;--no-entry;-sMODULARIZE=1;-sEXPORT_ES6=1;-sENVIRONMENT=web,worker;-sALLOW_MEMORY_GROWTH=1;-sSUPPORT_LONGJMP=0;-sFILESYSTEM=0;-sINCOMING_MODULE_JS_API=instantiateWasm;-sEXPORTED_FUNCTIONS=_reset_buckets,_project_chunk,_write_order,_malloc,_realloc;-sEXPORTED_RUNTIME_METHODS=HEAPF32,HEAPU32;--emit-tsd=sort-module.d.ts"
)
