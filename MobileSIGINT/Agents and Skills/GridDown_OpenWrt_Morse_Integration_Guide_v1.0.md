# OpenWrt/Morse Micro Integration Guide

## Technical Implementation Guide for HaLow Integration

**Version 1.0** • December 2024

**Document Type:** Technical Integration Guide
**Platform:** OpenWrt 23.05 + Morse Micro MM6108/MM8108
**Target Hardware:** MediaTek MT7621A (HaLowLink 1)

---

## 1. Executive Summary

This guide provides comprehensive technical documentation for integrating Morse Micro's 802.11ah (HaLow) chipsets with OpenWrt, specifically targeting the HaLowLink 1 hardware platform. It covers driver integration, kernel modifications, UCI configuration, mesh networking adaptations, and power management implementations.

### 1.1 Integration Scope

- Kernel module development and integration
- MAC80211 subsystem modifications for Sub-1GHz
- UCI/LuCI configuration framework
- BATMAN-adv mesh protocol optimizations
- Testing and validation procedures
- Performance tuning guidelines

### 1.2 Key Challenges Addressed

1. S1G band support in mac80211 subsystem
2. Regulatory database modifications for 902-928MHz
3. Mesh protocol timing adjustments for long-range links
4. Power management for battery-powered nodes
5. Coexistence with 2.4GHz WiFi operations

---

## 2. Architecture Overview

### 2.1 Software Stack

```
┌─────────────────────────────────────────────────────────┐
│                    User Space                            │
├─────────────────────────────────────────────────────────┤
│   LuCI Web Interface    │    UCI Configuration          │
│   luci-app-halow        │    /etc/config/wireless       │
├─────────────────────────────────────────────────────────┤
│   Mesh Routing          │    Network Services           │
│   BATMAN-adv / OLSR     │    hostapd / wpa_supplicant   │
├─────────────────────────────────────────────────────────┤
│                    Kernel Space                          │
├─────────────────────────────────────────────────────────┤
│   Network Stack         │    Wireless Subsystem         │
│   TCP/IP                │    cfg80211 / mac80211        │
├─────────────────────────────────────────────────────────┤
│   Morse Micro Driver    │    MT7603 WiFi Driver         │
│   morse.ko              │    mt76x2.ko                  │
├─────────────────────────────────────────────────────────┤
│                    Hardware                              │
├─────────────────────────────────────────────────────────┤
│   MM6108 HaLow Radio    │    MT7603EN 2.4GHz Radio     │
│   SPI/SDIO Interface    │    PCIe Interface             │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Module Dependencies

```bash
# Kernel module load order
insmod cfg80211.ko
insmod mac80211.ko
insmod morse_bus.ko      # Morse bus abstraction
insmod morse_common.ko   # Common Morse functions
insmod morse_mac.ko      # MAC layer implementation
insmod morse.ko          # Main driver module
```

---

## 3. Kernel Integration

### 3.1 Required Kernel Patches

#### 3.1.1 S1G Band Support Patch

```diff
--- a/include/net/cfg80211.h
+++ b/include/net/cfg80211.h
@@ -95,6 +95,7 @@ enum ieee80211_band {
 	NL80211_BAND_2GHZ,
 	NL80211_BAND_5GHZ,
 	NL80211_BAND_6GHZ,
+	NL80211_BAND_S1GHZ,

 	NUM_NL80211_BANDS,
 };
