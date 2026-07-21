# Morse Micro Wi-Fi HaLow Chipsets Reference

## Overview

Morse Micro is the leading provider of Wi-Fi HaLow (IEEE 802.11ah) System-on-Chip solutions. Their chips enable long-range, low-power wireless connectivity ideal for IoT and mesh networking applications.

This document covers the MM6108 (current generation, used in HaLowLink 1) and MM8108 (next generation) for GridDown v2/v3 hardware development.

---

## MM6108 (First Generation)

### Overview
The MM6108 is a single-chip Wi-Fi HaLow solution including Radio, PHY, and MAC functions. It's the chip used in the HaLowLink 1 and many current Wi-Fi HaLow products.

### Key Specifications

| Parameter | Value |
|-----------|-------|
| **Standard** | IEEE 802.11ah (Wi-Fi HaLow Certified) |
| **Frequency Bands** | Sub-1 GHz (902-928 MHz US, 863-868 MHz EU, others) |
| **Bandwidth** | 1, 2, 4, 8 MHz |
| **Max Data Rate** | 32.5 Mbps @ 8 MHz bandwidth |
| **Modulation** | BPSK, QPSK, 16-QAM, 64-QAM (MCS0-7) |
| **TX Power** | Configurable, up to +21 dBm with external PA |
| **Package** | 6x6 mm QFN48 |
| **Supply Voltage** | 3.0V - 3.6V single supply |
| **Temperature Range** | -40°C to +85°C |

### Host Interfaces

| Interface | Description |
|-----------|-------------|
| **SDIO 2.0** | Primary high-speed interface |
| **SPI** | Alternative host interface |
| **UART** | Dual UARTs for debug/control |
| **GPIO** | General purpose I/O |
| **I2C** | Peripheral interface |
| **PWM** | Pulse width modulation outputs |

### Power Characteristics

| Mode | Typical Current |
|------|-----------------|
| TX @ +21 dBm | ~300 mA |
| RX Active | ~60 mA |
| Idle/Listen | ~15 mA |
| Deep Sleep | ~15 µA |

### Block Diagram

```
┌─────────────────────────────────────────────────┐
│                    MM6108                        │
│  ┌─────────┐  ┌─────────┐  ┌─────────────────┐  │
│  │  Radio  │──│   PHY   │──│      MAC        │  │
│  │   RF    │  │ OFDM    │  │  802.11ah       │  │
│  └────┬────┘  └─────────┘  └───────┬─────────┘  │
│       │                            │            │
│  ┌────┴────┐               ┌───────┴─────────┐  │
│  │   PA    │               │   Host I/F      │  │
│  │  +LNA   │               │  SDIO/SPI/UART  │  │
│  └────┬────┘               └───────┬─────────┘  │
│       │                            │            │
└───────┼────────────────────────────┼────────────┘
        │                            │
   [Antenna]                    [Host MCU]
```

### Development Resources

- **Evaluation Kit**: MM6108-EKH10 (with Raspberry Pi)
- **Reference Designs**: Available from Morse Micro
- **SDK**: Linux drivers, FreeRTOS support

---

## MM8108 (Second Generation)

### Overview
Announced at CES 2025, the MM8108 is Morse Micro's next-generation Wi-Fi HaLow SoC with improved performance, efficiency, and integration. Ideal for GridDown v2/v3 custom hardware.

### Key Improvements Over MM6108

| Feature | MM6108 | MM8108 |
|---------|--------|--------|
| Max Data Rate | 32.5 Mbps | 43.33 Mbps |
| Modulation | Up to 64-QAM | Up to 256-QAM (MCS9) |
| TX Power | +21 dBm (ext PA) | +26 dBm (integrated PA) |
| Package Size | 6x6 mm QFN48 | 5x5 mm BGA |
| USB Interface | No | Yes (USB 2.0) |
| Power Efficiency | Good | Better |

### Key Specifications

| Parameter | Value |
|-----------|-------|
| **Standard** | IEEE 802.11ah (Wi-Fi HaLow) |
| **Frequency Bands** | Sub-1 GHz worldwide |
| **Bandwidth** | 1, 2, 4, 8 MHz |
| **Max Data Rate** | 43.33 Mbps @ 8 MHz (256-QAM) |
| **Modulation** | BPSK to 256-QAM (MCS0-9) |
| **Integrated PA** | +26 dBm with exceptional efficiency |
| **Package** | 5x5 mm BGA |
| **Supply Voltage** | 3.3V |

### Host Interfaces

