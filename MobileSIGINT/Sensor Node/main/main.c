#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "esp_event.h"
#include "nvs_flash.h"
#include "cJSON.h"

#include "config.h"
#include "wifi_monitor.h"
#include "ble_scanner.h"
#include "sensor_fusion.h"
#include "transport.h"

static const char *TAG = "sensor";

static QueueHandle_t s_tx_queue = NULL;
static uint32_t s_cycle_count = 0;

static char *build_report(void) {
    fp_store_t *wifi_store = wifi_monitor_get_store();
    fp_store_t *ble_store  = ble_scanner_get_store();

    fused_estimate_t fused = sensor_fusion_fuse(wifi_store, ble_store);
    rssi_profile_t wifi_rssi = fp_store_rssi_profile(wifi_store);
    rssi_profile_t ble_rssi  = fp_store_rssi_profile(ble_store);

    cJSON *root = cJSON_CreateObject();

    cJSON_AddStringToObject(root, "node_id", NODE_ID);
    cJSON_AddNumberToObject(root, "tier", NODE_TIER);
    cJSON_AddNumberToObject(root, "lat", 0.0);
    cJSON_AddNumberToObject(root, "lon", 0.0);
    cJSON_AddNumberToObject(root, "alt_m", 0.0);
    cJSON_AddStringToObject(root, "timestamp", "1970-01-01T00:00:00Z");
    cJSON_AddNumberToObject(root, "window_sec", REPORT_INTERVAL_MS / 1000);
    cJSON_AddNumberToObject(root, "cycle", s_cycle_count);

    cJSON *wifi = cJSON_AddObjectToObject(root, "wifi");
    cJSON_AddNumberToObject(wifi, "unique_fingerprints", fp_store_unique_count(wifi_store));
    cJSON_AddNumberToObject(wifi, "raw_frame_count", fp_store_total_frames(wifi_store));
    cJSON *wr = cJSON_AddObjectToObject(wifi, "rssi_profile");
    cJSON_AddNumberToObject(wr, "strong", wifi_rssi.strong);
    cJSON_AddNumberToObject(wr, "medium", wifi_rssi.medium);
    cJSON_AddNumberToObject(wr, "weak",   wifi_rssi.weak);

    cJSON *ble = cJSON_AddObjectToObject(root, "ble");
    cJSON_AddNumberToObject(ble, "unique_clusters", fp_store_unique_count(ble_store));
    cJSON_AddNumberToObject(ble, "raw_adv_count", fp_store_total_frames(ble_store));
    cJSON *br = cJSON_AddObjectToObject(ble, "rssi_profile");
    cJSON_AddNumberToObject(br, "strong", ble_rssi.strong);
    cJSON_AddNumberToObject(br, "medium", ble_rssi.medium);
    cJSON_AddNumberToObject(br, "weak",   ble_rssi.weak);

    cJSON *f = cJSON_AddObjectToObject(root, "fused");
    cJSON_AddNumberToObject(f, "estimated_entities", fused.estimated_entities);
    cJSON_AddNumberToObject(f, "confidence",
        ((int)(fused.confidence * 100 + 0.5f)) / 100.0);
    cJSON_AddStringToObject(f, "classification", fused.classification);

    char *json = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);
    return json;
}

static void sensor_task(void *param) {
    enum { STATE_WIFI_SCAN, STATE_BLE_SCAN, STATE_REPORT } state;

    ble_scanner_init();
    wifi_monitor_init();

    vTaskDelay(pdMS_TO_TICKS(500));

    s_cycle_count = 1;
    state = STATE_WIFI_SCAN;
    wifi_monitor_start_scan();
    uint32_t phase_start = fp_now_ms();

    while (1) {
        uint32_t now = fp_now_ms();
        uint32_t elapsed = now - phase_start;

        switch (state) {
        case STATE_WIFI_SCAN:
            wifi_monitor_tick();
            if (elapsed >= WIFI_SCAN_DURATION_MS) {
                wifi_monitor_stop_scan();
                state = STATE_BLE_SCAN;
                phase_start = fp_now_ms();
                ble_scanner_start_scan(BLE_SCAN_DURATION_MS);
            }
            break;

        case STATE_BLE_SCAN:
            if (elapsed >= BLE_SCAN_DURATION_MS || ble_scanner_is_complete()) {
                ble_scanner_stop_scan();
                state = STATE_REPORT;
                phase_start = fp_now_ms();
            }
            break;

        case STATE_REPORT: {
            char *json = build_report();
            if (json) {
                if (xQueueSend(s_tx_queue, &json, pdMS_TO_TICKS(100)) != pdTRUE) {
                    ESP_LOGW(TAG, "tx queue full, dropping report");
                    free(json);
                }
            }
            s_cycle_count++;
            state = STATE_WIFI_SCAN;
            phase_start = fp_now_ms();
            wifi_monitor_start_scan();
            break;
        }
        }

        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

void app_main(void) {
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        nvs_flash_erase();
        nvs_flash_init();
    }

    ESP_LOGI(TAG, "========================================");
    ESP_LOGI(TAG, " Expendable Sensor Node — Tier 1");
    ESP_LOGI(TAG, " Defense Technologies LLC");
    ESP_LOGI(TAG, " Node ID: %s", NODE_ID);
    ESP_LOGI(TAG, " Report interval: %u sec", REPORT_INTERVAL_MS / 1000);
    ESP_LOGI(TAG, " WiFi scan: %u sec, BLE scan: %u sec",
             WIFI_SCAN_DURATION_MS / 1000, BLE_SCAN_DURATION_MS / 1000);
    ESP_LOGI(TAG, "========================================");

    esp_event_loop_create_default();

    s_tx_queue = xQueueCreate(TX_QUEUE_DEPTH, sizeof(char *));

    transport_init(s_tx_queue);

    xTaskCreate(halow_task,     "halow",     HALOW_TASK_STACK,     NULL, HALOW_TASK_PRIO,     NULL);
    xTaskCreate(sensor_task,    "sensor",    SENSOR_TASK_STACK,    NULL, SENSOR_TASK_PRIO,     NULL);
    xTaskCreate(transport_task, "transport", TRANSPORT_TASK_STACK, NULL, TRANSPORT_TASK_PRIO,  NULL);
}
