# Large Neighborhood / Multi-Block Mesh Topology
# GridDown Example Deployment

## Scenario

A larger deployment covering multiple city blocks or a rural community.
20+ houses across 1-2 km². Requires strategic relay placement and potentially
multiple gateways for redundancy.

For this scale, consider **OLSR** as primary protocol for better topology
visibility and multi-gateway support.

## Network Diagram

```
                              1 km
    ◄─────────────────────────────────────────────────────────►

    ╔═══════════╗                                    ┌─────────┐
    ║ GATEWAY 1 ║─────────────────────────────────►  │ Edge 10 │
    ║ (Primary) ║         Backbone Link              └────┬────┘
    ╚═════╤═════╝                                         │
          │                                               │
     ┌────┴────┐      ┌─────────┐      ┌─────────┐  ┌────┴────┐
     │ Relay 1 │◄────►│ Relay 2 │◄────►│ Relay 3 │◄►│ Relay 4 │
     └────┬────┘      └────┬────┘      └────┬────┘  └────┬────┘
          │                │                │            │
    ┌─────┼─────┐    ┌─────┼─────┐    ┌─────┼─────┐     │
    │     │     │    │     │     │    │     │     │     │
  Edge  Edge  Edge Edge  Edge  Edge Edge  Edge  Edge  Edge
   1     2     3    4     5     6    7     8     9    11

                                            ╔═══════════╗
                                            ║ GATEWAY 2 ║
                                            ║ (Backup)  ║
                                            ╚═══════════╝
```

## Node Inventory

### Gateways (2)

| ID | Location | IP | Hardware | Role |
|----|----------|------|----------|------|
| Gateway 1 | Community Center | 10.73.0.1 | HaLowLink 1 + Pi 5 | Primary |
| Gateway 2 | Fire Station | 10.73.0.2 | HaLowLink 1 + Pi 5 | Backup |

### Relays (4)

| ID | Location | IP | Hardware | Coverage |
|----|----------|------|----------|----------|
| Relay 1 | Church Steeple | 10.73.1.1 | HaLowLink 1 | West sector |
| Relay 2 | Water Tower | 10.73.2.1 | HaLowLink 1 | Central |
| Relay 3 | School Roof | 10.73.3.1 | GL.iNet GL-MT6000 | East sector |
| Relay 4 | Grain Elevator | 10.73.4.1 | HaLowLink 1 | South sector |

### Edge Nodes (11)

| ID | Address | IP | Hardware |
|----|---------|------|----------|
| Edge 1 | 101 Oak | 10.73.100.1 | GL.iNet GL-AX1800 |
| Edge 2 | 105 Oak | 10.73.100.2 | TP-Link Archer A7 |
| Edge 3 | 110 Oak | 10.73.100.3 | GL.iNet GL-AR300M |
| Edge 4 | 201 Elm | 10.73.100.4 | GL.iNet GL-AX1800 |
| Edge 5 | 205 Elm | 10.73.100.5 | TP-Link Archer A7 |
| Edge 6 | 210 Elm | 10.73.100.6 | GL.iNet GL-AR300M |
| Edge 7 | 301 Pine | 10.73.100.7 | GL.iNet GL-AX1800 |
| Edge 8 | 305 Pine | 10.73.100.8 | TP-Link Archer A7 |
| Edge 9 | 310 Pine | 10.73.100.9 | GL.iNet GL-AR300M |
| Edge 10 | 401 Maple | 10.73.100.10 | GL.iNet GL-AX1800 |
| Edge 11 | 405 Maple | 10.73.100.11 | TP-Link Archer A7 |

## Protocol Selection: OLSR

For this deployment size (15+ nodes), OLSR is recommended:

### Reasons
1. **Topology visibility** - httpinfo plugin shows full network map
2. **Multi-gateway** - SmartGateway handles failover automatically
3. **Scalability** - Proven in 100+ node deployments
4. **Debugging** - txtinfo plugin for scripted monitoring

### Configuration Approach

```bash
# All nodes run olsrd with:
# - LinkQualityLevel 2 (ETX routing)
# - httpinfo on port 1979
# - txtinfo on port 2006
# - nameservice for hostname resolution
```

## IP Addressing Scheme

```
10.73.0.0/16 - Full network

Gateways:        10.73.0.1 - 10.73.0.10
Relays:          10.73.1.0/24 - 10.73.10.0/24
Edge Nodes:      10.73.100.0/24 - 10.73.199.0/24
DHCP Pool:       10.73.200.0/21 (2046 addresses)
Reserved:        10.73.208.0/20
```

## Hardware Bill of Materials

| Item | Quantity | Unit Cost | Total |
|------|----------|-----------|-------|
| HaLowLink 1 | 5 | $TBD | $TBD |
| Raspberry Pi 5 (8GB) | 2 | $80 | $160 |
| GL.iNet GL-MT6000 | 1 | $170 | $170 |
| GL.iNet GL-AX1800 | 4 | $100 | $400 |
| TP-Link Archer A7 | 4 | $50 | $200 |
| GL.iNet GL-AR300M | 3 | $30 | $90 |
| Outdoor enclosures (relay) | 4 | $40 | $160 |
| POE injectors | 4 | $15 | $60 |
| Directional antennas | 4 | $30 | $120 |
| Cables, mounts, misc | 1 | $200 | $200 |
| **Total** | | | **~$1560 + HaLow** |

## Backbone Design

### High Elevation Relays

Place relays at elevated positions for maximum coverage:

```
                    Water Tower (Relay 2)
                         │
                         │ 800m LoS
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
    Church           Community         School
   (Relay 1)        (Gateway 1)       (Relay 3)
        │                                 │
        └─────────────────────────────────┘
                     │
                     ▼
               Grain Elevator
                 (Relay 4)
                     │
                     ▼
               Fire Station
                (Gateway 2)
```

### Backbone Links

| From | To | Distance | Expected Signal |
|------|------|----------|-----------------|
| Gateway 1 | Relay 1 | 200m | Excellent |
| Gateway 1 | Relay 2 | 500m | Good |
| Relay 1 | Relay 2 | 400m | Good |
| Relay 2 | Relay 3 | 600m | Good |
| Relay 3 | Relay 4 | 350m | Excellent |
| Relay 4 | Gateway 2 | 250m | Excellent |
| Gateway 1 | Edge 10 | 1000m | Marginal (HaLow) |

## Multi-Gateway Configuration

### OLSR Smart Gateway

On Gateway 1 (Primary):
```bash
config olsrd
    option SmartGateway 'yes'
    option SmartGatewayUplink 'both'
    option SmartGatewaySpeed '100000 100000'
    option SmartGatewayPrefix '0.0.0.0/0'

config Hna4
    option netaddr '0.0.0.0'
    option netmask '0.0.0.0'
```

On Gateway 2 (Backup):
```bash
config olsrd
    option SmartGateway 'yes'
    option SmartGatewayUplink 'both'
    option SmartGatewaySpeed '50000 50000'  # Lower to prefer Gateway 1
```

### Automatic Failover

1. Client nodes select gateway based on path quality + gateway speed
2. If Gateway 1 fails, OLSR reconverges in ~30-60 seconds
3. Clients automatically route to Gateway 2
4. When Gateway 1 returns, traffic shifts back (if configured)

## Service Distribution

### Primary Server (Gateway 1)
- Full GridDown stack
- Primary bulletin board
- Kiwix (Wikipedia)
- Calibre-Web

### Backup Server (Gateway 2)
- Minimal GridDown stack
- Read-only bulletin board mirror
- Essential services only

### Data Synchronization
- rsync cron job between servers
- Bulletin posts replicate hourly
- User data backed up nightly

## Monitoring Dashboard

### OLSR Visualization

Access at `http://gateway-ip:1979/`:
- Real-time topology map
- Link quality metrics
- Route tables
- Gateway status

### Automated Health Checks

```bash
#!/bin/bash
# /usr/local/bin/mesh-health.sh
# Run every 5 minutes via cron

NODES="10.73.1.1 10.73.2.1 10.73.3.1 10.73.4.1"
GATEWAYS="10.73.0.1 10.73.0.2"
LOG="/var/log/mesh-health.log"

echo "$(date): Health check starting" >> $LOG

for node in $NODES; do
    if ping -c 1 -W 2 $node > /dev/null 2>&1; then
        echo "$(date): Relay $node UP" >> $LOG
    else
        echo "$(date): WARNING - Relay $node DOWN" >> $LOG
        # Alert logic here
    fi
done

for gw in $GATEWAYS; do
    if ping -c 1 -W 2 $gw > /dev/null 2>&1; then
        echo "$(date): Gateway $gw UP" >> $LOG
    else
        echo "$(date): CRITICAL - Gateway $gw DOWN" >> $LOG
        # Alert logic here
    fi
done
```

## Deployment Phases

### Phase 1: Backbone
1. Deploy both gateways
2. Deploy elevated relays
3. Verify backbone connectivity
4. Test inter-gateway failover

### Phase 2: West Sector
1. Deploy Edge 1-3
2. Verify connection to Relay 1
3. Test client access

### Phase 3: Central Sector
1. Deploy Edge 4-6
2. Verify multi-path routing

### Phase 4: East Sector
1. Deploy Edge 7-9
2. Complete coverage verification

### Phase 5: South Sector
1. Deploy Edge 10-11
2. Final verification
3. Document as-built topology

## Capacity Planning

### Bandwidth Budget

| Path | Capacity | Notes |
|------|----------|-------|
| Gateway ↔ Relay | 32 Mbps | HaLow single link |
| Relay ↔ Relay | 32 Mbps | HaLow backbone |
| Relay ↔ Edge | 150+ Mbps | 2.4/5 GHz |
| Edge ↔ Client | 300+ Mbps | WiFi 5/6 |

### Bottleneck
The HaLow backbone is the limiting factor at 32 Mbps.
For emergency communications, this is adequate for:
- Text-based bulletin board
- Small file transfers
- Compressed voice/ATAK

### Not Recommended
- HD video streaming
- Large file downloads
- High-bandwidth applications

## Failure Scenarios

### Single Relay Failure
- Traffic reroutes through alternate paths
- Edge nodes may have reduced throughput
- No service interruption

### Gateway 1 Failure
- 30-60 second reconvergence
- All traffic routes to Gateway 2
- Services continue (backup server)

### Backbone Partition
- Sectors become isolated
- Local communication continues
- Cross-sector fails until repair

### Complete Power Loss
- Battery backup on gateways: 4+ hours
- Solar on elevated relays: continuous
- Edge nodes: varies by site

## Maintenance

### Monthly
- Review OLSR topology via httpinfo
- Check link qualities (should be < 2.0 ETX)
- Verify backup server sync
- Test gateway failover

### Quarterly
- Firmware updates (staged rollout)
- Physical inspection of outdoor nodes
- Antenna alignment verification
- Battery replacement check

### Annually
- Full disaster drill
- Documentation update
- Hardware refresh planning
- Capacity assessment
