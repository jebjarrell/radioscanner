#include "transport.h"
#include "config.h"

#include <string.h>
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_event.h"
#include "lwip/sockets.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "freertos/semphr.h"
#include "esp_heap_caps.h"

#include "mmhal.h"
#include "mmwlan.h"
#include "mmwlan_regdb.def"
#include "mmipal.h"

static const char *TAG = "transport";

static QueueHandle_t s_tx_queue = NULL;
static volatile bool s_halow_connected = false;
static SemaphoreHandle_t s_link_sem = NULL;

/* ── Store-and-forward ring buffer in PSRAM ── */
typedef struct {
    char **entries;
    int    head;
    int    tail;
    int    count;
    int    capacity;
} ring_buf_t;

static ring_buf_t s_ring;

static void ring_init(ring_buf_t *r, int capacity) {
    r->entries = heap_caps_calloc(capacity, sizeof(char *), MALLOC_CAP_SPIRAM);
    if (!r->entries) {
        r->entries = calloc(capacity, sizeof(char *));
    }
    r->head = 0;
    r->tail = 0;
    r->count = 0;
    r->capacity = capacity;
}

static void ring_push(ring_buf_t *r, char *msg) {
    if (r->count >= r->capacity) {
        free(r->entries[r->tail]);
        r->entries[r->tail] = NULL;
        r->tail = (r->tail + 1) % r->capacity;
        r->count--;
    }
    size_t len = strlen(msg) + 1;
    char *copy = heap_caps_malloc(len, MALLOC_CAP_SPIRAM);
    if (!copy) copy = malloc(len);
    if (copy) {
        memcpy(copy, msg, len);
        free(msg);
        msg = copy;
    }
    r->entries[r->head] = msg;
    r->head = (r->head + 1) % r->capacity;
    r->count++;
}

static char *ring_pop(ring_buf_t *r) {
    if (r->count == 0) return NULL;
    char *msg = r->entries[r->tail];
    r->entries[r->tail] = NULL;
    r->tail = (r->tail + 1) % r->capacity;
    r->count--;
    return msg;
}

/* ── HaLow link state callback ── */
static void halow_link_state_cb(enum mmwlan_link_state state, void *arg) {
    if (state == MMWLAN_LINK_UP) {
        ESP_LOGI(TAG, "HaLow link UP");
        s_halow_connected = true;
        if (s_link_sem) xSemaphoreGive(s_link_sem);
    } else {
        ESP_LOGW(TAG, "HaLow link DOWN");
        s_halow_connected = false;
    }
}

/* ── UDP send helper ── */
static int udp_send(const char *json, size_t len) {
    struct sockaddr_in dest = {
        .sin_family = AF_INET,
        .sin_port = htons(AGGREGATOR_PORT),
    };
    inet_aton(AGGREGATOR_IP, &dest.sin_addr);

    int sock = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
    if (sock < 0) {
        ESP_LOGE(TAG, "socket create failed: errno %d", errno);
        return -1;
    }

    struct timeval tv = { .tv_sec = 2, .tv_usec = 0 };
    setsockopt(sock, SOL_SOCKET, SO_SNDTIMEO, &tv, sizeof(tv));

    int rc = sendto(sock, json, len, 0,
                    (struct sockaddr *)&dest, sizeof(dest));
    close(sock);

    if (rc < 0) {
        ESP_LOGE(TAG, "sendto failed: errno %d", errno);
        return -1;
    }
    return 0;
}

/* ── Flush buffered reports ── */
static void flush_ring(void) {
    int flushed = 0;
    while (s_ring.count > 0 && s_halow_connected) {
        char *msg = ring_pop(&s_ring);
        if (!msg) break;
        if (udp_send(msg, strlen(msg)) != 0) {
            ring_push(&s_ring, msg);
            break;
        }
        free(msg);
        flushed++;
    }
    if (flushed > 0) {
        ESP_LOGI(TAG, "flushed %d buffered reports", flushed);
    }
}

/* ── HaLow connection task ── */
void halow_task(void *param) {
    s_link_sem = xSemaphoreCreateBinary();

    enum mmwlan_status status;

    mmhal_init();
    mmwlan_init();

    const struct mmwlan_s1g_channel_list *channel_list =
        mmwlan_lookup_regulatory_domain(get_regulatory_db(), COUNTRY_CODE);
    if (channel_list == NULL) {
        ESP_LOGE(TAG, "no regulatory domain for country code %s", COUNTRY_CODE);
        vTaskDelete(NULL);
        return;
    }
    status = mmwlan_set_channel_list(channel_list);
    if (status != MMWLAN_SUCCESS) {
        ESP_LOGE(TAG, "mmwlan_set_channel_list failed: %d", status);
        vTaskDelete(NULL);
        return;
    }

    status = mmwlan_register_link_state_cb(halow_link_state_cb, NULL);
    if (status != MMWLAN_SUCCESS) {
        ESP_LOGE(TAG, "mmwlan_register_link_state_cb failed: %d", status);
    }

    struct mmipal_init_args ip_args = MMIPAL_INIT_ARGS_DEFAULT;
    enum mmipal_status ip_status = mmipal_init(&ip_args);
    if (ip_status != MMIPAL_SUCCESS) {
        ESP_LOGE(TAG, "mmipal_init failed: %d", ip_status);
    }

    struct mmwlan_sta_args sta_args = MMWLAN_STA_ARGS_INIT;
    sta_args.ssid_len = strlen(HALOW_SSID);
    memcpy(sta_args.ssid, HALOW_SSID, sta_args.ssid_len);

    if (strlen(HALOW_PASSPHRASE) > 0) {
        sta_args.passphrase_len = strlen(HALOW_PASSPHRASE);
        memcpy(sta_args.passphrase, HALOW_PASSPHRASE, sta_args.passphrase_len);
        sta_args.security_type = MMWLAN_SAE;
    } else {
        sta_args.security_type = MMWLAN_OWE;
    }

    ESP_LOGI(TAG, "connecting to HaLow AP '%s'...", HALOW_SSID);
    status = mmwlan_sta_enable(&sta_args, NULL);
    if (status != MMWLAN_SUCCESS) {
        ESP_LOGE(TAG, "mmwlan_sta_enable failed: %d", status);
    }

    while (1) {
        if (!s_halow_connected) {
            xSemaphoreTake(s_link_sem, pdMS_TO_TICKS(10000));
        }
        vTaskDelay(pdMS_TO_TICKS(5000));
    }
}

bool halow_is_connected(void) {
    return s_halow_connected;
}

void transport_init(QueueHandle_t tx_queue) {
    s_tx_queue = tx_queue;
    ring_init(&s_ring, REPORT_BUFFER_MAX);
    ESP_LOGI(TAG, "transport initialized, buffer capacity=%d", REPORT_BUFFER_MAX);
}

void transport_task(void *param) {
    char *json = NULL;

    while (1) {
        if (xQueueReceive(s_tx_queue, &json, pdMS_TO_TICKS(1000)) == pdTRUE) {
            ESP_LOGI(TAG, "report: %s", json);

            if (s_halow_connected) {
                flush_ring();

                if (udp_send(json, strlen(json)) == 0) {
                    free(json);
                } else {
                    ESP_LOGW(TAG, "UDP send failed, buffering");
                    ring_push(&s_ring, json);
                }
            } else {
                ESP_LOGW(TAG, "HaLow not connected, buffering (%d stored)", s_ring.count + 1);
                ring_push(&s_ring, json);
            }
        } else {
            if (s_halow_connected && s_ring.count > 0) {
                flush_ring();
            }
        }
    }
}
