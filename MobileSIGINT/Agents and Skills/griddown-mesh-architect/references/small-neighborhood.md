# Small Neighborhood Mesh Topology
# GridDown Example Deployment

## Scenario

A small suburban neighborhood with 6 houses wanting emergency mesh coverage.
One house has the GridDown server. Total area approximately 500m x 300m.

## Network Diagram

```
                     N
                     ↑
    ┌────────────────────────────────────────────────────────┐
    │                    Oak Street                           │
    │                                                         │
    │  ┌─────────┐                           ┌─────────┐     │
    │  │ #101    │         100m              │ #105    │     │
    │  │ Smith   │◄─────────────────────────►│ Wilson  │     │
    │  │ (Edge)  │                           │ (Edge)  │     │
    │  └────┬────┘                           └────┬────┘     │
    │       │                                     │          │
    │       │ 80m                                 │ 60m      │
    │       │                                     │          │
    │       ▼                                     ▼          │
    │  ┌─────────┐                           ┌─────────┐     │
    │  │ #102    │         120m              │ #106    │     │
    │  │ Johnson │◄─────────────────────────►│ Chen    │     │
    │  │ (Relay) │                           │ (Edge)  │     │
    │  └────┬────┘                           └─────────┘     │
    │       │                                                │
    │       │ 50m                                            │
    │       ▼                                                │
    │  ╔═════════╗                                          │
    │  ║ #103    ║         150m              ┌─────────┐     │
    │  ║ Garcia  ║◄─────────────────────────►│ #107    │     │
    │  ║(Gateway)║                           │ Park    │     │
    │  ║ + Pi 5  ║                           │ (Edge)  │     │
    │  ╚═════════╝                           └─────────┘     │
    │                                                         │
    │                    Elm Street                           │
    └────────────────────────────────────────────────────────┘
```

## Node Assignments

| Address | Owner | Node Type | IP Address | Hardware |
|---------|-------|-----------|------------|----------|
| #103 | Garcia | **Gateway** | 10.73.0.1 | HaLowLink 1 + Pi 5 |
| #102 | Johnson | Relay | 10.73.1.1 | GL.iNet GL-AX1800 |
| #101 | Smith | Edge | 10.73.100.1 | GL.iNet GL-AR300M |
| #105 | Wilson | Edge | 10.73.100.2 | GL.iNet GL-AR300M |
| #106 | Chen | Edge | 10.73.100.3 | TP-Link Archer A7 |
| #107 | Park | Edge | 10.73.100.4 | TP-Link Archer A7 |

## Network Configuration

### Global Settings

| Parameter | Value |
|-----------|-------|
| Mesh SSID | `GD-Mesh-Oak` |
| Mesh Key | `[generate secure key]` |
| Mesh Channel | 1 (2.4 GHz) |
| Client SSID | `GridDown-Oak` |
| Network | 10.73.0.0/16 |
| DHCP Range | 10.73.200.1 - 10.73.203.254 |
| Domain | griddown.local |

### Expected Mesh Topology

```
                    Smith (#101)
                        │
                        │ [1 hop]
                        ▼
    Wilson (#105) ◄──► Johnson (#102) ◄──► Chen (#106)
                        │
                        │ [direct]
                        ▼
                   Garcia (#103) ◄────────► Park (#107)
                   [GATEWAY]
                        │
                    [Server]
```

## Hardware Bill of Materials

| Item | Quantity | Unit Cost | Total |
|------|----------|-----------|-------|
| HaLowLink 1 | 1 | $TBD | $TBD |
| Raspberry Pi 5 (8GB) | 1 | $80 | $80 |
| GL.iNet GL-AX1800 | 1 | $100 | $100 |
| GL.iNet GL-AR300M | 2 | $30 | $60 |
| TP-Link Archer A7 | 2 | $50 | $100 |
| Cat6 cables (short) | 2 | $5 | $10 |
| USB-C power supplies | 6 | $10 | $60 |
| **Total** | | | **~$410 + HaLow** |

## Deployment Order

1. **Gateway Node (#103 Garcia)**
   - Flash HaLowLink 1 with gateway config
   - Connect to Pi 5 server
   - Verify server services accessible
   - Test DHCP is serving

2. **Relay Node (#102 Johnson)**
   - Flash GL-AX1800 with relay config
   - Power on and verify mesh join
   - Confirm gateway visible: `batctl gwl`

3. **Edge Nodes (one at a time)**
   - Start with closest to gateway/relay
   - Flash with edge config
   - Verify mesh join and gateway visibility
   - Test client connectivity

4. **Verification**
   - Walk test with mobile device
   - Check all nodes visible: `batctl o` on gateway
   - Test failover: power off relay, verify rerouting

## Expected Performance

### Coverage
- Each 802.11ah node: ~1km radius (line of sight)
- Each 2.4GHz node: ~100m indoor, 300m outdoor
- Combined: Full neighborhood coverage with overlap

### Bandwidth
- Mesh backhaul: 32.5 Mbps max (HaLow)
- Per-hop latency: ~5-15ms
- End-to-end (edge to server): ~20-50ms

### Capacity
- Concurrent clients per edge node: 20-30
- Total neighborhood: 100+ clients
- Practical limit: Server bandwidth

## Failure Scenarios

### Relay Node (#102) Fails
- Smith (#101) routes through Wilson (#105) if visible
- Or connects directly to gateway if in range
- Self-healing via BATMAN-adv

### Gateway Node (#103) Fails
- Entire mesh loses server access
- Clients can still communicate locally (if AP isolation off)
- **Mitigation**: Consider second gateway

### Server (Pi 5) Fails
- Mesh still routes
- Services unavailable
- Clients can reach each other

### Power Outage
- Prioritize battery backup on gateway + 1 relay
- Edge nodes less critical (reduced coverage, not total loss)

## Monitoring Commands

Run from gateway:

```bash
#!/bin/bash
# mesh-status.sh

echo "=== GridDown Oak Street Mesh ==="
echo ""
echo "--- Mesh Nodes (Originators) ---"
batctl o
echo ""
echo "--- Direct Neighbors ---"
batctl n
echo ""
echo "--- Gateway Status ---"
batctl gwl
echo ""
echo "--- Client Devices (DHCP leases) ---"
cat /tmp/dhcp.leases
echo ""
echo "--- Service Check ---"
ping -c 1 10.73.0.2 > /dev/null && echo "Server: UP" || echo "Server: DOWN"
curl -s -o /dev/null -w "%{http_code}" http://10.73.0.2/ && echo " HTTP: OK" || echo " HTTP: FAIL"
```

## Configuration Files

See generated configs in:
- `configs/gd-gateway-garcia/`
- `configs/gd-relay-johnson/`
- `configs/gd-edge-smith/`
- `configs/gd-edge-wilson/`
- `configs/gd-edge-chen/`
- `configs/gd-edge-park/`

## Future Expansion

### Add Relay for Better Coverage
If Chen (#106) or Park (#107) have weak signal:
- Add relay between gateway and far edge nodes
- Consider elevated antenna mounting

### Second Gateway for Redundancy
- Johnson (#102) could serve as backup gateway
- Requires second server or service replication

### Solar Power
- Edge nodes are low power (~3-5W)
- Small solar panel + battery bank viable
- Extend operation during extended outage
