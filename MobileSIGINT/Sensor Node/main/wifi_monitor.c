#include "wifi_monitor.h"
#include "config.h"

#include <string.h>
#include "esp_wifi.h"
#include "esp_log.h"
#include "mbedtls/sha256.h"

static const char *TAG = "wifi_mon";

static fp_store_t s_store;
static uint8_t    s_current_channel = WIFI_CHANNEL_MIN;
static uint32_t   s_last_hop = 0;
static bool       s_scanning = false;

static bool extract_fingerprint(const uint8_t *frame, uint16_t len, fp_key_t *out) {
    if (len < 26) return false;

    const uint8_t *tagged = &frame[24];
    uint16_t tagged_len = len - 24;

    mbedtls_sha256_context ctx;
    mbedtls_sha256_init(&ctx);
    mbedtls_sha256_starts(&ctx, 0);

    uint16_t offset = 0;
    uint16_t ie_count = 0;

    while (offset + 2 <= tagged_len) {
        uint8_t tag    = tagged[offset];
        uint8_t ie_len = tagged[offset + 1];

        if (offset + 2 + ie_len > tagged_len) break;

        if (tag != 0) {
            mbedtls_sha256_update(&ctx, &tagged[offset], 2 + ie_len);
            ie_count++;
        }
        offset += 2 + ie_len;
    }

    if (ie_count < 2) {
        mbedtls_sha256_free(&ctx);
        return false;
    }

    uint8_t full_hash[32];
    mbedtls_sha256_finish(&ctx, full_hash);
    mbedtls_sha256_free(&ctx);

    memcpy(out->bytes, full_hash, FP_HASH_BYTES);
    return true;
}

static void sniffer_callback(void *buf, wifi_promiscuous_pkt_type_t type) {
    if (type != WIFI_PKT_MGMT) return;

    const wifi_promiscuous_pkt_t *pkt = (const wifi_promiscuous_pkt_t *)buf;
    const uint8_t *frame = pkt->payload;
    uint16_t len = pkt->rx_ctrl.sig_len;

    uint8_t subtype = (frame[0] >> 4) & 0x0F;
    if (subtype != 4) return;

    int8_t rssi = pkt->rx_ctrl.rssi;

    fp_key_t key;
    if (extract_fingerprint(frame, len, &key)) {
        fp_store_record(&s_store, &key, rssi);
    }
}

void wifi_monitor_init(void) {
    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    esp_wifi_init(&cfg);
    esp_wifi_set_storage(WIFI_STORAGE_RAM);
    esp_wifi_set_mode(WIFI_MODE_STA);
    esp_wifi_start();

    esp_wifi_set_promiscuous_rx_cb(sniffer_callback);

    wifi_promiscuous_filter_t filter = {
        .filter_mask = WIFI_PROMIS_FILTER_MASK_MGMT
    };
    esp_wifi_set_promiscuous_filter(&filter);

    fp_store_init(&s_store);
    ESP_LOGI(TAG, "initialized, promiscuous callback registered");
}

void wifi_monitor_start_scan(void) {
    fp_store_reset_window(&s_store);
    fp_store_expire(&s_store);
    s_current_channel = WIFI_CHANNEL_MIN;
    s_last_hop = fp_now_ms();
    esp_wifi_set_channel(s_current_channel, WIFI_SECOND_CHAN_NONE);
    esp_wifi_set_promiscuous(true);
    s_scanning = true;
    ESP_LOGI(TAG, "scan started");
}

void wifi_monitor_stop_scan(void) {
    esp_wifi_set_promiscuous(false);
    s_scanning = false;
    ESP_LOGI(TAG, "scan stopped — %u unique, %lu frames",
             fp_store_unique_count(&s_store),
             (unsigned long)fp_store_total_frames(&s_store));
}

fp_store_t *wifi_monitor_get_store(void) {
    return &s_store;
}

void wifi_monitor_tick(void) {
    if (!s_scanning || !WIFI_CHANNEL_HOP) return;
    uint32_t now = fp_now_ms();
    if ((now - s_last_hop) >= WIFI_CHANNEL_DWELL_MS) {
        s_current_channel++;
        if (s_current_channel > WIFI_CHANNEL_MAX) {
            s_current_channel = WIFI_CHANNEL_MIN;
        }
        esp_wifi_set_channel(s_current_channel, WIFI_SECOND_CHAN_NONE);
        s_last_hop = now;
    }
}
