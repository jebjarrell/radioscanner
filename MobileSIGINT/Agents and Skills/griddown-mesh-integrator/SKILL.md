---
name: griddown-mesh-integrator
description: Configure, deploy, and troubleshoot Wi-Fi HaLow and OpenWRT mesh networks. Use this skill when generating device configurations, troubleshooting mesh connectivity issues, running diagnostics, or performing operational tasks on GridDown mesh networks. Triggers on requests to configure HaLowLink 1, set up BATMAN-adv or OLSR, generate OpenWRT UCI configs, diagnose mesh problems, or fix network issues.
---

# GridDown Mesh Network Integrator

Configure, deploy, and troubleshoot mesh networks for emergency communications.

## When to Use This Skill

- **Configuring devices**: Generate OpenWRT UCI configs for gateway/relay/edge nodes
- **Troubleshooting**: Diagnose connectivity issues, poor performance, routing problems
- **Diagnostics**: Run commands to inspect mesh state, link quality, routing tables
- **Operational tasks**: Firmware updates, backup/restore, staged rollouts

For network **design and planning** (topology, hardware selection, link budgets), use the griddown-mesh-architect skill instead.

## Configuration Generation

When generating configurations, always provide:

1. **Prerequisites** - What must be done first
2. **Backup Commands** - Save current config before changes
3. **Configuration Files** - Complete contents with comments
4. **Apply Commands** - How to activate the configuration
5. **Verification Commands** - Confirm it worked
6. **Rollback Procedure** - How to undo if something breaks

### Placeholder Convention

Use `{{VARIABLE}}` for site-specific values that must be changed:
- `{{HOSTNAME}}` - Node hostname (e.g., gd-gateway-main)
- `{{MESH_IP}}` - Node's mesh IP (e.g., 10.73.0.1)
- `{{GATEWAY_IP}}` - Gateway node IP
- `{{MESH_SSID}}` - Mesh network SSID
- `{{MESH_KEY}}` - WPA3/WPA2 pre-shared key
- `{{CLIENT_SSID}}` - Client WiFi SSID
- `{{CLIENT_KEY}}` - Client WiFi password
- `{{RADIO_CHANNEL}}` - WiFi channel

## Diagnostic Commands

### BATMAN-adv

```bash
# Mesh topology
batctl o              # Originator table (all mesh nodes, TQ values)
batctl n              # Direct neighbors
batctl gwl            # Gateway list
batctl if             # Interfaces in batman mesh

# Debugging
batctl tl             # Local translation table (MACs)
batctl tg             # Global translation table
batctl ping <MAC>     # Ping mesh node by MAC address
batctl traceroute <MAC>

# Gateway status
batctl gw_mode        # Check gateway mode (off/client/server)
```

### OLSR

```bash
# Via txtinfo plugin (port 2006)
echo "/neighbors" | nc localhost 2006    # Direct neighbors
echo "/routes" | nc localhost 2006       # Route table
echo "/topology" | nc localhost 2006     # Full mesh topology
echo "/hna" | nc localhost 2006          # Network announcements
echo "/all" | nc localhost 2006          # Everything

# Web interface
curl http://localhost:1979/              # httpinfo dashboard
```

### Wireless

```bash
iwinfo                        # All wireless interfaces
iwinfo mesh0 info             # Specific interface details
iwinfo mesh0 assoclist        # Associated stations with signal
iw dev mesh0 station dump     # Detailed station info
iw dev mesh0 get mesh_param mesh_fwding  # Check mesh forwarding
```

### General Network

```bash
ip addr                       # IP addresses
ip route                      # Routing table
ip link                       # Interface status
ping -c 3 10.73.0.2          # Test server connectivity
cat /proc/sys/net/ipv4/ip_forward  # IP forwarding enabled?
```

## Troubleshooting Flowcharts

### No Mesh Neighbors Visible

```
1. Check interface is up
   → ip link show mesh0
   → Should show "UP" state

2. Verify mesh mode active
   → iwinfo mesh0 info
   → Should show Mode: Mesh Point

3. For BATMAN-adv, check interface added
   → batctl if
   → Should show: mesh0: active

4. For BATMAN-adv, verify mesh_fwding disabled
   → iw dev mesh0 get mesh_param mesh_fwding
   → Must be 0 (batman handles forwarding)

5. Check encryption matches ALL nodes
   → uci show wireless | grep -E 'encryption|key'
   → Must be identical on every mesh node

6. Verify channel/frequency match
   → iwinfo mesh0 info | grep Channel
   → All nodes must use same channel

7. Physical checks
   → Antenna connected?
   → Nodes within range?
   → Line of sight?
```

