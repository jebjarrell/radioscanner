# OLSR (Optimized Link State Routing) Reference

## Overview

OLSR is a Layer 3 proactive routing protocol designed for mobile ad-hoc networks. It continuously maintains routes to all destinations by periodically exchanging topology information. The "optimized" aspect refers to its use of Multipoint Relays (MPRs) to reduce flooding overhead.

## Key Characteristics

- **Layer**: 3 (Network Layer)
- **Type**: Proactive (table-driven)
- **Routing Metric**: ETX (Expected Transmission Count) with Link Quality
- **Optimization**: Multipoint Relays reduce broadcast overhead
- **Visibility**: Excellent topology visibility via plugins

## Versions

### OLSRv1 (olsrd)
- Original implementation
- Widely deployed and tested
- Extensive plugin ecosystem
- Package: `olsrd`

### OLSRv2 (olsrd2/oonf)
- Newer, more modular design
- Better scalability
- DLEP support for L2 information
- Package: `oonf-olsrd2` or `olsrd2`

**Recommendation for GridDown**: Start with OLSRv1 for its maturity and documentation.

## OpenWRT Installation

```bash
# Update package lists
opkg update

# Core OLSR daemon
opkg install olsrd

# Useful plugins
opkg install olsrd-mod-txtinfo      # Text-based status
opkg install olsrd-mod-httpinfo     # Web-based status
opkg install olsrd-mod-nameservice  # DNS/hostname resolution
opkg install olsrd-mod-dyn-gw       # Dynamic gateway detection
opkg install olsrd-mod-arprefresh   # ARP cache refresh
opkg install olsrd-mod-jsoninfo     # JSON API

# LuCI interface (optional)
opkg install luci-app-olsr luci-app-olsr-services
```

## Configuration

### /etc/config/olsrd

```bash
config olsrd
    option IpVersion '4'
    option LinkQualityLevel '2'        # 0=off, 1=basic, 2=advanced
    option LinkQualityAlgorithm 'etx_ff'
    option FIBMetric 'flat'
    option Pollrate '0.05'
    option TcRedundancy '2'
    option MprCoverage '7'
    option NatThreshold '1.0'
    option SmartGateway 'yes'          # For internet gateway
    option SmartGatewayUplink 'both'

config InterfaceDefaults
    option Mode 'mesh'
    option Ip4Broadcast '255.255.255.255'
    option HelloInterval '2.0'
    option HelloValidityTime '20.0'
    option TcInterval '5.0'
    option TcValidityTime '300.0'
    option MidInterval '5.0'
    option MidValidityTime '300.0'
    option HnaInterval '5.0'
    option HnaValidityTime '300.0'

# Mesh interface
config Interface
    option ignore '0'
    option interface 'mesh0'
    option Mode 'mesh'

# Announce local network (HNA)
config Hna4
    option netaddr '10.73.0.0'
    option netmask '255.255.255.0'

# Announce as default gateway (if applicable)
# config Hna4
#     option netaddr '0.0.0.0'
#     option netmask '0.0.0.0'

# HTTP info plugin (web status page)
config LoadPlugin
    option library 'olsrd_httpinfo'
    option ignore '0'
    option port '1979'
    option host '0.0.0.0'
    list Net '0.0.0.0 0.0.0.0'

# Text info plugin (for scripts)
config LoadPlugin
    option library 'olsrd_txtinfo'
    option ignore '0'
    option port '2006'
    option accept '127.0.0.1'

# JSON info plugin (for APIs)
config LoadPlugin
    option library 'olsrd_jsoninfo'
    option ignore '0'
    option port '9090'
    option accept '127.0.0.1'

# Nameservice plugin (mesh DNS)
config LoadPlugin
    option library 'olsrd_nameservice'
    option ignore '0'
    option name 'gd-gateway-main'
    option suffix '.griddown.mesh'
    option hosts_file '/tmp/hosts/olsr'
    option latlon_file '/var/run/latlon.js'
```

### /etc/config/network

```bash
# Mesh interface - ad-hoc mode for OLSR
config interface 'mesh0'
    option proto 'static'
    option ipaddr '10.73.0.1'
    option netmask '255.255.0.0'

# Note: OLSR uses ad-hoc (IBSS) mode, not 802.11s mesh
```

### /etc/config/wireless

```bash
# OLSR uses ad-hoc mode
config wifi-iface 'olsr_radio0'
    option device 'radio0'
    option network 'mesh0'
    option mode 'adhoc'               # ad-hoc for OLSR
    option ssid 'GridDown-OLSR'
    option bssid '02:CA:FF:EE:BA:BE'  # Fixed BSSID for all nodes
    option encryption 'none'          # Or use wpa for encryption
    # option encryption 'psk2'
    # option key 'your-mesh-key'
```

## Plugin Configuration

### httpinfo - Web Status

Access at `http://node-ip:1979/`

Provides:
- Neighbor table
- Topology view
- Route table
- HNA table
- Mid table
- Link quality info

### txtinfo - Script Access