@@ -150,6 +151,16 @@ struct ieee80211_s1g_cap {
+/* S1G Channel definitions */
+#define IEEE80211_S1G_CHANNEL_WIDTH_1MHZ  0x00
+#define IEEE80211_S1G_CHANNEL_WIDTH_2MHZ  0x01
+#define IEEE80211_S1G_CHANNEL_WIDTH_4MHZ  0x02
+#define IEEE80211_S1G_CHANNEL_WIDTH_8MHZ  0x03
+#define IEEE80211_S1G_CHANNEL_WIDTH_16MHZ 0x04
```

#### 3.1.2 Regulatory Database Update

```c
// File: net/wireless/reg.c
static const struct ieee80211_regdomain regdom_US_S1G = {
    .alpha2 = "US",
    .reg_rules = {
        REG_RULE_S1G(902000, 928000, 26000, 0, 3000, 0),
        // 902-928 MHz, 26 MHz bandwidth, 30 dBm max
    },
    .n_reg_rules = 1,
};
```

### 3.2 Driver Module Structure

#### 3.2.1 Main Driver Module (morse.ko)

```c
// drivers/net/wireless/morse/morse_main.c

#include <linux/module.h>
#include <linux/spi/spi.h>
#include <net/mac80211.h>

struct morse_priv {
    struct ieee80211_hw *hw;
    struct device *dev;
    struct spi_device *spi;

    /* Firmware */
    const struct firmware *fw;
    struct morse_fw_info fw_info;

    /* Channels */
    struct ieee80211_channel channels_s1g[41];
    struct ieee80211_supported_band band_s1g;

    /* Power management */
    struct morse_pm_info pm;
    bool target_wake_time_enabled;

    /* Statistics */
    struct morse_stats stats;
};

static int morse_probe(struct spi_device *spi)
{
    struct ieee80211_hw *hw;
    struct morse_priv *priv;
    int ret;

    hw = ieee80211_alloc_hw(sizeof(*priv), &morse_ops);
    if (!hw)
        return -ENOMEM;

    priv = hw->priv;
    priv->hw = hw;
    priv->dev = &spi->dev;
    priv->spi = spi;

    /* Initialize hardware */
    ret = morse_init_hardware(priv);
    if (ret)
        goto err_free;

    /* Load firmware */
    ret = morse_load_firmware(priv);
    if (ret)
        goto err_hw;

    /* Register with mac80211 */
    ret = ieee80211_register_hw(hw);
    if (ret)
        goto err_fw;

    dev_info(&spi->dev, "Morse Micro MM6108 initialized\n");
    return 0;

err_fw:
    morse_release_firmware(priv);
err_hw:
    morse_deinit_hardware(priv);
err_free:
    ieee80211_free_hw(hw);
    return ret;
}
```

### 3.3 Channel Configuration

```c
// Channel definitions for US 902-928 MHz band
static struct ieee80211_channel morse_channels_s1g[] = {
    /* 1 MHz channels */
    { .band = NL80211_BAND_S1GHZ, .center_freq = 902500, .hw_value = 1 },
    { .band = NL80211_BAND_S1GHZ, .center_freq = 903500, .hw_value = 2 },
    /* ... */

    /* 2 MHz channels */
    { .band = NL80211_BAND_S1GHZ, .center_freq = 903000, .hw_value = 10 },
    { .band = NL80211_BAND_S1GHZ, .center_freq = 905000, .hw_value = 11 },
    /* ... */

    /* 4 MHz channels */
    { .band = NL80211_BAND_S1GHZ, .center_freq = 904000, .hw_value = 20 },
    { .band = NL80211_BAND_S1GHZ, .center_freq = 908000, .hw_value = 21 },
    /* ... */

    /* 8 MHz channels */
    { .band = NL80211_BAND_S1GHZ, .center_freq = 906000, .hw_value = 30 },
    { .band = NL80211_BAND_S1GHZ, .center_freq = 914000, .hw_value = 31 },
    { .band = NL80211_BAND_S1GHZ, .center_freq = 922000, .hw_value = 32 },
};
```

---

## 4. OpenWrt Package Structure

### 4.1 Package Makefile

```makefile
# package/kernel/morse-halow/Makefile

include $(TOPDIR)/rules.mk
include $(INCLUDE_DIR)/kernel.mk

PKG_NAME:=morse-halow
PKG_VERSION:=2.8.0
PKG_RELEASE:=1

PKG_SOURCE:=morse-driver-$(PKG_VERSION).tar.gz
PKG_SOURCE_URL:=https://github.com/MorseMicro/morse-driver/releases
PKG_HASH:=abc123...

PKG_MAINTAINER:=GridDown Team
PKG_LICENSE:=GPL-2.0

include $(INCLUDE_DIR)/package.mk

define KernelPackage/morse-halow
  SUBMENU:=Wireless Drivers
  TITLE:=Morse Micro HaLow (802.11ah) driver
  DEPENDS:=+kmod-mac80211 +kmod-cfg80211
  FILES:= \
	$(PKG_BUILD_DIR)/morse.ko \
	$(PKG_BUILD_DIR)/morse_bus.ko \
	$(PKG_BUILD_DIR)/morse_common.ko
  AUTOLOAD:=$(call AutoProbe,morse)
endef

define KernelPackage/morse-halow/description
  Kernel driver for Morse Micro MM6108/MM8108 802.11ah chipsets
endef

define Build/Compile
	$(MAKE) -C "$(LINUX_DIR)" \
		CROSS_COMPILE="$(TARGET_CROSS)" \
		ARCH="$(LINUX_KARCH)" \
		SUBDIRS="$(PKG_BUILD_DIR)" \
		EXTRA_CFLAGS="$(EXTRA_CFLAGS) -DCONFIG_MORSE_S1G" \
		modules
endef

$(eval $(call KernelPackage,morse-halow))
```

### 4.2 Firmware Package

```makefile
# package/firmware/morse-firmware/Makefile

include $(TOPDIR)/rules.mk

PKG_NAME:=morse-firmware
PKG_VERSION:=2.8.0
PKG_RELEASE:=1

include $(INCLUDE_DIR)/package.mk

define Package/morse-firmware
  SECTION:=firmware
  CATEGORY:=Firmware
  TITLE:=Morse Micro MM6108 firmware
endef

define Package/morse-firmware/install
	$(INSTALL_DIR) $(1)/lib/firmware/morse
	$(INSTALL_DATA) ./files/mm6108_fw_v$(PKG_VERSION).bin \
		$(1)/lib/firmware/morse/
	$(INSTALL_DATA) ./files/mm6108_bcf.bin \
		$(1)/lib/firmware/morse/
	$(INSTALL_DATA) ./files/regulatory.db \
		$(1)/lib/firmware/morse/
endef

$(eval $(call BuildPackage,morse-firmware))
```

---

## 5. UCI Configuration Integration

### 5.1 UCI Schema Extension

```bash
# /lib/netifd/wireless/morse.sh

#!/bin/sh
. /lib/netifd/netifd-wireless.sh

init_wireless_driver "$@"

drv_morse_init_device_config() {
    config_add_string channel htmode
    config_add_int beacon_int txpower
    config_add_string s1g_oper_chwidth
    config_add_boolean twt_enabled raw_enabled
    config_add_int twt_wake_interval twt_wake_duration
}

drv_morse_init_iface_config() {
    config_add_string mode ssid encryption key
    config_add_boolean hidden wmm
}

drv_morse_setup() {
    json_select config
    json_get_vars channel htmode txpower
    json_get_vars s1g_oper_chwidth twt_enabled
    json_select ..

    # Configure interface
    ip link set dev ${ifname} up
    iw dev ${ifname} set type ${mode}

    # Set channel and bandwidth
    case "$s1g_oper_chwidth" in
        1MHz) bw=1 ;;
        2MHz) bw=2 ;;
        4MHz) bw=4 ;;
        8MHz) bw=8 ;;
        *) bw=4 ;;  # Default to 4MHz
    esac

    iw dev ${ifname} set channel ${channel} ${bw}MHz

    # Configure TWT if enabled
    if [ "$twt_enabled" = "1" ]; then
        echo ${twt_wake_interval} > /sys/kernel/debug/ieee80211/${phy}/morse/twt_interval
        echo ${twt_wake_duration} > /sys/kernel/debug/ieee80211/${phy}/morse/twt_duration
    fi
}

