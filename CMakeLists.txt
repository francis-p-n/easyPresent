cmake_minimum_required(VERSION 3.15)
project(propresenter_render)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Include node-addon-api and cmake-js directories
# cmake-js injects CMAKE_JS_INC and CMAKE_JS_SRC into CMake variables.
include_directories(${CMAKE_JS_INC})

# Include node-addon-api directory (relative to project root if installed locally)
# Typically: node_modules/node-addon-api
include_directories("node_modules/node-addon-api")

# Source files
file(GLOB SOURCE_FILES
    "native/src/*.h"
    "native/src/*.cc"
)

# Declare target as a shared library (.node)
add_library(${PROJECT_NAME} SHARED ${SOURCE_FILES} ${CMAKE_JS_SRC})

# Link required Windows OS libraries for GPU compositing and typography
# - d3d11: Direct3D 11 Graphics Pipeline
# - dxgi: DirectX Graphics Infrastructure (shared GPU texture handles)
# - d2d1: Direct2D Vector Graphics
# - dwrite: DirectWrite Text Layout and Rendering
# - CMAKE_JS_LIB: Node.js/Electron import library provided by cmake-js
target_link_libraries(${PROJECT_NAME}
    d3d11.lib
    dxgi.lib
    d2d1.lib
    dwrite.lib
    ${CMAKE_JS_LIB}
)

# Format target naming properties to load directly as a Node.js binary module
set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")
