#pragma once

#include "fingerprint_store.h"

void wifi_monitor_init(void);
void wifi_monitor_start_scan(void);
void wifi_monitor_stop_scan(void);
void wifi_monitor_tick(void);
fp_store_t *wifi_monitor_get_store(void);
