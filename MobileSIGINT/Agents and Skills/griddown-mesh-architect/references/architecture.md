# GridDown Integration Architecture

## Overview

This document describes how the mesh network (Track A) integrates with the GridDown server stack (Track B) to provide a complete neighborhood emergency communications system.

## System Architecture

```
                        ┌────────────────────────────────────────────┐
                        │           NEIGHBORHOOD MESH                 │
                        │                                            │
  ┌─────────────┐      │    ┌─────────────┐    ┌─────────────┐     │
  │   Smith     │      │    │   Relay     │    │   Relay     │     │
  │   House     │◄─────┼───►│   Node 1    │◄──►│   Node 2    │     │
  │ (Edge Node) │      │    │             │    │             │     │
  └─────────────┘      │    └──────┬──────┘    └──────┬──────┘     │
                       │           │                   │           │
                       │           └─────────┬─────────┘           │
                       │                     │                     │
  ┌─────────────┐      │              ┌──────┴──────┐              │
  │   Jones     │      │              │   GATEWAY   │              │
  │   House     │◄─────┼─────────────►│    NODE     │              │
  │ (Edge Node) │      │              │             │              │
  └─────────────┘      │              └──────┬──────┘              │
                       │                     │                      │
                       └─────────────────────┼──────────────────────┘
                                             │ Ethernet
                        ┌────────────────────┴────────────────────┐
                        │          GRIDDOWN SERVER                 │
                        │          (Raspberry Pi 5)                │
                        │                                          │
                        │  ┌────────────────────────────────────┐  │
                        │  │         Docker Compose             │  │
                        │  │                                    │  │
                        │  │  ┌──────────┐  ┌──────────────┐   │  │
                        │  │  │  Caddy   │  │  GridDown    │   │  │
                        │  │  │  Proxy   │  │  FastAPI App │   │  │
                        │  │  └────┬─────┘  └──────────────┘   │  │
                        │  │       │                            │  │
                        │  │  ┌────┴─────┐  ┌──────────────┐   │  │
                        │  │  │  Kiwix   │  │ Calibre-Web  │   │  │
                        │  │  │ (Wiki)   │  │  (E-books)   │   │  │
                        │  │  └──────────┘  └──────────────┘   │  │
                        │  │                                    │  │
                        │  │  ┌──────────┐  ┌──────────────┐   │  │
                        │  │  │  ATAK    │  │   File       │   │  │
                        │  │  │  Server  │  │   Sharing    │   │  │
                        │  │  └──────────┘  └──────────────┘   │  │
                        │  └────────────────────────────────────┘  │
                        │                                          │
                        │  eth0: 10.73.0.2                        │
                        └──────────────────────────────────────────┘
```

## Network Layout

### IP Addressing Scheme

```
Network: 10.73.0.0/16

Gateway Zone (10.73.0.0/24):
├── 10.73.0.1    - Gateway node (HaLowLink 1 / router)
├── 10.73.0.2    - Raspberry Pi 5 server
├── 10.73.0.3-10 - Reserved for gateway services
└── 10.73.0.11-254 - Additional gateway equipment

Relay Zone (10.73.1.0/24 - 10.73.99.0/24):
├── 10.73.1.1    - Relay node 1
├── 10.73.2.1    - Relay node 2
└── ...

Edge Zone (10.73.100.0/24 - 10.73.199.0/24):
├── 10.73.100.1  - Smith house edge node
├── 10.73.101.1  - Jones house edge node
└── ...

Client DHCP (10.73.200.0/22):
├── 10.73.200.1 - 10.73.203.254  - Dynamic client addresses
└── Pool: 1022 addresses
```

### DNS Resolution

Local domain: `griddown.local`

```
server.griddown.local     → 10.73.0.2
gateway.griddown.local    → 10.73.0.1
relay-1.griddown.local    → 10.73.1.1
relay-2.griddown.local    → 10.73.2.1
edge-smith.griddown.local → 10.73.100.1
```

## Component Integration

### Gateway Node Configuration

The gateway node bridges the mesh to the server:

```bash
# /etc/config/network on gateway node

config interface 'mesh'
    option proto 'batadv'
    option routing_algo 'BATMAN_IV'
    option gw_mode 'server'

config interface 'lan'
    option type 'bridge'
    option proto 'static'
    option ipaddr '10.73.0.1'
    option netmask '255.255.0.0'
    option gateway '10.73.0.2'  # Server as gateway for internet (if available)
    list device 'eth0'
    list device 'bat0'
```

### Server Network Configuration

On Raspberry Pi 5:

```bash
# /etc/dhcpcd.conf
interface eth0
static ip_address=10.73.0.2/16
static routers=10.73.0.1
static domain_name_servers=10.73.0.2 1.1.1.1

# Or via NetworkManager/netplan as appropriate
```

### DHCP Server

Run on either gateway node or Pi 5. Recommended: Gateway node (dnsmasq)

```bash
# /etc/config/dhcp on gateway node

config dnsmasq
    option domainneeded '1'
    option localise_queries '1'
    option local '/griddown.local/'
    option domain 'griddown.local'
    option authoritative '1'

config dhcp 'lan'
    option interface 'lan'
    option start '200'
    option limit '1022'
    option leasetime '12h'
    list dhcp_option '6,10.73.0.2'  # DNS points to server
    list dhcp_option '3,10.73.0.1'  # Gateway

config host
    option name 'server'
    option ip '10.73.0.2'
    option mac 'XX:XX:XX:XX:XX:XX'  # Pi 5 MAC
```

### mDNS/Avahi Configuration

On server (Pi 5), enable Avahi for `.local` resolution:

```bash
# Install avahi
sudo apt install avahi-daemon

# /etc/avahi/avahi-daemon.conf
[server]
host-name=server
domain-name=local
use-ipv4=yes
use-ipv6=no
allow-interfaces=eth0

[publish]
publish-addresses=yes
publish-hinfo=yes
publish-workstation=no
```

## Service Access

### Caddy Reverse Proxy

Caddy on Pi 5 provides unified access to all services:

```caddyfile
# /etc/caddy/Caddyfile

{
    # Disable automatic HTTPS (we're offline)
    auto_https off
    http_port 80
}

# Main site
griddown.local {
    reverse_proxy localhost:8000
}

# Aliases
server.griddown.local {
    reverse_proxy localhost:8000
}

# Kiwix (Wikipedia)
wiki.griddown.local {
    reverse_proxy localhost:8080
}

# Calibre-Web (E-books)
books.griddown.local {
    reverse_proxy localhost:8083
}

# ATAK Server
atak.griddown.local {
    reverse_proxy localhost:8443
}

# File sharing
files.griddown.local {
    reverse_proxy localhost:8081
}
```

### Client Access

From any device on the mesh:
- Main portal: `http://griddown.local`
- Wikipedia: `http://wiki.griddown.local`
- E-books: `http://books.griddown.local`
- By IP: `http://10.73.0.2`

## Firewall Rules

### Gateway Node

```bash
# /etc/config/firewall

config zone
    option name 'mesh'
    option input 'ACCEPT'
    option output 'ACCEPT'
    option forward 'ACCEPT'
    list network 'mesh'
    list network 'lan'

config forwarding
    option src 'mesh'
    option dest 'mesh'

# Allow access to server services
config rule
    option name 'Allow-HTTP-to-Server'
    option src 'mesh'
    option dest_ip '10.73.0.2'
    option dest_port '80'
    option proto 'tcp'
    option target 'ACCEPT'

config rule
    option name 'Allow-DNS'
    option src 'mesh'
    option dest_port '53'
    option target 'ACCEPT'
```

### Server (Pi 5)

```bash
# Basic UFW rules
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 10.73.0.0/16 to any port 80    # HTTP
sudo ufw allow from 10.73.0.0/16 to any port 443   # HTTPS
sudo ufw allow from 10.73.0.0/16 to any port 22    # SSH
sudo ufw allow from 10.73.0.0/16 to any port 53    # DNS
sudo ufw enable
```

## Captive Portal (Future)

For new devices joining the mesh, a captive portal can provide:
- Welcome/orientation page
- Terms of use acceptance
- Network information
- Emergency contacts

Implementation options:
- nodogsplash on gateway
- Custom solution in GridDown app

## Monitoring

### Mesh Health Checks

Script to run on gateway/server:

```bash
#!/bin/bash
# /usr/local/bin/mesh-health-check.sh

echo "=== GridDown Mesh Status ==="
echo ""

# Check gateway mesh
echo "--- Mesh Neighbors (batman-adv) ---"
ssh root@10.73.0.1 'batctl n'
echo ""

echo "--- Mesh Originators ---"
ssh root@10.73.0.1 'batctl o'
echo ""

echo "--- Server Services ---"
docker ps --format "table {{.Names}}\t{{.Status}}"
echo ""

echo "--- Network Clients ---"
cat /var/lib/misc/dnsmasq.leases 2>/dev/null || echo "No leases found"
```

### Service Health

```bash
# Check all services are responding
curl -s -o /dev/null -w "%{http_code}" http://griddown.local/health
curl -s -o /dev/null -w "%{http_code}" http://wiki.griddown.local/
```

## Backup & Recovery

### Configuration Backup

On each node:
```bash
# Backup OpenWRT config
sysupgrade -b /tmp/backup-$(hostname)-$(date +%Y%m%d).tar.gz
```

On server:
```bash
# Backup Docker volumes
docker run --rm -v griddown_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/griddown-data-$(date +%Y%m%d).tar.gz /data
```

### Recovery Procedure

1. Flash fresh OpenWRT to failed node
2. Restore configuration from backup
3. Verify mesh connectivity
4. Confirm service access

## Deployment Checklist

### Pre-Deployment

- [ ] All hardware tested individually
- [ ] Firmware flashed and updated
- [ ] Mesh configurations prepared
- [ ] IP addresses documented
- [ ] Encryption keys generated and distributed
- [ ] Server services verified working

### Gateway Node

- [ ] Ethernet connected to server
- [ ] Mesh radio configured
- [ ] DHCP server running
- [ ] DNS forwarding configured
- [ ] Firewall rules applied
- [ ] batctl shows server as neighbor

### Relay Nodes

- [ ] Mesh interface configured
- [ ] Gateway visible in mesh
- [ ] Can ping server (10.73.0.2)
- [ ] HTTP access to services works

### Edge Nodes

- [ ] Mesh interface configured
- [ ] Client AP configured
- [ ] DHCP clients can connect
- [ ] Services accessible from clients

### Final Verification

- [ ] Client device can connect to any edge node AP
- [ ] Client receives IP via DHCP
- [ ] http://griddown.local loads
- [ ] All services accessible
- [ ] Mesh self-heals when node removed

## Troubleshooting Integration

### Clients Can't Reach Server

1. Check mesh connectivity: `batctl o` on gateway
2. Verify bridge includes bat0: `brctl show`
3. Check routing: `ip route` on gateway
4. Test from gateway: `ping 10.73.0.2`

### DNS Not Resolving

1. Check dnsmasq running: `ps | grep dnsmasq`
2. Verify DNS option in DHCP: `uci show dhcp`
3. Test resolution: `nslookup griddown.local 10.73.0.2`

### Services Not Loading

1. Check Docker: `docker ps` on server
2. Check Caddy: `sudo systemctl status caddy`
3. Test directly: `curl http://localhost:8000`
4. Check firewall: `sudo ufw status`