add_driver morse
```

### 5.2 Example UCI Configuration

```bash
# /etc/config/wireless

config wifi-device 'halow0'
    option type 'morse'
    option channel '23'              # 922 MHz center
    option htmode 'S1G_8MHZ'         # 8 MHz bandwidth
    option s1g_oper_chwidth '8MHz'
    option country 'US'
    option txpower '30'              # 30 dBm (1W)
    option beacon_int '102400'       # 100ms in TUs
    option twt_enabled '1'           # Target Wake Time
    option twt_wake_interval '512'   # 512ms
    option twt_wake_duration '16'    # 16ms

config wifi-iface 'mesh0'
    option device 'halow0'
    option network 'lan'
    option mode 'mesh'
    option mesh_id 'GridDown'
    option encryption 'sae'
    option key 'GridDownMeshPassword'
    option mesh_fwding '1'
    option mesh_ttl '5'
```

---

## 6. LuCI Web Interface

### 6.1 LuCI Application Structure

```lua
-- /usr/lib/lua/luci/controller/halow.lua

module("luci.controller.halow", package.seeall)

function index()
    entry({"admin", "network", "halow"}, cbi("halow/halow"), _("HaLow Settings"), 70)
    entry({"admin", "network", "halow", "status"}, call("halow_status"), nil)
    entry({"admin", "network", "halow", "scan"}, call("halow_scan"), nil)
