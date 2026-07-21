#pragma once

#include <stdint.h>
#include "fingerprint_store.h"

typedef struct {
    uint16_t    estimated_entities;
    float       confidence;
    const char *classification;
} fused_estimate_t;

fused_estimate_t sensor_fusion_fuse(const fp_store_t *wifi, const fp_store_t *ble);
