#pragma once

#include <stdbool.h>
#include <stdint.h>
#include "fingerprint_store.h"

void ble_scanner_init(void);
void ble_scanner_start_scan(uint32_t duration_ms);
void ble_scanner_stop_scan(void);
bool ble_scanner_is_complete(void);
fp_store_t *ble_scanner_get_store(void);
