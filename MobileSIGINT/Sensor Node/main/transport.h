#pragma once

#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"

void transport_init(QueueHandle_t tx_queue);
void transport_task(void *param);
void halow_task(void *param);
bool halow_is_connected(void);