| Interface | Description |
|-----------|-------------|
| **USB 2.0** | NEW - Enables USB dongle designs |
| **SDIO 2.0** | High-speed host interface |
| **SPI** | Alternative interface |
| **UART** | Debug/control |
| **GPIO** | General purpose I/O |
| **I2C** | Peripheral interface |
| **PWM** | PWM outputs |
| **MIPI RFFE** | RF front-end control for multi-radio systems |

### Power Characteristics

| Mode | Typical Current |
|------|-----------------|
| TX @ +26 dBm | 325 mA (from 3.3V) |
| RX Active | ~50 mA |
| Sleep | Optimized for battery |

### Key Features

1. **World-First 256-QAM (MCS9)**: Higher spectral efficiency
2. **USB 2.0 Host Interface**: Enables simple USB dongle products
3. **Integrated 26dBm PA**: No external SAW filter needed
4. **MIPI RFFE**: Easy multi-radio integration
5. **On-chip RISC-V MCU**: Customer-programmable
6. **Improved Security**: Hardware crypto acceleration

### Development Resources

- **Evaluation Kit**: MM8108-EKH19 (with Raspberry Pi 4B)
- **USB Dongle Reference**: MM8108-RD09
- **SDK**: Linux drivers, extensive documentation

---

## Comparison for GridDown

| Consideration | MM6108 | MM8108 |
|--------------|--------|--------|
| Availability | Now (in HaLowLink 1) | Sampling (2025) |
| Ease of Integration | Good | Better (USB option) |
| Performance | Sufficient | Superior |
| Power Efficiency | Good | Better |
| Cost | Lower | Higher (expected) |
| Custom Hardware | Requires PCB design | USB dongle possible |

### GridDown Recommendation

**v1 (Now)**: Use HaLowLink 1 with MM6108
- Proven, available hardware
- OpenWRT support
- No custom development needed

**v2 (Future)**: Consider MM8108-RD09 USB dongle
- Better performance
- USB interface simplifies integration
- Could plug directly into Pi or mesh routers

**v3 (Custom Hardware)**: Design with MM8108
- Full optimization for GridDown use case
- Custom enclosure, antenna, power management
- Higher volume production benefits

---

## Module Options

Rather than designing directly with chipsets, consider pre-certified modules:

### For MM6108

| Module | Manufacturer | Interface | Notes |
|--------|--------------|-----------|-------|
| AW-HM593 | AzureWave | SDIO | Used in HaLowLink 1 |
| Various | Check Morse Micro partners | - | Multiple form factors |

### For MM8108

| Product | Type | Interface | Notes |
|---------|------|-----------|-------|
| MM8108-RD09 | USB Dongle Reference | USB 2.0 | Reference design |
| MM8108-EKH19 | Eval Kit | USB | Includes Pi 4B |

---

## Integration Considerations

### Antenna Design
- Sub-GHz antennas are larger than 2.4GHz
- Consider PCB antenna, whip, or external SMA
- Impedance matching critical for range
- Regulatory antenna gain limits apply

### Power Supply
- Clean 3.0-3.6V (MM6108) or 3.3V (MM8108)
- Handle TX current spikes (300+ mA)
- Low noise supply for radio performance

### Host Processor Options
- Raspberry Pi (Zero 2W, 4, 5)
- ESP32 (via SPI)
- STM32 (via SPI/SDIO)
- Any Linux SBC with USB (MM8108)

### Software Stack
- Linux mac80211 subsystem
- Morse Micro drivers (proprietary)
- OpenWRT packages available
- FreeRTOS for embedded

---

## Regulatory Compliance

### United States (FCC)
- Band: 902-928 MHz
- Power: Up to 1W EIRP (with directional antenna)
- Certification: Wi-Fi Alliance HaLow

### Europe (ETSI)
- Band: 863-868 MHz
- Power: More restricted than US
- Duty cycle limitations may apply

### Other Regions
- Various sub-GHz bands
- Check local regulations
- Some regions not yet approved

---

## Resources

### Morse Micro
- Website: https://www.morsemicro.com/
- Product Page: https://www.morsemicro.com/chips/
- Contact for samples and evaluation kits

### Documentation
- MM6108 Datasheet: Available under NDA
- MM8108 Product Brief: https://www.morsemicro.com/wp-content/uploads/2024/04/USA-_MM8108_Product-Brief.pdf
- Integration guides: Contact Morse Micro

### Community
- Wi-Fi HaLow Alliance: https://www.wi-fi.org/discover-wi-fi/wi-fi-halow
- aHaLow (product reviews): https://www.ahalow.com/

### Development Partners
- GL.iNet (router expertise)
- AzureWave (module manufacturing)
- Various ODM partners
