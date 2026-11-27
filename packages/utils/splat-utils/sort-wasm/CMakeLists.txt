cmake_minimum_required(VERSION 3.31.0)
project(splat_utils_sort LANGUAGES CXX)

if(NOT EMSCRIPTEN)
    message(FATAL_ERROR "Activate the Emscripten SDK and run pnpm build:wasm from splat-utils.")
endif()

set(worker_pool_js "${CMAKE_CURRENT_SOURCE_DIR}/src/worker-pool.js")
add_executable(sorter)
target_sources(sorter
    PRIVATE
        src/sort.cpp
        src/thread_pool.cpp
        "${worker_pool_js}"
    PRIVATE FILE_SET sorter_headers
        TYPE HEADERS
        BASE_DIRS "${CMAKE_CURRENT_SOURCE_DIR}/include"
        FILES
            include/center_projection.h
            include/thread_pool.h
)
target_compile_features(sorter PRIVATE cxx_std_20)
target_compile_options(sorter PRIVATE -pthread -msimd128 -msse4.1 -mbulk-memory -ffp-contract=off -fno-exceptions -fno-rtti)
set_target_properties(sorter PROPERTIES
    CXX_EXTENSIONS OFF CXX_SCAN_FOR_MODULES OFF
    OUTPUT_NAME sort SUFFIX ".js"
    LINK_DEPENDS "${worker_pool_js}"
)
set(sort_types "$<TARGET_FILE_DIR:sorter>/sort.d.ts")
target_link_options(sorter PRIVATE
    -pthread -msimd128 -mbulk-memory --no-entry
    -sEXPORTED_FUNCTIONS=_init_sort,_alloc_sort,_sorting_buffer,_ordering_buffer,_invalidate_sorting,_sort_splats,_free
    -sEXPORTED_RUNTIME_METHODS=HEAPU8,startSortWorkers
    -sMODULARIZE=1 -sEXPORT_ES6=1 -sSINGLE_FILE=1 -sENVIRONMENT=web,worker
    -sINCOMING_MODULE_JS_API=mainScriptUrlOrBlob -sFILESYSTEM=0 -sSUPPORT_LONGJMP=0 -sALLOW_MEMORY_GROWTH=1 --closure=1
    "--js-library=${worker_pool_js}"
    "--emit-tsd=${sort_types}"
)
install(FILES "$<TARGET_FILE:sorter>" "${sort_types}" DESTINATION .)