end

function halow_status()
    local util = require "luci.util"
    local status = {}

    -- Get interface status
    local iw = util.exec("iw dev halow0 info")
    status.interface = parse_iw_info(iw)

    -- Get mesh status
    local batctl = util.exec("batctl meshif bat0 neighbors")
    status.mesh_neighbors = parse_batctl_neighbors(batctl)

    -- Get statistics
    local stats = util.exec("cat /sys/kernel/debug/ieee80211/phy0/morse/stats")
    status.statistics = parse_morse_stats(stats)

    luci.http.prepare_content("application/json")
    luci.http.write_json(status)
end
```

### 6.2 Configuration Interface

```lua
-- /usr/lib/lua/luci/model/cbi/halow/halow.lua

local m, s, o

m = Map("wireless", translate("HaLow Network Configuration"),
    translate("Configure 802.11ah (HaLow) network settings"))

-- Device section
s = m:section(TypedSection, "wifi-device", translate("HaLow Radio"))
s.anonymous = true
s.addremove = false

o = s:option(ListValue, "channel", translate("Channel"))
o:value("10", "903 MHz (2 MHz)")
o:value("20", "904 MHz (4 MHz)")
o:value("23", "922 MHz (8 MHz)")
o:value("32", "924 MHz (8 MHz)")
o.default = "23"

o = s:option(ListValue, "s1g_oper_chwidth", translate("Channel Width"))
o:value("1MHz", translate("1 MHz - Maximum range"))
o:value("2MHz", translate("2 MHz - Long range"))
o:value("4MHz", translate("4 MHz - Balanced"))
o:value("8MHz", translate("8 MHz - Maximum throughput"))
o.default = "4MHz"

o = s:option(Value, "txpower", translate("Transmit Power (dBm)"))
o.datatype = "range(0,30)"
o.default = "30"

-- Power management
o = s:option(Flag, "twt_enabled", translate("Enable Target Wake Time"))
o.default = o.disabled
o:depends("mode", "sta")

o = s:option(Value, "twt_wake_interval", translate("TWT Wake Interval (ms)"))
o:depends("twt_enabled", "1")
o.datatype = "uinteger"
o.default = "512"

-- Interface section
s = m:section(TypedSection, "wifi-iface", translate("Interface Configuration"))
s.anonymous = true
s.addremove = true

o = s:option(ListValue, "mode", translate("Mode"))
o:value("ap", translate("Access Point"))
o:value("sta", translate("Station"))
o:value("mesh", translate("Mesh"))
o:value("relay", translate("Relay"))

o = s:option(Value, "ssid", translate("SSID"))
o:depends("mode", "ap")
o:depends("mode", "sta")

o = s:option(Value, "mesh_id", translate("Mesh ID"))
o:depends("mode", "mesh")

return m
```

---

## 7. BATMAN-adv Optimizations

### 7.1 HaLow-Specific Tuning

```bash
#!/bin/sh
# /etc/init.d/batman-halow

configure_batman_halow() {
    # Adjust for longer range, higher latency links

    # Increase originator interval for power saving
    echo 5000 > /sys/class/net/bat0/mesh/orig_interval

    # Adjust hop penalty for mesh routing
    echo 10 > /sys/class/net/bat0/mesh/hop_penalty

    # Enable network coding for better throughput
    echo 1 > /sys/class/net/bat0/mesh/network_coding

    # Adjust gateway selection
    echo 5000 > /sys/class/net/bat0/mesh/gw_sel_class

    # Configure aggregation for HaLow
    echo 1 > /sys/class/net/bat0/mesh/aggregated_ogms

    # Set appropriate MTU for HaLow
    ip link set dev bat0 mtu 1500

    # Configure multicast optimization
    echo 1 > /sys/class/net/bat0/mesh/multicast_mode
}
```

### 7.2 Mesh Performance Monitoring

```bash
# /usr/bin/halow-mesh-monitor

