#pragma once

#include <stdint.h>
#include <stdbool.h>

/* ── Node Identity ─────────────────────────────────── */
#define NODE_ID               "PN-001"
#define NODE_TIER             1

/* ── Timing ────────────────────────────────────────── */
#define REPORT_INTERVAL_MS    30000
#define WIFI_SCAN_DURATION_MS 15000
#define BLE_SCAN_DURATION_MS  10000

/* ── Fingerprint Store ─────────────────────────────── */
#define FP_TTL_MS             120000
#define MAX_FINGERPRINTS      256
#define FP_HASH_BYTES         8

/* ── RSSI Classification (dBm) ─────────────────────── */
#define RSSI_STRONG           -55
#define RSSI_MEDIUM           -75

/* ── WiFi Monitor Mode ─────────────────────────────── */
#define WIFI_CHANNEL_HOP      1
#define WIFI_CHANNEL_MIN      1
#define WIFI_CHANNEL_MAX      13
#define WIFI_CHANNEL_DWELL_MS 500

/* ── Fusion Thresholds ─────────────────────────────── */
#define FUSED_THRESHOLD_NONE       0
#define FUSED_THRESHOLD_SINGLE     1
#define FUSED_THRESHOLD_SMALL_GRP  3
#define FUSED_THRESHOLD_LARGE_GRP  10

/* ── HaLow Network ─────────────────────────────────── */
#ifndef HALOW_SSID
#define HALOW_SSID            "halow-mesh"
#endif
#ifndef HALOW_PASSPHRASE
#define HALOW_PASSPHRASE      ""
#endif

/* ── Transport ─────────────────────────────────────── */
#define AGGREGATOR_IP         "192.168.1.1"
#define AGGREGATOR_PORT       5000
#define TX_QUEUE_DEPTH        16
#define REPORT_BUFFER_MAX     64

/* ── FreeRTOS Task Config ──────────────────────────── */
#define SENSOR_TASK_STACK     8192
#define TRANSPORT_TASK_STACK  8192
#define HALOW_TASK_STACK      8192
#define SENSOR_TASK_PRIO      5
#define TRANSPORT_TASK_PRIO   4
#define HALOW_TASK_PRIO       6
