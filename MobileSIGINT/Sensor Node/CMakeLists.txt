cmake_minimum_required(VERSION 3.16)

if(NOT DEFINED ENV{MMIOT_ROOT})
    message(FATAL_ERROR "MMIOT_ROOT environment variable must be set to the mm-iot-esp32 root directory")
endif()

message(STATUS "MMIOT_ROOT: $ENV{MMIOT_ROOT}")

# Required by mmipal link status callback (matches SDK examples)
add_compile_definitions(LWIP_NETIF_LINK_CALLBACK=1)

if(DEFINED COUNTRY_CODE)
    message(STATUS "COUNTRY_CODE: ${COUNTRY_CODE}")
    add_compile_definitions(COUNTRY_CODE="${COUNTRY_CODE}")
else()
    add_compile_definitions(COUNTRY_CODE="US")
endif()

include($ENV{IDF_PATH}/tools/cmake/project.cmake)
project(sensor_node)
