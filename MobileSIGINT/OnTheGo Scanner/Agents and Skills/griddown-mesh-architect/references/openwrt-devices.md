# Recommended OpenWRT Devices for GridDown Mesh

## Overview

This document lists OpenWRT-compatible devices suitable for GridDown mesh networking. Devices are categorized by use case, budget, and performance tier.

## Quick Recommendations

| Use Case | Budget | Performance | Top Pick |
|----------|--------|-------------|----------|
| Gateway/Server | $100-200 | High | GL.iNet GL-MT6000 (Flint 2) |
| Relay Node | $50-100 | Medium | GL.iNet GL-AX1800 (Flint) |
| Edge Node | $30-50 | Basic | GL.iNet GL-AR300M |
| Portable/Travel | $50-100 | Medium | GL.iNet GL-AXT1800 (Slate AX) |

---

## Gateway/High Performance Devices

### GL.iNet GL-MT6000 (Flint 2)
**Best for: Main gateway, high-traffic nodes**

| Spec | Value |
|------|-------|
| WiFi | Wi-Fi 6 (AX), up to 6 Gbps |
| CPU | MediaTek MT7986A |
| RAM | 1 GB DDR4 |
| Flash | 8 GB eMMC |
| Ethernet | 2x 2.5G + 4x 1G |
| USB | USB 3.0 |
| Price | ~$170 |

**Pros:**
- Excellent performance
- 2.5G ports for fast backhaul
- Large storage for packages
- Pre-installed OpenWRT-based firmware

**Cons:**
- Higher power consumption
- Overkill for simple relay

---

### Linksys WRT3200ACM
**Best for: Power users, extensive customization**

| Spec | Value |
|------|-------|
| WiFi | AC3200 (2.4/5/5 GHz) |
| CPU | Marvell 88F6820 @ 1.8 GHz dual-core |
| RAM | 512 MB |
| Flash | 256 MB |
| Ethernet | 4x Gigabit + 1 WAN |
| USB | USB 3.0 + eSATA |
| Price | ~$150-200 |

**Pros:**
- Excellent OpenWRT support
- Massive flash storage
- eSATA for storage
- Open source friendly

**Cons:**
- Older Wi-Fi standard (no Wi-Fi 6)
- Large form factor

---

### Netgear Nighthawk R7800
**Best for: Large coverage, mesh backbone**

| Spec | Value |
|------|-------|
| WiFi | AC2600 (MU-MIMO) |
| CPU | Qualcomm IPQ8065 @ 1.7 GHz |
| RAM | 512 MB |
| Flash | 128 MB |
| Ethernet | 4x Gigabit + 1 WAN |
| USB | 2x USB 3.0 |
| Price | ~$100-150 (used) |

**Pros:**
- Strong WiFi coverage
- Mesh-ready
- Good OpenWRT support
- Often available used

**Cons:**
- Higher power usage
- No Wi-Fi 6

---

## Mid-Range Relay Nodes

### GL.iNet GL-AX1800 (Flint)
**Best for: Relay nodes with client access**

| Spec | Value |
|------|-------|
| WiFi | Wi-Fi 6 AX1800 |
| CPU | Qualcomm IPQ6000 @ 1.2 GHz |
| RAM | 512 MB |
| Flash | 128 MB |
| Ethernet | 4x Gigabit + 1 WAN |
| USB | USB 3.0 |
| Price | ~$90-110 |

**Pros:**
- Wi-Fi 6 support
- Pre-installed OpenWRT
- Good value
- Up to 120 devices

**Cons:**
- Modest flash storage

---

### GL.iNet GL-MT3000 (Beryl AX)
**Best for: Portable relay, travel router**

| Spec | Value |
|------|-------|
| WiFi | Wi-Fi 6 AX3000 |
| CPU | MediaTek MT7981B |
| RAM | 512 MB |
| Flash | 256 MB |
| Ethernet | 1x 2.5G + 1x 1G |
| USB | USB 3.0 |
| Price | ~$80-100 |

**Pros:**
- Compact form factor
- 2.5G port
- Good performance/size ratio
- Wi-Fi 6

**Cons:**
- Only 2 Ethernet ports

---

### Dynalink DL-WRX36
**Best for: Large home coverage, mesh AP**

| Spec | Value |
|------|-------|
| WiFi | Wi-Fi 6 AX3600 |
| CPU | Qualcomm IPQ8072A |
| RAM | 1 GB |
| Flash | 512 MB |
| Ethernet | 4x Gigabit + 1 WAN |
| Price | ~$100-130 |

**Pros:**
- Excellent coverage (4800 sq ft)
- Great value
- Large RAM/flash
- Wi-Fi 6

**Cons:**
- Setup can be tricky
- Less documentation

---

## Budget/Edge Nodes

### GL.iNet GL-AR300M
**Best for: Basic relay, low-power node**