```bash
# Get all information
echo "/all" | nc localhost 2006

# Get neighbors only
echo "/neighbors" | nc localhost 2006

# Get routes
echo "/routes" | nc localhost 2006

# Get topology
echo "/topology" | nc localhost 2006

# Get HNA
echo "/hna" | nc localhost 2006
```

### nameservice - Mesh DNS

Automatically propagates hostnames across the mesh:

```bash
# All nodes will resolve each other as:
# hostname.griddown.mesh

# The plugin updates /tmp/hosts/olsr
# Add to dnsmasq:
uci add_list dhcp.@dnsmasq[0].addnhosts='/tmp/hosts/olsr'
uci commit dhcp
/etc/init.d/dnsmasq restart
```

## HNA (Host and Network Announcements)

HNA tells other nodes what networks this node can reach:

```bash
# Announce a local LAN
config Hna4
    option netaddr '192.168.1.0'
    option netmask '255.255.255.0'

# Announce as internet gateway
config Hna4
    option netaddr '0.0.0.0'
    option netmask '0.0.0.0'

# Announce a single host
config Hna4
    option netaddr '10.73.0.100'
    option netmask '255.255.255.255'
```

## Troubleshooting

### Check OLSR Status

```bash
# Is olsrd running?
ps | grep olsrd

# Check logs
logread | grep olsr

# View configuration
uci show olsrd

# Test txtinfo
echo "/neighbors" | nc localhost 2006
```

### No Neighbors Found

1. Verify wireless is in ad-hoc mode:
   ```bash
   iwinfo
   ```

2. Check BSSID matches on all nodes:
   ```bash
   iwinfo mesh0 info
   ```

3. Verify interface is configured in olsrd:
   ```bash
   uci show olsrd | grep interface
   ```

4. Check IP addressing - all nodes need IPs in same subnet

### Routes Not Propagating

1. Check HNA configuration
2. Verify firewall allows forwarding:
   ```bash
   iptables -L FORWARD
   ```
3. Enable IP forwarding:
   ```bash
   echo 1 > /proc/sys/net/ipv4/ip_forward
   ```

### Poor Link Quality

Check ETX values in httpinfo. High ETX (> 3) indicates poor links:
- Move nodes closer
- Improve antenna alignment
- Change channels to avoid interference

## Link Quality Algorithms

### ETX (Expected Transmission Count)
Default. Measures how many transmissions needed for successful delivery.
- ETX = 1: Perfect link
- ETX = 2: 50% packet loss
- ETX > 3: Poor link

### ETX-FF (ETX Freifunk)
Enhanced version with faster convergence:
```bash
uci set olsrd.@olsrd[0].LinkQualityAlgorithm='etx_ff'
```

### ETX-FPM (Fixed Point Math)
For low-resource devices:
```bash
uci set olsrd.@olsrd[0].LinkQualityAlgorithm='etx_fpm'
```

## Smart Gateway

For automatic internet gateway selection:

```bash
# On gateway node
config olsrd
    option SmartGateway 'yes'
    option SmartGatewayUplink 'both'
    option SmartGatewaySpeed '100000 100000'  # 100Mbps

# On client nodes
config olsrd
    option SmartGateway 'yes'
    option SmartGatewayUplink 'none'
```

## Firewall Configuration

OLSR needs UDP port 698:

```bash
# /etc/config/firewall
config rule
    option name 'Allow-OLSR'
    option src 'mesh'
    option dest_port '698'
    option proto 'udp'
    option target 'ACCEPT'

config rule
    option name 'Allow-OLSR-httpinfo'
    option src 'mesh'
    option dest_port '1979'
    option proto 'tcp'
    option target 'ACCEPT'
```

## OLSRv2 (Quick Reference)

For larger networks or future deployments:

```bash
opkg install oonf-olsrd2

# Configuration in /etc/config/olsrd2
config global
    option failfast 'no'
    option pidfile '/var/run/olsrd2.pid'

config olsrv2
    list originator 'default_accept'

config interface
    option ifname 'mesh0'
    list bindto 'default_accept'
```

## OLSR vs BATMAN-adv for GridDown

| Use Case | Recommendation |
|----------|----------------|
| Simple neighborhood mesh | BATMAN-adv |
| Need web-based monitoring | OLSR (httpinfo) |
| Multiple internet gateways | OLSR (SmartGateway) |
| Mixed wired/wireless | BATMAN-adv |
| Large network (50+ nodes) | OLSR |
| Non-technical operators | BATMAN-adv |

## Best Practices for GridDown

1. **Use consistent BSSID** - All nodes must match
2. **Plan IP addressing** - Each node needs unique IP
3. **Configure HNA carefully** - Avoid conflicts
4. **Enable httpinfo** - Essential for monitoring
5. **Use nameservice** - For hostname resolution
6. **Document topology** - Track node locations and roles
7. **Test failover** - Verify routes reconverge

## References

- [olsrd.org](http://www.olsr.org/)
- [OpenWRT OLSR Wiki](https://oldwiki.archive.openwrt.org/doc/howto/mesh.olsr)
- [Freifunk OLSR](https://wiki.freifunk.net/OLSR)
- [RFC 3626 - OLSR](https://tools.ietf.org/html/rfc3626)
