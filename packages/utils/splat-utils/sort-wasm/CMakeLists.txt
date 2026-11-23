cmake_minimum_required(VERSION 3.20)
project(splat_utils_sort LANGUAGES CXX)

if(NOT EMSCRIPTEN)
    message(FATAL_ERROR "Activate the Emscripten SDK and run pnpm build:wasm from splat-utils.")
endif()

add_executable(sorter src/sort.cpp)
target_compile_features(sorter PRIVATE cxx_std_20)
target_compile_options(sorter PRIVATE -msimd128 -msse2 -mbulk-memory -ffp-contract=off -fno-exceptions -fno-rtti)
set_target_properties(sorter PROPERTIES
    CXX_EXTENSIONS OFF CXX_SCAN_FOR_MODULES OFF
    OUTPUT_NAME sort SUFFIX ".js"
)
set(sort_types "$<TARGET_FILE_DIR:sorter>/sort.d.ts")
target_link_options(sorter PRIVATE
    -msimd128 -mbulk-memory --no-entry
    -sEXPORTED_FUNCTIONS=_sort_chunk_size,_begin_sort,_project_chunk,_write_order,_sort_order
    -sEXPORTED_RUNTIME_METHODS=HEAPF32,HEAPU32
    -sMODULARIZE=1 -sEXPORT_ES6=1 -sSINGLE_FILE=1 -sENVIRONMENT=web,worker
    -sINCOMING_MODULE_JS_API=[] -sFILESYSTEM=0 -sSUPPORT_LONGJMP=0 -sALLOW_MEMORY_GROWTH=1 --closure=1
    "--emit-tsd=${sort_types}"
)
install(FILES "$<TARGET_FILE:sorter>" "${sort_types}" DESTINATION .)
