---
name: griddown-server-admin
description: Specialized systems administration for GridDown emergency intranet servers running on Raspberry Pi 5. Use when configuring, deploying, maintaining, troubleshooting, or optimizing the Pi-based server stack providing offline-first emergency communication services. Triggers on requests involving Docker Compose service management, Caddy reverse proxy configuration, SQLite WAL mode databases, Kiwix offline content serving, Calibre-Web e-book libraries, FileBrowser file sharing, or Raspberry Pi headless server administration in emergency/mesh network contexts.
---

# GridDown Server Administrator

Systems administration skill for deploying and maintaining GridDown emergency intranet servers on Raspberry Pi 5 hardware, providing offline-first communication services over mesh networks.

## Hardware Platform

- **Raspberry Pi 5**: BCM2712, Cortex-A76 @ 2.4GHz, 4GB/8GB RAM
- **Storage**: NVMe via HAT (recommended), USB SSD, or SD card (dev only)
- **Power**: Official 27W USB-C PSU, UPS integration recommended
- **Thermal**: Active cooling required for sustained operation
- **Network**: Gigabit Ethernet to mesh gateway (HaLowLink 1)

## Software Stack

- **OS**: Raspberry Pi OS Lite (64-bit) headless
- **Runtime**: Docker Engine + Docker Compose v2
- **Reverse Proxy**: Caddy 2 (Alpine) - local network, no HTTPS
- **Core App**: FastAPI (Python 3.12) + Uvicorn
- **Database**: SQLite with WAL mode
- **Optional Services**: Kiwix, Calibre-Web, FileBrowser

## Service Architecture

```
Client → Caddy (:80)
├── /              → Core FastAPI (:8000) - Homepage
├── /health        → Core FastAPI (:8000) - Health check
├── /status        → Core FastAPI (:8000) - System status
├── /board/*       → Core FastAPI (:8000) - Bulletin board
├── /static/*      → Core FastAPI (:8000) - Static assets
├── /library/*     → Kiwix (:8080) - Offline Wikipedia
├── /books/*       → Calibre-Web (:8083) - E-books
└── /files/*       → FileBrowser (:8084) - File sharing
```

## Directory Structure

```
griddown/
├── data/
│   ├── bulletin/          # SQLite DB + media uploads
│   │   ├── bulletin.db    # Main database (WAL mode)
│   │   ├── media/         # Uploaded images/videos
│   │   └── backups/       # Auto-pruned DB backups
│   ├── library/           # Kiwix ZIM files
│   ├── books/             # Calibre library
│   └── files/             # FileBrowser shared files
├── backups/               # Full system backups
└── .env                   # Environment configuration
```

## Environment Configuration (.env)

```bash
# Server Identity
SERVER_IP=10.73.0.2              # Static mesh IP
HOSTNAME=griddown.local          # mDNS hostname

# Bulletin Board
BULLETIN_ADMIN_PASSWORD=<secure> # Admin password
MAX_IMAGE_SIZE_MB=5
MAX_VIDEO_SIZE_MB=50
MAX_VIDEO_DURATION_SEC=30

# System
LOG_LEVEL=INFO                   # DEBUG|INFO|WARNING|ERROR
TZ=America/New_York
```

## Essential Commands

### Service Management

```bash
# Start services
docker compose up -d                    # Minimal (core + caddy)
docker compose --profile full up -d     # Full stack

# Monitor
docker compose ps                       # Service status
docker compose logs -f [service]        # Live logs
docker stats                            # Resource usage

# Maintenance
docker compose restart <service>        # Restart service
docker compose down                     # Stop all
docker compose build --no-cache core    # Rebuild after changes
```

### Health Verification

```bash
# Endpoints
curl http://localhost/health            # {"status": "healthy"}
curl http://localhost/status            # System status JSON

# Pi Health
vcgencmd measure_temp                   # CPU temp (< 80°C OK)
vcgencmd get_throttled                  # 0x0 = no throttling
free -h                                 # Memory usage
df -h                                   # Disk usage
```

### Database Operations

SQLite WAL mode provides crash resilience:

```bash
# Backup
sqlite3 data/bulletin/bulletin.db ".backup backups/bulletin_$(date +%Y%m%d).db"

# Integrity check
sqlite3 data/bulletin/bulletin.db "PRAGMA integrity_check;"  # Returns: ok
sqlite3 data/bulletin/bulletin.db "PRAGMA journal_mode;"     # Returns: wal

# Force checkpoint
sqlite3 data/bulletin/bulletin.db "PRAGMA wal_checkpoint(TRUNCATE);"

# Recovery from corruption
sqlite3 data/bulletin/bulletin.db ".dump" > dump.sql
mv data/bulletin/bulletin.db data/bulletin/bulletin.db.corrupt
sqlite3 data/bulletin/bulletin.db < dump.sql
```

### Pi Configuration (raspi-config)

```bash
sudo raspi-config nonint do_hostname griddown        # Set hostname
sudo raspi-config nonint do_ssh 0                    # Enable SSH
sudo raspi-config nonint do_change_timezone America/New_York
sudo raspi-config nonint do_expand_rootfs            # Expand filesystem
sudo raspi-config nonint do_boot_behaviour B1        # Console boot
```

## Detailed References

- **Kiwix setup and ZIM management**: See [references/kiwix.md](references/kiwix.md)
- **Calibre-Web configuration**: See [references/calibre-web.md](references/calibre-web.md)
- **Troubleshooting guide**: See [references/troubleshooting.md](references/troubleshooting.md)
- **Security hardening**: See [references/security.md](references/security.md)

## Quick Troubleshooting

| Symptom | Check | Fix |
|---------|-------|-----|
| Service won't start | `docker compose logs <svc>` | Check port conflicts: `lsof -i :<port>` |
| Database locked | `fuser data/bulletin/bulletin.db` | Kill zombie process, checkpoint WAL |
| High temp (>80°C) | `vcgencmd measure_temp` | Add active cooling, reduce load |
| Disk full | `df -h && du -sh data/*` | `docker system prune -a`, rotate logs |
| Can't access network | `docker compose ps && ip addr` | Check firewall: `sudo ufw status` |

## Safety Constraints

1. **Always backup before changes** - Especially database and .env
2. **Test locally first** - Before exposing to network
3. **Don't disable security** - Firewall, SSH keys, admin password
4. **Monitor resources** - Disk, memory, temperature
5. **Document changes** - Keep notes on customizations
