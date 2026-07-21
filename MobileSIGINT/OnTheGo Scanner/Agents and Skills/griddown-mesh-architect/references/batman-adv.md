# B.A.T.M.A.N. Advanced (batman-adv) Reference

## Overview

BATMAN-adv (Better Approach To Mobile Adhoc Networking - Advanced) is a Layer 2 mesh networking protocol implemented as a Linux kernel module. It creates a virtual network switch over the mesh, making the entire mesh network appear as a single broadcast domain.

## Key Characteristics

- **Layer**: 2 (Data Link Layer)
- **Approach**: Decentralized, no master node
- **Routing Metric**: Transmission Quality (TQ) based on packet loss
- **Topology**: Automatically discovers and adapts
- **Bridging**: Native support for bridging ethernet/wifi

## How It Works

1. Each node broadcasts Originator Messages (OGMs) periodically
2. Nodes track received OGMs to build a view of the network
3. Best next-hop is determined by OGM reception quality
4. Data is encapsulated in batman-adv headers and forwarded
5. The mesh appears as a virtual switch (bat0 interface)

## OpenWRT Installation

```bash
# Update package lists
opkg update

# Install batman-adv kernel module and control tool
opkg install kmod-batman-adv batctl

# Optional: LuCI interface (note: may be outdated)
opkg install luci-proto-batman-adv
```

## Configuration

### /etc/config/network

```bash
# Create the batman mesh interface
config interface 'bat0'
    option proto 'batadv'
    option routing_algo 'BATMAN_IV'
    option aggregated_ogms '1'
    option ap_isolation '0'
    option bonding '0'
    option bridge_loop_avoidance '1'
    option distributed_arp_table '1'
    option fragmentation '1'
    option gw_mode 'off'          # 'off', 'client', or 'server'
    option gw_bandwidth '10000/2000'
    option gw_sel_class '20'
    option hop_penalty '30'
    option isolation_mark '0x00000000/0x00000000'
    option log_level '0'
    option multicast_mode '1'
    option multicast_fanout '16'
    option network_coding '0'
    option orig_interval '1000'

# Add mesh interface to batman
config interface 'mesh0'
    option proto 'batadv_hardif'
    option master 'bat0'
    option mtu '1560'

# Bridge batman with LAN
config interface 'lan'
    option type 'bridge'
    option proto 'static'
    option ipaddr '10.73.0.1'
    option netmask '255.255.0.0'
    list device 'eth0'
    list device 'bat0'
```

### /etc/config/wireless

```bash
# Mesh backhaul interface (802.11s)
config wifi-iface 'mesh_radio0'
    option device 'radio0'
    option network 'mesh0'
    option mode 'mesh'
    option mesh_id 'griddown-mesh'
    option mesh_fwding '0'         # IMPORTANT: batman-adv handles forwarding
    option encryption 'sae'        # WPA3
    option key 'your-mesh-key-here'

# Client access point (optional, same radio or different)
config wifi-iface 'client_radio0'
    option device 'radio0'
    option network 'lan'
    option mode 'ap'
    option ssid 'GridDown-Neighborhood'
    option encryption 'sae-mixed'
    option key 'your-client-key'
```

## Gateway Configuration

For the main gateway node that provides internet/services:

```bash
# In /etc/config/network, set bat0 gateway mode
uci set network.bat0.gw_mode='server'
uci set network.bat0.gw_bandwidth='100000/100000'  # 100Mbps down/up
uci commit network
```

For client nodes:

```bash
uci set network.bat0.gw_mode='client'
uci set network.bat0.gw_sel_class='20'  # TQ-based selection
uci commit network
```

## batctl Commands

### Network Status