#!/bin/sh

while true; do
    # Collect mesh statistics
    neighbors=$(batctl n | grep -c halow)
    throughput=$(batctl tp halow0 | grep -oP '\d+\.\d+ Mbps')

    # Log to system
    logger -t halow-mesh "Neighbors: $neighbors, Throughput: $throughput"

    # Update status file for LuCI
    cat > /tmp/halow_mesh_status << EOF
{
    "timestamp": $(date +%s),
    "neighbors": $neighbors,
    "throughput": "$throughput",
    "routes": $(batctl o | wc -l)
}
EOF

    sleep 60
done
```

---

## 8. Power Management Implementation

### 8.1 Target Wake Time (TWT) Configuration

```c
// drivers/net/wireless/morse/morse_twt.c

struct morse_twt_params {
    u32 wake_interval_mantissa;
    u8 wake_interval_exponent;
    u16 wake_duration;
    bool implicit;
    bool announced;
    bool trigger_enabled;
};

int morse_configure_twt(struct morse_priv *priv,
                        struct morse_twt_params *params)
{
    struct morse_cmd_twt cmd = {
        .wake_interval = params->wake_interval_mantissa <<
                        params->wake_interval_exponent,
        .wake_duration = params->wake_duration,
        .flags = 0
    };

    if (params->implicit)
        cmd.flags |= MORSE_TWT_IMPLICIT;
    if (params->announced)
        cmd.flags |= MORSE_TWT_ANNOUNCED;
    if (params->trigger_enabled)
        cmd.flags |= MORSE_TWT_TRIGGER;

    return morse_send_command(priv, MORSE_CMD_CONFIG_TWT,
                             &cmd, sizeof(cmd));
}
```

### 8.2 Restricted Access Window (RAW)

```c
// RAW configuration for sensor nodes
struct morse_raw_params {
    u16 raw_duration;      // Duration in TUs
    u8 slot_format;        // Number of slots
    u8 slot_duration;      // Each slot duration
    u8 num_stations;       // Stations per slot
};

int morse_setup_raw(struct morse_priv *priv,
                    struct morse_raw_params *params)
{
    // Configure RAW for power-sensitive nodes
    struct morse_cmd_raw cmd = {
        .duration = params->raw_duration,
        .slot_config = (params->slot_format << 8) |
                      params->slot_duration,
        .sta_per_slot = params->num_stations
    };

    return morse_send_command(priv, MORSE_CMD_SETUP_RAW,
                             &cmd, sizeof(cmd));
}
```

---

## 9. Testing Infrastructure

### 9.1 Automated Test Suite

```python
#!/usr/bin/env python3
# tests/halow_integration_test.py

import subprocess
import time
import json

