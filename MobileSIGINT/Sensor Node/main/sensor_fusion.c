#include "sensor_fusion.h"
#include "config.h"

fused_estimate_t sensor_fusion_fuse(const fp_store_t *wifi, const fp_store_t *ble) {
    uint16_t wc = fp_store_unique_count(wifi);
    uint16_t bc = fp_store_unique_count(ble);
    uint16_t entity_max = (wc > bc) ? wc : bc;
    uint16_t entity_min = (wc < bc) ? wc : bc;

    fused_estimate_t est;
    est.estimated_entities = entity_max;

    if (entity_max == 0) {
        est.confidence = 0.90f;
        est.classification = "no_presence";
        return est;
    }

    if (entity_min == 0) {
        est.confidence = 0.50f;
    } else {
        float ratio = (float)entity_min / (float)entity_max;
        est.confidence = 0.50f + 0.35f * ratio;
    }

    if (est.estimated_entities >= FUSED_THRESHOLD_LARGE_GRP) {
        est.classification = "large_group";
    } else if (est.estimated_entities >= FUSED_THRESHOLD_SMALL_GRP) {
        est.classification = "small_group";
    } else if (est.estimated_entities >= FUSED_THRESHOLD_SINGLE) {
        est.classification = "single_person";
    } else {
        est.classification = "no_presence";
    }

    return est;
}