```bash
# Show originator table (all mesh nodes)
batctl o
# Example output:
# [B.A.T.M.A.N. adv 2024.0, MainIF/MAC: mesh0/aa:bb:cc:dd:ee:ff]
#   Originator        last-seen (#/255) Nexthop           [outgoingIF]
#   aa:bb:cc:11:22:33    0.820s   (255) aa:bb:cc:11:22:33 [      mesh0]
#   aa:bb:cc:44:55:66    0.340s   (214) aa:bb:cc:11:22:33 [      mesh0]

# Show direct neighbors
batctl n
# Example output:
#   IF             Neighbor              last-seen
#   mesh0          aa:bb:cc:11:22:33    0.180s

# Show gateway table
batctl gwl

# Show interfaces
batctl if

# Show translation table (MAC addresses seen)
batctl tl

# Show global translation table
batctl tg

# Ping a mesh node by MAC address
batctl ping aa:bb:cc:11:22:33

# Traceroute through mesh
batctl traceroute aa:bb:cc:11:22:33

# Show statistics
batctl s
```

### Configuration

```bash
# Show current settings
batctl gw_mode
batctl orig_interval
batctl hop_penalty

# Runtime changes (not persistent)
batctl gw_mode server
batctl orig_interval 1000
```

## Troubleshooting

### No Neighbors Visible

1. Check interface is added to batman:
   ```bash
   batctl if
   ```

2. Verify mesh interface is up:
   ```bash
   ip link show mesh0
   iwinfo mesh0 info
   ```

3. Check mesh_fwding is disabled:
   ```bash
   iw dev mesh0 get mesh_param mesh_fwding
   # Should return 0
   ```

4. Verify encryption matches on all nodes

### Poor TQ Values

1. Check signal strength:
   ```bash
   iwinfo mesh0 assoclist
   ```

2. Consider channel interference
3. Adjust antenna positioning
4. Check for obstacles

### Bridge Loop Issues

Enable bridge loop avoidance:
```bash
uci set network.bat0.bridge_loop_avoidance='1'
uci commit network
/etc/init.d/network restart
```

### Gateway Not Working

1. Verify gateway mode on server:
   ```bash
   batctl gw_mode
   ```

2. Check clients see gateway:
   ```bash
   batctl gwl
   ```

3. Verify routing table on clients

## Performance Tuning

### For Stable Networks

```bash
# Reduce overhead with longer intervals
uci set network.bat0.orig_interval='5000'  # 5 seconds

# Lower hop penalty for more direct routes
uci set network.bat0.hop_penalty='15'
```

### For Mobile/Dynamic Networks

```bash
# Faster convergence
uci set network.bat0.orig_interval='500'  # 0.5 seconds

# Higher hop penalty to prefer shorter paths
uci set network.bat0.hop_penalty='50'
```

### For Large Networks

```bash
# Enable OGM aggregation
uci set network.bat0.aggregated_ogms='1'

# Enable network coding (experimental)
uci set network.bat0.network_coding='1'
```

## VLAN Support

batman-adv supports VLANs for network segmentation:

```bash
# Create VLAN on bat0
ip link add link bat0 name bat0.10 type vlan id 10

# Or via UCI
config device
    option type 'vlan'
    option name 'bat0.10'
    option ifname 'bat0'
    option vid '10'
```

## Best Practices for GridDown

1. **Use 802.11s mesh mode** - Not ad-hoc mode
2. **Disable mesh_fwding** - Let batman-adv handle routing
3. **Enable bridge_loop_avoidance** - Prevents broadcast storms
4. **Set appropriate gw_mode** - Server on main node, client on others
5. **Use WPA3 (SAE)** - For mesh security
6. **Document MAC addresses** - For troubleshooting
7. **Monitor with batctl** - Regular health checks

## References

- [batman-adv Documentation](https://www.open-mesh.org/doc/batman-adv/)
- [OpenWRT batman-adv Config](https://www.open-mesh.org/doc/batman-adv/Batman-adv-openwrt-config.html)
- [batman-adv Wiki](https://www.open-mesh.org/projects/batman-adv/wiki)
