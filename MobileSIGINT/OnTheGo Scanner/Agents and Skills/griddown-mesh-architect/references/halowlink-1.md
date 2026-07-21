# HaLowLink 1 Hardware Reference

## Overview

The HaLowLink 1 is a Wi-Fi HaLow (IEEE 802.11ah) gateway developed by Morse Micro in collaboration with GL.iNet. It serves as a reference design and evaluation platform for Wi-Fi HaLow connectivity, enabling long-range, low-power wireless communication for IoT applications.

## Specifications

### Hardware

| Component | Specification |
|-----------|---------------|
| **CPU** | MediaTek MT7621A dual-core MIPS @ 880MHz |
| **Memory** | 256 MB DDR3 RAM |
| **Storage** | 32 MB NAND Flash |
| **HaLow Radio** | AzureWave AW-HM593 module (Morse Micro MM6108) |
| **WiFi Radio** | 2.4GHz 2x2 MIMO 802.11b/g/n |
| **TX Power** | Up to 23 dBm (200 mW) |
| **Power Input** | 5V DC, 2A via USB-C |
| **Dimensions** | 88 x 68 x 24 mm |

### Interfaces

| Interface | Description |
|-----------|-------------|
| **Ethernet 1** | Gigabit Ethernet (WAN/LAN) |
| **Ethernet 2** | Gigabit Ethernet (LAN) |
| **USB-C** | Power and USB-to-Ethernet data |
| **SMA Connector** | External antenna for HaLow radio |
| **Mode Button** | Configuration/reset |

### Radio Specifications (802.11ah HaLow)

| Parameter | Value |
|-----------|-------|
| **Standard** | IEEE 802.11ah (Wi-Fi HaLow) |
| **Frequency** | 902-928 MHz (US), 863-868 MHz (EU) |
| **Bandwidth** | 1, 2, 4, or 8 MHz selectable |
| **Max Data Rate** | 32.5 Mbps @ 8 MHz |
| **Modulation** | BPSK to 64-QAM (MCS0-7) |
| **Range** | 1-3 km (line of sight) |
| **Penetration** | ~10x better than 2.4 GHz through walls |

## Software

### Firmware

- **Base OS**: OpenWRT 23.05
- **Interface**: Web UI (LuCI) and SSH/CLI
- **Features**:
  - Status dashboard
  - Setup wizards
  - Online firmware updates
  - Full OpenWRT package support

### Default Access

| Setting | Value |
|---------|-------|
| IP Address | 192.168.8.1 |
| Username | root |
| Password | (varies, check documentation) |
| SSH | Enabled |
| Web UI | http://192.168.8.1 |

## Operating Modes

### 1. Router Mode
Primary mode - routes between HaLow network and Ethernet/WiFi

### 2. Access Point Mode
HaLow AP for client devices

### 3. Extender/Repeater Mode
Extends existing WiFi network via HaLow

### 4. Bridge Mode
Transparent bridge between Ethernet and HaLow

## Use Cases for GridDown

### As Mesh Gateway
Connect to Raspberry Pi 5 server via Ethernet, provide HaLow coverage for the mesh.

```
[Pi 5 Server] --ethernet-- [HaLowLink 1] ~~~HaLow~~~ [Remote Nodes]
```

### As Relay Node
Extend mesh coverage in areas between gateway and edge nodes.

```
[Gateway] ~~~HaLow~~~ [HaLowLink 1 Relay] ~~~HaLow~~~ [Edge Node]
```

### As Edge Node with AP
Provide both HaLow mesh backhaul and local 2.4GHz client access.

```
[Mesh] ~~~HaLow~~~ [HaLowLink 1] --2.4GHz AP-- [Client Devices]
```

## Configuration for GridDown

### Initial Setup

1. Connect to HaLowLink 1 via Ethernet
2. Access web UI at http://192.168.8.1
3. Set root password
4. Configure network settings

### Network Configuration