class HaLowIntegrationTest:
    def __init__(self, device="halow0"):
        self.device = device
        self.results = []

    def test_driver_load(self):
        """Test driver module loading"""
        result = subprocess.run(["lsmod"], capture_output=True, text=True)
        assert "morse" in result.stdout, "Morse driver not loaded"

        # Check debugfs
        debugfs = f"/sys/kernel/debug/ieee80211/phy0/morse"
        assert os.path.exists(debugfs), "Debugfs not available"

        return True

    def test_interface_up(self):
        """Test interface configuration"""
        # Bring interface up
        subprocess.run(["ip", "link", "set", self.device, "up"])
        time.sleep(2)

        # Check status
        result = subprocess.run(["iw", self.device, "info"],
                              capture_output=True, text=True)
        assert "type mesh" in result.stdout, "Interface not in mesh mode"

        return True

    def test_mesh_formation(self):
        """Test mesh network formation"""
        # Wait for mesh to form
        time.sleep(30)

        # Check for neighbors
        result = subprocess.run(["batctl", "n"],
                              capture_output=True, text=True)
        neighbors = len(result.stdout.strip().split('\n')) - 1
        assert neighbors > 0, "No mesh neighbors found"

        return True

    def test_throughput(self):
        """Test throughput performance"""
        # Run iperf3 test
        result = subprocess.run(
            ["iperf3", "-c", "10.73.0.10", "-t", "10", "-J"],
            capture_output=True, text=True
        )

        data = json.loads(result.stdout)
        throughput = data['end']['sum_received']['bits_per_second'] / 1e6

        assert throughput > 5.0, f"Throughput too low: {throughput} Mbps"

        return throughput

    def test_range(self, distances=[100, 200, 500]):
        """Test range and signal strength"""
        results = {}

        for distance in distances:
            # Get signal strength
            result = subprocess.run(
                ["iw", self.device, "station", "dump"],
                capture_output=True, text=True
            )

            # Parse signal strength
            for line in result.stdout.split('\n'):
                if 'signal:' in line:
                    signal = int(line.split()[1])
                    results[distance] = signal
                    break

        return results

    def run_all_tests(self):
        """Run complete test suite"""
        tests = [
            ("Driver Load", self.test_driver_load),
            ("Interface Up", self.test_interface_up),
            ("Mesh Formation", self.test_mesh_formation),
            ("Throughput", self.test_throughput),
            ("Range", self.test_range)
        ]

        for name, test_func in tests:
            try:
                result = test_func()
                self.results.append({
                    "test": name,
                    "status": "PASS",
                    "result": result
                })
                print(f"✓ {name}: PASS")
            except AssertionError as e:
                self.results.append({
                    "test": name,
                    "status": "FAIL",
                    "error": str(e)
                })
                print(f"✗ {name}: FAIL - {e}")

        return self.results

if __name__ == "__main__":
    tester = HaLowIntegrationTest()
    results = tester.run_all_tests()

    # Generate report
    with open("test_results.json", "w") as f:
        json.dump(results, f, indent=2)
```

### 9.2 Performance Benchmarking

```bash
#!/bin/bash
# tests/performance_benchmark.sh

# Test different channel widths
for bw in 1 2 4 8; do
    echo "Testing ${bw}MHz bandwidth"

    # Configure channel width
    uci set wireless.halow0.s1g_oper_chwidth="${bw}MHz"
    uci commit wireless
    wifi reload
    sleep 10

    # Run throughput test
    iperf3 -c 10.73.0.10 -t 30 -J > "throughput_${bw}mhz.json"

    # Measure latency
    ping -c 100 10.73.0.10 > "latency_${bw}mhz.txt"

    # Check power consumption
    cat /sys/class/power_supply/BAT0/current_now > "power_${bw}mhz.txt"
done

# Generate summary report
python3 generate_benchmark_report.py
```

---

## 10. Troubleshooting Guide

### 10.1 Common Issues and Solutions

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **Driver fails to load** | `morse: Unknown symbol` | Rebuild with correct kernel version |
| **No mesh neighbors** | `batctl n` shows empty | Check channel/bandwidth match |
| **Low throughput** | <2 Mbps measured | Increase bandwidth, check interference |
| **High packet loss** | >5% loss in ping | Check signal strength, reduce distance |
| **TWT not working** | Power consumption high | Verify firmware supports TWT |
| **Interface won't come up** | `SIOCSIFFLAGS: Invalid argument` | Check regulatory domain settings |

### 10.2 Debug Commands

```bash
# Enable debug logging
echo 8 > /proc/sys/kernel/printk
echo 0xffffffff > /sys/kernel/debug/ieee80211/phy0/morse/debug_mask

# Monitor kernel messages
dmesg -w | grep morse

# Check regulatory compliance
iw reg get
iw phy phy0 channels

# Dump mesh routing table
batctl o

# Check hardware status
cat /sys/kernel/debug/ieee80211/phy0/morse/hw_status

# Force firmware reload
echo 1 > /sys/kernel/debug/ieee80211/phy0/morse/fw_reload
```

### 10.3 Performance Tuning

```bash
# Optimize for throughput
uci set wireless.halow0.s1g_oper_chwidth='8MHz'
uci set wireless.mesh0.mesh_fwding='0'  # Disable if end node

# Optimize for range
uci set wireless.halow0.s1g_oper_chwidth='1MHz'
uci set wireless.halow0.txpower='30'

