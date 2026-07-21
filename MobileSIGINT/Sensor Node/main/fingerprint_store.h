#pragma once

#include <stdint.h>
#include <stdbool.h>
#include <string.h>
#include "config.h"
#include "esp_timer.h"

typedef struct {
    uint8_t bytes[FP_HASH_BYTES];
} fp_key_t;

typedef struct {
    uint32_t first_seen;
    uint32_t last_seen;
    int8_t   best_rssi;
    uint16_t frame_count;
} fp_entry_t;

typedef struct {
    uint16_t strong;
    uint16_t medium;
    uint16_t weak;
} rssi_profile_t;

typedef struct {
    fp_key_t   key;
    fp_entry_t entry;
    bool       valid;
} fp_slot_t;

typedef struct {
    fp_slot_t slots[MAX_FINGERPRINTS];
    uint16_t  count;
    uint32_t  total_frames;
} fp_store_t;

static inline uint32_t fp_now_ms(void) {
    return (uint32_t)(esp_timer_get_time() / 1000);
}

static inline void fp_store_init(fp_store_t *s) {
    memset(s, 0, sizeof(*s));
}

static inline int fp_store_find(const fp_store_t *s, const fp_key_t *key) {
    for (int i = 0; i < MAX_FINGERPRINTS; i++) {
        if (s->slots[i].valid &&
            memcmp(s->slots[i].key.bytes, key->bytes, FP_HASH_BYTES) == 0) {
            return i;
        }
    }
    return -1;
}

static inline int fp_store_find_free(const fp_store_t *s) {
    for (int i = 0; i < MAX_FINGERPRINTS; i++) {
        if (!s->slots[i].valid) return i;
    }
    return -1;
}

static inline int fp_store_find_oldest(const fp_store_t *s) {
    int oldest = -1;
    uint32_t oldest_time = UINT32_MAX;
    for (int i = 0; i < MAX_FINGERPRINTS; i++) {
        if (s->slots[i].valid && s->slots[i].entry.last_seen < oldest_time) {
            oldest_time = s->slots[i].entry.last_seen;
            oldest = i;
        }
    }
    return oldest;
}

static inline void fp_store_record(fp_store_t *s, const fp_key_t *key, int8_t rssi) {
    uint32_t now = fp_now_ms();
    int idx = fp_store_find(s, key);

    if (idx >= 0) {
        s->slots[idx].entry.last_seen = now;
        s->slots[idx].entry.frame_count++;
        if (rssi > s->slots[idx].entry.best_rssi) {
            s->slots[idx].entry.best_rssi = rssi;
        }
    } else {
        idx = fp_store_find_free(s);
        if (idx < 0) {
            idx = fp_store_find_oldest(s);
            if (idx < 0) return;
            s->count--;
        }
        s->slots[idx].valid = true;
        memcpy(s->slots[idx].key.bytes, key->bytes, FP_HASH_BYTES);
        s->slots[idx].entry.first_seen  = now;
        s->slots[idx].entry.last_seen   = now;
        s->slots[idx].entry.best_rssi   = rssi;
        s->slots[idx].entry.frame_count = 1;
        s->count++;
    }
    s->total_frames++;
}

static inline void fp_store_expire(fp_store_t *s) {
    uint32_t now = fp_now_ms();
    for (int i = 0; i < MAX_FINGERPRINTS; i++) {
        if (s->slots[i].valid && (now - s->slots[i].entry.last_seen) > FP_TTL_MS) {
            s->slots[i].valid = false;
            s->count--;
        }
    }
}

static inline uint16_t fp_store_unique_count(const fp_store_t *s) {
    return s->count;
}

static inline uint32_t fp_store_total_frames(const fp_store_t *s) {
    return s->total_frames;
}

static inline rssi_profile_t fp_store_rssi_profile(const fp_store_t *s) {
    rssi_profile_t p = {0, 0, 0};
    for (int i = 0; i < MAX_FINGERPRINTS; i++) {
        if (!s->slots[i].valid) continue;
        int8_t rssi = s->slots[i].entry.best_rssi;
        if (rssi >= RSSI_STRONG)      p.strong++;
        else if (rssi >= RSSI_MEDIUM) p.medium++;
        else                          p.weak++;
    }
    return p;
}

static inline void fp_store_reset_window(fp_store_t *s) {
    s->total_frames = 0;
}

static inline void fp_store_clear(fp_store_t *s) {
    memset(s, 0, sizeof(*s));
}