```bash
# SSH to device
ssh root@192.168.8.1

# Set hostname
uci set system.@system[0].hostname='gd-gateway-main'
uci commit system

# Configure LAN interface for mesh
uci set network.lan.ipaddr='10.73.0.1'
uci set network.lan.netmask='255.255.0.0'
uci commit network

# Restart networking
/etc/init.d/network restart
```

### HaLow Interface Configuration

The HaLow radio appears as a wireless interface. Configuration depends on the specific firmware version and whether using it as AP or mesh.

```bash
# Check available wireless devices
iwinfo

# View HaLow interface
uci show wireless
```

## Antenna Considerations

### Stock Antenna
Omnidirectional, suitable for general coverage

### External Antenna Options
The SMA connector supports external antennas for:
- **Directional**: Point-to-point links, higher gain
- **Higher Gain Omni**: Better range in all directions
- **MIMO**: If supported by firmware

### Antenna Placement
- Mount as high as possible
- Clear line of sight preferred
- Avoid metal obstructions
- Consider weatherproofing for outdoor deployment

## Power Considerations

### Power Requirements
- 5V DC, 2A (10W maximum)
- USB-C power delivery

### Power Options for Field Deployment
- USB power bank (10,000+ mAh recommended)
- 5V solar panel with battery
- 12V to 5V converter from battery systems
- POE to USB-C adapter (with appropriate splitter)

### Power Consumption Estimates
| Mode | Consumption |
|------|-------------|
| Idle | ~2-3W |
| Active TX | ~5-7W |
| Full Load | ~8-10W |

## Integration with Raspberry Pi

### Physical Connection
```
[Raspberry Pi 5] 
    └── Ethernet Port
            │
    [HaLowLink 1]
        ├── Ethernet 1 (to Pi)
        └── HaLow Radio (to mesh)
```

### Network Configuration on Pi
```bash
# /etc/dhcpcd.conf on Pi
interface eth0
static ip_address=10.73.0.2/16
static routers=10.73.0.1

# Or configure the HaLowLink as DHCP server
# and let Pi get address automatically
```

## Troubleshooting

### Cannot Access Web UI
1. Verify Ethernet connection
2. Check IP settings (should be in 192.168.8.x range)
3. Try factory reset (hold mode button 10+ seconds)

### HaLow Not Connecting
1. Verify channel/frequency settings match
2. Check antenna connection
3. Verify line of sight
4. Check distance (try closer first)

### Poor Performance
1. Check signal strength via web UI
2. Verify bandwidth settings (try lower bandwidth for range)
3. Check for interference sources
4. Consider antenna upgrade

## Firmware Updates

### Via Web UI
1. Download latest firmware from Morse Micro
2. Go to System > Backup/Flash Firmware
3. Upload new image

### Via CLI
```bash
# Download firmware
cd /tmp
wget http://firmware-url/firmware.bin

# Flash (CAUTION: don't interrupt)
sysupgrade -v /tmp/firmware.bin
```

## Advanced: Custom OpenWRT Build

For full customization, build OpenWRT from source with HaLowLink 1 support:

```bash
# Clone OpenWRT
git clone https://git.openwrt.org/openwrt/openwrt.git
cd openwrt
git checkout v23.05.0

# Update feeds
./scripts/feeds update -a
./scripts/feeds install -a

# Configure for HaLowLink 1
make menuconfig
# Select: Target System > MediaTek Ralink MIPS
# Select: Target Profile > GL.iNet / Morse Micro HaLowLink 1

# Build
make -j$(nproc)
```

## Resources

- [Morse Micro Product Page](https://www.morsemicro.com/)
- [HaLowLink 1 Product Brief (Mouser)](https://www.mouser.com/datasheet/2/1521/Morse_Micro_01_17_2025_HaLowLink_1_Product_Brief-3541160.pdf)
- [OpenWRT Device Page](https://openwrt.org/toh/views/toh_fwdownload) (search for HaLowLink)
- [Wi-Fi HaLow Alliance](https://www.wi-fi.org/discover-wi-fi/wi-fi-halow)