### Gateway Not Reachable

```
1. On gateway, verify server mode
   → batctl gw_mode
   → Should show: server

2. On client, check gateway visible
   → batctl gwl
   → Should list gateway with bandwidth

3. Check IP routing
   → ip route
   → Should have route to gateway

4. Check IP forwarding on gateway
   → cat /proc/sys/net/ipv4/ip_forward
   → Must be 1

5. Check firewall
   → iptables -L FORWARD -n
   → Should ACCEPT mesh traffic

6. Test layer 2 first
   → batctl ping <gateway-MAC>
   → If this works, issue is layer 3
```

### Poor Performance / High Latency

```
1. Check link quality
   → batctl o
   → TQ values: 255=perfect, <100=marginal, <50=poor

2. For OLSR, check ETX
   → curl http://localhost:1979/
   → ETX: 1.0=perfect, 2.0=50% loss, >3=poor

3. Check signal strength
   → iwinfo mesh0 assoclist
   → RSSI > -70 dBm preferred

4. Consider bandwidth reduction
   → For HaLow: try 4MHz or 2MHz instead of 8MHz
   → Trades throughput for range/reliability

5. Check for interference
   → 900 MHz band: ISM devices, LoRa, other HaLow
   → 2.4 GHz: WiFi, Bluetooth, microwaves

6. Verify antenna orientation
   → Omni antennas: vertical orientation
   → Directional: pointed at peer node
```

### DHCP Not Working

```
1. Verify DHCP server running (on gateway only)
   → ps | grep dnsmasq
   → Should show dnsmasq process

2. Check DHCP config
   → uci show dhcp
   → Verify interface, range, lease time

3. On relay/edge nodes, DHCP should be disabled
   → uci get dhcp.lan.ignore
   → Should be 1

4. Check bridge includes bat0
   → brctl show
   → bat0 should be in br-lan

5. Test from client
   → dhclient -v eth0  (or interface name)
   → Watch for DHCPOFFER
```

## Safety Constraints

1. **Always backup before changes**
   ```bash
   sysupgrade -b /tmp/backup-$(hostname)-$(date +%Y%m%d).tar.gz
   ```

2. **Staged rollouts for remote nodes**
   - Configure one node at a time
   - Verify connectivity before proceeding
   - Have physical access fallback plan

3. **Risky command warnings**
   - `/etc/init.d/network restart` - May lose SSH connection
   - `sysupgrade` - Device will reboot
   - Firewall changes - Test with timeout: `sleep 300 && reboot &`

4. **Never disable security without acknowledgment**
   - Encryption should always be enabled
   - Document any security exceptions

## Configuration Templates

Templates in `assets/` provide complete OpenWRT configurations:

- **gateway-node.conf** - HaLowLink 1 or router as main gateway
  - BATMAN-adv gw_mode=server
  - DHCP server enabled
  - Bridge: eth0 + bat0
  
- **relay-node.conf** - Extends mesh coverage
  - BATMAN-adv gw_mode=client  
  - DHCP disabled
  - Mesh backhaul only

- **edge-node.conf** - End-point with client WiFi
  - BATMAN-adv gw_mode=client
  - DHCP disabled
  - Client AP on separate radio (preferred)

## Reference Documents

Detailed configuration references are in `../griddown-mesh-architect/references/`:

- **batman-adv.md** - Full BATMAN-adv setup, UCI config, tuning, troubleshooting
- **olsr.md** - OLSR daemon config, plugins, HNA, Smart Gateway
- **halowlink-1.md** - HaLowLink 1 hardware, default access, firmware, modes
- **openwrt-devices.md** - Router recommendations, specs, installation
- **architecture.md** - Server integration, IP scheme, DNS, firewall rules

## Codebase References

- `/openwrt/package/halow-mesh-gateway/` - OpenWRT package source
- `/openwrt/docs/HALOW_GATEWAY_DEPLOYMENT.md` - Comprehensive deployment guide (~1000 lines)
- `/openwrt/*.pdf` - Morse Micro hardware documentation

## Output Format for Troubleshooting

When troubleshooting, structure responses as:

1. **Symptom Analysis** - Confirm understanding of the problem
2. **Diagnostic Steps** - Commands to run with expected vs actual output
3. **Root Cause** - Most likely cause based on diagnostics
4. **Resolution** - Step-by-step fix with commands
5. **Prevention** - How to avoid this issue in the future
