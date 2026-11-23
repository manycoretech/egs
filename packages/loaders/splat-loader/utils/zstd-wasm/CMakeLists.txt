cmake_minimum_required(VERSION 3.20)
project(splat_loader_zstd LANGUAGES C CXX)

if(NOT EMSCRIPTEN)
    message(FATAL_ERROR "Activate the Emscripten SDK and run pnpm build:wasm from splat-loader.")
endif()

include(FetchContent)
if(POLICY CMP0135)
    cmake_policy(SET CMP0135 NEW)
endif()
set(CMAKE_POLICY_DEFAULT_CMP0077 NEW)
set(ZSTD_BUILD_PROGRAMS OFF)
set(ZSTD_BUILD_TESTS OFF)
set(ZSTD_BUILD_SHARED OFF)
set(ZSTD_BUILD_COMPRESSION OFF)
set(ZSTD_BUILD_DICTBUILDER OFF)
set(ZSTD_LEGACY_SUPPORT OFF)
set(ZSTD_MULTITHREAD_SUPPORT OFF)
FetchContent_Declare(zstd
    URL https://github.com/meta/zstd/releases/download/v1.5.7/zstd-1.5.7.tar.gz
    URL_HASH SHA256=eb33e51f49a15e023950cd7825ca74a4a2b43db8354825ac24fc1b7ee09e6fa3
    SOURCE_SUBDIR build/cmake
)
add_compile_options(-msimd128 -mbulk-memory -flto)
FetchContent_MakeAvailable(zstd)
set_property(DIRECTORY "${zstd_BINARY_DIR}" PROPERTY EXCLUDE_FROM_ALL TRUE)

add_executable(decoder src/bindings.cpp)
target_link_libraries(decoder PRIVATE libzstd_static)
target_compile_features(decoder PRIVATE cxx_std_20)
target_compile_options(decoder PRIVATE -fwasm-exceptions)
set_target_properties(decoder PROPERTIES
    CXX_EXTENSIONS OFF CXX_SCAN_FOR_MODULES OFF
    OUTPUT_NAME zstd SUFFIX ".js"
)
set(zstd_types "$<TARGET_FILE_DIR:decoder>/zstd.d.ts")
target_link_options(decoder PRIVATE
    -msimd128 -mbulk-memory -flto --no-entry -lembind -fwasm-exceptions -sEMBIND_AOT=1 -sDYNAMIC_EXECUTION=0
    -sEXPORTED_RUNTIME_METHODS=HEAPU8
    -sMODULARIZE=1 -sEXPORT_ES6=1 -sSINGLE_FILE=1 -sENVIRONMENT=web,worker
    -sINCOMING_MODULE_JS_API=[] -sMALLOC=emmalloc --closure=1
    -sFILESYSTEM=0 -sSUPPORT_LONGJMP=0 -sALLOW_MEMORY_GROWTH=1 -sINITIAL_HEAP=128KB -sMEMORY_GROWTH_GEOMETRIC_STEP=0
    "--emit-tsd=${zstd_types}"
)
install(FILES "$<TARGET_FILE:decoder>" "${zstd_types}" DESTINATION .)
install(FILES "${zstd_SOURCE_DIR}/LICENSE" DESTINATION . RENAME LICENSE.zstd)
