set(srcs
    "main.c"
    "wifi_monitor.c"
    "ble_scanner.c"
    "sensor_fusion.c"
    "transport.c"
)

idf_component_register(
    SRCS ${srcs}
    INCLUDE_DIRS "."
    PRIV_REQUIRES
        driver
        esp_wifi
        esp_timer
        nvs_flash
        bt
        mbedtls
        json
        esp_netif
        lwip
        morselib
        mm_shims
        mmipal
)