# Optimize for power
uci set wireless.halow0.twt_enabled='1'
uci set wireless.halow0.beacon_int='204800'  # 200ms
```

---

## 11. Regulatory Compliance

### 11.1 FCC Compliance Settings

```c
// Regulatory limits for US operation
#define FCC_MAX_EIRP_DBM    30  // 1 Watt
#define FCC_MIN_FREQ_KHZ    902000
#define FCC_MAX_FREQ_KHZ    928000

struct morse_regulatory_limits {
    u32 min_freq;
    u32 max_freq;
    u8 max_eirp;
    u8 max_antenna_gain;
    u32 flags;
};

static const struct morse_regulatory_limits us_limits = {
    .min_freq = 902000,
    .max_freq = 928000,
    .max_eirp = 30,
    .max_antenna_gain = 6,
    .flags = MORSE_REG_NO_OUTDOOR_BELOW_907 |
             MORSE_REG_INDOOR_ONLY_908_910
};
```

### 11.2 Dynamic Frequency Selection

```c
// Implement carrier sense for regulatory compliance
int morse_dfs_check_channel(struct morse_priv *priv, u32 freq)
{
    int energy_detect_threshold = -62; // dBm
    int measurement_time = 100; // ms

    // Perform energy detection
    int rssi = morse_measure_rssi(priv, freq, measurement_time);

    if (rssi > energy_detect_threshold) {
        dev_info(priv->dev, "Channel %u busy (RSSI: %d dBm)\n",
                freq, rssi);
        return -EBUSY;
    }

    return 0;
}
```

---

## 12. Integration Validation

### 12.1 Acceptance Test Criteria

**Driver Integration:**
- [ ] Kernel module loads without errors
- [ ] Firmware loads successfully
- [ ] Device appears in `iw list`
- [ ] Debugfs entries created

**Configuration:**
- [ ] UCI configuration applies correctly
- [ ] LuCI interface displays status
- [ ] Channel/bandwidth changes work
- [ ] Power management settings apply

**Mesh Networking:**
- [ ] BATMAN-adv creates mesh interface
- [ ] Nodes discover each other
- [ ] Routes establish correctly
- [ ] Traffic forwards through mesh

**Performance:**
- [ ] Throughput meets specifications
- [ ] Latency within targets
- [ ] Range achieves expectations
- [ ] Power consumption acceptable

### 12.2 Certification Checklist

**Pre-Certification:**
- [ ] Spurious emissions within limits
- [ ] Power output calibrated
- [ ] Regulatory database correct
- [ ] Antenna specifications documented

**Testing:**
- [ ] FCC Part 15 pre-scan complete
- [ ] EMC testing passed
- [ ] Safety testing complete
- [ ] Environmental testing done

---

## Appendices

### Appendix A: Kernel Configuration

```bash
# Required kernel config options
CONFIG_CFG80211=m
CONFIG_MAC80211=m
CONFIG_MAC80211_MESH=y
CONFIG_BATMAN_ADV=m
CONFIG_SPI=y
CONFIG_REGMAP_SPI=y
CONFIG_FW_LOADER=y
CONFIG_DEBUG_FS=y
```

### Appendix B: Device Tree Configuration

```dts
// Device tree snippet for MT7621 platform
&spi0 {
    status = "okay";

    morse@0 {
        compatible = "morse,mm6108";
        reg = <0>;
        spi-max-frequency = <48000000>;

        interrupt-parent = <&gpio>;
        interrupts = <14 IRQ_TYPE_LEVEL_LOW>;

        reset-gpios = <&gpio 15 GPIO_ACTIVE_LOW>;
        power-gpios = <&gpio 16 GPIO_ACTIVE_HIGH>;

        morse,board-config = "halow_link_1.bcf";
    };
};
```

### Appendix C: Reference Links

- [Morse Micro Developer Portal](https://developer.morsemicro.com)
- [OpenWrt Developer Guide](https://openwrt.org/docs/guide-developer)
- [IEEE 802.11ah Specification](https://standards.ieee.org/standard/802_11ah-2016.html)
- [BATMAN-adv Documentation](https://www.open-mesh.org/projects/batman-adv)

---

## Document Control

**Version:** 1.0
**Status:** Technical Implementation Guide
**Author:** GridDown Engineering Team
**Review:** Required before implementation

---

*End of OpenWrt/Morse Micro Integration Guide*