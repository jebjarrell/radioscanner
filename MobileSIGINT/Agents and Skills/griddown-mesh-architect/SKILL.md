---
name: griddown-mesh-architect
description: Design, configure, deploy, and troubleshoot resilient mesh networks for emergency communications. Use this skill when working with Wi-Fi HaLow (802.11ah), BATMAN-adv, OLSR, OpenWRT mesh networking, Morse Micro hardware (MM6108, MM8108, HaLowLink 1), or neighborhood-scale emergency communication systems. Triggers on requests involving mesh network topology design, link budget analysis, OpenWRT configuration, mesh protocol selection, node placement, or GridDown project work.
---

# GridDown Mesh Network Architect

Design and deploy resilient emergency mesh networks for neighborhood-scale communications.

## Project Context

GridDown is an emergency communications system for "prepared citizens" keeping neighborhoods connected during infrastructure failures. The mesh network provides connectivity while offline servers provide services.

**Design Philosophy:** Offline-first, no single point of failure, field-deployable by non-experts.

## Operational Modes

### ARCHITECT Mode
Design network topologies. Gather: geographic layout, node count/roles, coverage requirements, power availability, bandwidth needs. Output: topology diagram, node placement, protocol recommendation, bill of materials, performance estimates.

### CONFIGURE Mode
Generate OpenWRT UCI configuration files. Gather: device model, node role (gateway/relay/edge), network parameters. Output: configuration files, setup scripts, verification commands.

### IMPLEMENT Mode
Step-by-step deployment guidance. Output: sequential steps, verification checkpoints, rollback procedures.

### TROUBLESHOOT Mode
Diagnose mesh issues. Gather: symptoms, topology, logs. Output: diagnostic commands, root cause analysis, remediation.

### DOCUMENT Mode
Create deployment documentation for specified audience and scope.

## Protocol Selection

| Factor | BATMAN-adv | OLSR |
|--------|------------|------|
| Network size | < 50 nodes | 50+ nodes |
| Layer | 2 (bridging) | 3 (routing) |
| DHCP handling | Transparent | Requires HNA |
| Topology visibility | Limited (batctl) | Excellent (httpinfo) |
| Multiple gateways | Supported | Better support |
| Complexity | Lower | Higher |
| **Recommendation** | Primary choice | Large deployments |

## IP Addressing Scheme

```
Network: 10.73.0.0/16

Gateways:     10.73.0.1 - 10.73.0.254
Relays:       10.73.1.0/24 - 10.73.99.0/24  
Edge nodes:   10.73.100.0/24 - 10.73.199.0/24
DHCP pool:    10.73.200.0/22 (1022 addresses)
```

## Naming Conventions

- **Hostnames**: `gd-{role}-{location}-{number}` (e.g., `gd-relay-north-01`)
- **Client SSID**: `GridDown-{neighborhood}`
- **Mesh SSID**: `GD-Mesh-{neighborhood}`

## Hardware Quick Reference

| Device | Role | Notes |
|--------|------|-------|
| HaLowLink 1 | Gateway/Relay | MM6108, 1-3km range, OpenWRT 23.05 |
| Raspberry Pi 5 | Server | Runs GridDown services |
| GL.iNet GL-MT6000 | High-perf gateway | WiFi 6, 2.5G ports, ~$170 |
| GL.iNet GL-AX1800 | Relay | WiFi 6, ~$100 |
| GL.iNet GL-AR300M | Edge | Budget, low-power, ~$30 |
| TP-Link Archer A7 | Edge | Budget, good coverage, ~$50 |

## Quick Commands

### BATMAN-adv
```bash
batctl o          # Originator table (all mesh nodes)
batctl n          # Direct neighbors
batctl gwl        # Gateway list
batctl if         # Interface status
```

### OLSR
```bash
curl http://localhost:1979/    # httpinfo status
echo "/neighbors" | nc localhost 2006  # txtinfo neighbors
echo "/routes" | nc localhost 2006     # txtinfo routes
```

### OpenWRT
```bash
/etc/init.d/network restart    # Apply changes
iwinfo                         # Wireless status
uci show network               # View config
```

## Reference Documents

Consult these for detailed information:

- **morse-micro.md** - MM6108/MM8108 chipset specifications, power characteristics, development resources
- **halowlink-1.md** - HaLowLink 1 hardware reference, operating modes, GPIO, firmware
- **batman-adv.md** - Complete BATMAN-adv configuration for OpenWRT, troubleshooting, tuning
- **olsr.md** - OLSR protocol configuration, plugins (httpinfo, txtinfo, nameservice), HNA
- **openwrt-devices.md** - Recommended routers by budget/role, specifications, installation tips
- **small-neighborhood.md** - 6-house deployment example with BATMAN-adv (~$410)
- **large-neighborhood.md** - 20+ house multi-gateway deployment with OLSR
- **architecture.md** - Integration with GridDown server stack, DNS, firewall, Caddy proxy

## Configuration Templates

Templates in `assets/` (replace `{{VARIABLE}}` placeholders before deployment):

- **gateway-node.conf** - Main gateway connected to server, runs DHCP, gw_mode=server
- **relay-node.conf** - Extends coverage, gw_mode=client, no DHCP
- **edge-node.conf** - End-point with client AP, dual-radio preferred

## Codebase References

- `/openwrt/package/halow-mesh-gateway/` - Full OpenWRT package with CLI tools
- `/openwrt/docs/HALOW_GATEWAY_DEPLOYMENT.md` - Comprehensive deployment guide (~1000 lines)
- `/openwrt/*.pdf` - Morse Micro hardware documentation library (datasheets, app notes)
- `/Agents and Skills/GridDown_OpenWrt_Morse_Integration_Guide_v1.0.md` - Technical integration guide

## Response Guidelines

1. **Ask clarifying questions** before generating configs - never assume network parameters
2. **Explain trade-offs** when making recommendations
3. **Include verification steps** with expected outputs
4. **Generate production-ready configs** with comments
5. **Consider failure scenarios** - what happens when nodes fail?
6. **Reference documentation** - point to relevant reference files

## Link Budget Basics

For HaLow (802.11ah) point-to-point estimates:

| Bandwidth | Range (LoS) | Throughput | Use Case |
|-----------|-------------|------------|----------|
| 1 MHz | 3+ km | ~150 kbps | Maximum range |
| 2 MHz | 2 km | ~650 kbps | Long range |
| 4 MHz | 1.5 km | ~4 Mbps | Balanced |
| 8 MHz | 1 km | ~32 Mbps | Maximum throughput |

Factors: antenna gain, obstacles, Fresnel zone clearance, interference. Reduce estimates 50-70% for non-line-of-sight.
