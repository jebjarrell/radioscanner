#include "ble_scanner.h"
#include "config.h"

#include <string.h>
#include "esp_log.h"
#include "nimble/nimble_port.h"
#include "nimble/nimble_port_freertos.h"
#include "host/ble_hs.h"
#include "host/ble_gap.h"
#include "services/gap/ble_svc_gap.h"
#include "mbedtls/sha256.h"

static const char *TAG = "ble_scan";

static fp_store_t s_store;
static volatile bool s_scan_complete = false;

static bool is_stable_ad_type(uint8_t type) {
    switch (type) {
        case 0x01:
        case 0x02: case 0x03:
        case 0x04: case 0x05:
        case 0x06: case 0x07:
        case 0x0A:
        case 0xFF:
            return true;
        default:
            return false;
    }
}

static void fingerprint_advertisement(const uint8_t *data, uint8_t data_len, int8_t rssi) {
    if (data_len < 3) return;

    mbedtls_sha256_context ctx;
    mbedtls_sha256_init(&ctx);
    mbedtls_sha256_starts(&ctx, 0);

    size_t offset = 0;
    uint16_t stable_fields = 0;

    while (offset < data_len) {
        uint8_t ad_len = data[offset];
        if (ad_len == 0 || offset + 1 + ad_len > data_len) break;

        uint8_t ad_type = data[offset + 1];
        const uint8_t *ad_data = &data[offset + 2];
        uint8_t ad_data_len = ad_len - 1;

        if (is_stable_ad_type(ad_type)) {
            if (ad_type == 0xFF) {
                mbedtls_sha256_update(&ctx, &ad_type, 1);
                uint8_t cid_len = (ad_data_len >= 2) ? 2 : ad_data_len;
                if (cid_len > 0) {
                    mbedtls_sha256_update(&ctx, ad_data, cid_len);
                }
            } else {
                mbedtls_sha256_update(&ctx, &ad_type, 1);
                if (ad_data_len > 0) {
                    mbedtls_sha256_update(&ctx, ad_data, ad_data_len);
                }
            }
            stable_fields++;
        }

        offset += 1 + ad_len;
    }

    if (stable_fields < 1) {
        mbedtls_sha256_free(&ctx);
        return;
    }

    uint8_t full_hash[32];
    mbedtls_sha256_finish(&ctx, full_hash);
    mbedtls_sha256_free(&ctx);

    fp_key_t key;
    memcpy(key.bytes, full_hash, FP_HASH_BYTES);
    fp_store_record(&s_store, &key, rssi);
}

static int ble_gap_event_handler(struct ble_gap_event *event, void *arg) {
    switch (event->type) {
    case BLE_GAP_EVENT_DISC:
        fingerprint_advertisement(
            event->disc.data,
            event->disc.length_data,
            event->disc.rssi
        );
        break;

    case BLE_GAP_EVENT_DISC_COMPLETE:
        s_scan_complete = true;
        ESP_LOGI(TAG, "scan ended — %u unique, %lu adverts",
                 fp_store_unique_count(&s_store),
                 (unsigned long)fp_store_total_frames(&s_store));
        break;

    default:
        break;
    }
    return 0;
}

static void ble_host_task(void *param) {
    nimble_port_run();
    nimble_port_freertos_deinit();
}

static void ble_on_sync(void) {
    ESP_LOGI(TAG, "NimBLE host synced");
}

void ble_scanner_init(void) {
    esp_err_t err = nimble_port_init();
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "nimble_port_init failed: 0x%x", err);
        return;
    }

    ble_hs_cfg.sync_cb = ble_on_sync;

    fp_store_init(&s_store);
    nimble_port_freertos_init(ble_host_task);

    ESP_LOGI(TAG, "initialized, passive scan configured");
}

void ble_scanner_start_scan(uint32_t duration_ms) {
    fp_store_reset_window(&s_store);
    fp_store_expire(&s_store);
    s_scan_complete = false;

    struct ble_gap_disc_params disc_params = {
        .itvl = 0,
        .window = 0,
        .filter_policy = BLE_HCI_CONN_FILT_NO_WL,
        .limited = 0,
        .passive = 1,
        .filter_duplicates = 0,
    };

    int rc = ble_gap_disc(BLE_OWN_ADDR_PUBLIC, (int32_t)duration_ms, &disc_params,
                          ble_gap_event_handler, NULL);
    if (rc != 0) {
        ESP_LOGE(TAG, "failed to start scan: %d", rc);
        s_scan_complete = true;
        return;
    }
    ESP_LOGI(TAG, "scan started for %lu ms", (unsigned long)duration_ms);
}

void ble_scanner_stop_scan(void) {
    if (!s_scan_complete) {
        ble_gap_disc_cancel();
    }
    s_scan_complete = true;
}

bool ble_scanner_is_complete(void) {
    return s_scan_complete;
}

fp_store_t *ble_scanner_get_store(void) {
    return &s_store;
}