| Spec | Value |
|------|-------|
| WiFi | 802.11n (2.4 GHz) |
| CPU | Qualcomm QCA9531 @ 650 MHz |
| RAM | 128 MB |
| Flash | 16 MB (128 MB with NOR variant) |
| Ethernet | 2x 100 Mbps |
| USB | USB 2.0 |
| Price | ~$25-40 |

**Pros:**
- Very affordable
- Low power (~2W)
- Compact
- Pre-installed OpenWRT

**Cons:**
- 2.4 GHz only
- 100 Mbps Ethernet
- Limited flash

---

### TP-Link Archer A7/C7
**Best for: Budget AP with good coverage**

| Spec | Value |
|------|-------|
| WiFi | AC1750 (dual-band) |
| CPU | Qualcomm QCA9563 @ 750 MHz |
| RAM | 128 MB |
| Flash | 16 MB |
| Ethernet | 4x Gigabit + 1 WAN |
| USB | USB 2.0 |
| Price | ~$40-60 |

**Pros:**
- Widely available
- Good coverage
- Gigabit ports
- Proven OpenWRT support

**Cons:**
- Limited flash/RAM
- No Wi-Fi 6

---

### Xiaomi Mi Router 4A Gigabit
**Best for: Ultra-budget relay**

| Spec | Value |
|------|-------|
| WiFi | AC1200 (dual-band) |
| CPU | MediaTek MT7621 @ 880 MHz |
| RAM | 128 MB |
| Flash | 16 MB |
| Ethernet | 2x Gigabit + 1 WAN |
| Price | ~$25-35 |

**Pros:**
- Very cheap
- Dual-core CPU
- Gigabit ports
- Compact

**Cons:**
- Flash process can be tricky
- Limited storage

---

## Specialty Devices

### GL.iNet GL-AXT1800 (Slate AX)
**Best for: Portable, travel, temporary deployment**

| Spec | Value |
|------|-------|
| WiFi | Wi-Fi 6 AX1800 |
| CPU | Qualcomm IPQ6000 |
| RAM | 512 MB |
| Flash | 128 MB |
| Ethernet | 2x Gigabit |
| USB | USB 3.0 |
| Power | USB-C |
| Price | ~$100-130 |

**Pros:**
- Very portable
- USB-C power (power bank compatible)
- Wi-Fi 6
- VPN pre-configured

**Cons:**
- Only 2 Ethernet ports
- Higher cost for size

---

### GL.iNet GL-AR750S (Slate)
**Best for: Compact relay with VPN**

| Spec | Value |
|------|-------|
| WiFi | AC1300 (dual-band) |
| CPU | Qualcomm QCA9563 @ 775 MHz |
| RAM | 128 MB |
| Flash | 16 MB + 128 MB NOR |
| Ethernet | 3x Gigabit |
| USB | USB 2.0 |
| MicroSD | Yes |
| Price | ~$70-90 |

**Pros:**
- Compact
- MicroSD expansion
- Travel-friendly

**Cons:**
- Older design
- Limited RAM

---

## Selection Criteria for GridDown

### Power Consumption

| Device | Typical Power |
|--------|---------------|
| GL-AR300M | 2-3W |
| Archer A7 | 6-9W |
| GL-AX1800 | 8-12W |
| GL-MT6000 | 15-20W |

For solar/battery deployments, prefer:
- GL-AR300M (lowest power)
- GL-MT3000 (good performance/power)

### Memory Requirements

For batman-adv or OLSR with minimal packages:
- **Minimum**: 64 MB RAM, 8 MB flash
- **Recommended**: 128 MB RAM, 16 MB flash
- **Comfortable**: 256+ MB RAM, 32+ MB flash

### Mesh Protocol Support

All listed devices support:
- 802.11s mesh (in kernel)
- batman-adv (via opkg)
- OLSR/OLSRd (via opkg)

### Antenna Considerations

**External Antennas (preferred for mesh):**
- Better range
- Upgradeable
- Adjustable positioning

**Internal Antennas:**
- Cleaner form factor
- No upgrade path
- Consistent coverage pattern

---

## Installation Tips

### General Process

1. Download correct firmware from OpenWRT ToH
2. Verify checksum
3. Flash via manufacturer's method (varies by device)
4. Configure via SSH/LuCI
5. Install mesh packages

### GL.iNet Devices

Already run OpenWRT-based firmware. Options:
1. Use as-is (GL firmware with some limitations)
2. Flash stock OpenWRT (full customization)

### TP-Link Devices

Usually flash via factory recovery mode or web UI.

### After Installation

```bash
# First login
ssh root@192.168.1.1

# Set password
passwd

# Update packages
opkg update

# Install mesh packages (batman-adv example)
opkg install kmod-batman-adv batctl

# Reboot
reboot
```

---

## Resources

- [OpenWRT Table of Hardware](https://openwrt.org/toh/start)
- [OpenWRT Firmware Download](https://openwrt.org/toh/views/toh_fwdownload)
- [GL.iNet Products](https://www.gl-inet.com/products/)
- [OpenWRT Forum](https://forum.openwrt.org/)
