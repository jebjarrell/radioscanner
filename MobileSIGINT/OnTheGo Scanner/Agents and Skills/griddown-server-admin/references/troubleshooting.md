# Troubleshooting Guide

## Service Won't Start

### Diagnosis

```bash
# Check logs for specific service
docker compose logs core
docker compose logs kiwix
docker compose logs calibre-web

# Check all service status
docker compose ps
```

### Common Causes & Fixes

**Port Already in Use**
```bash
lsof -i :8000           # Find process using port
kill -9 <PID>           # Kill blocking process
docker compose up -d    # Restart
```

**Permission Denied on Volumes**
```bash
# Check ownership
ls -la data/

# Fix ownership (match container user)
sudo chown -R 1000:1000 data/
sudo chown -R 1000:1000 config/
```

**Container Crashed**
```bash
# View exit code and recent logs
docker compose ps -a
docker compose logs --tail=50 <service>

# Force recreate
docker compose up -d --force-recreate <service>
```

## Database Issues

### Check Integrity

```bash
sqlite3 data/bulletin/bulletin.db "PRAGMA integrity_check;"
# Expected: ok
```

### Database Locked

```bash
# Find locking processes
fuser data/bulletin/bulletin.db

# Force WAL checkpoint
sqlite3 data/bulletin/bulletin.db "PRAGMA wal_checkpoint(TRUNCATE);"
```

### Verify WAL Mode

```bash
sqlite3 data/bulletin/bulletin.db "PRAGMA journal_mode;"
# Expected: wal
```

### Recovery from Corruption

```bash
# Export all data
sqlite3 data/bulletin/bulletin.db ".dump" > dump.sql

# Preserve corrupt file
mv data/bulletin/bulletin.db data/bulletin/bulletin.db.corrupt

# Rebuild database
sqlite3 data/bulletin/bulletin.db < dump.sql

# Re-enable WAL mode
sqlite3 data/bulletin/bulletin.db "PRAGMA journal_mode=WAL;"
```

## High Temperature / Throttling

### Check Status

```bash
# Temperature (should be < 80°C)
vcgencmd measure_temp

# Throttling flags (0x0 = OK)
vcgencmd get_throttled
```

### Throttle Flag Interpretation

| Bit | Hex | Meaning |
|-----|-----|---------|
| 0 | 0x1 | Under-voltage detected |
| 1 | 0x2 | Arm frequency capped |
| 2 | 0x4 | Currently throttled |
| 3 | 0x8 | Soft temperature limit active |
| 16 | 0x10000 | Under-voltage occurred |
| 17 | 0x20000 | Arm frequency capped occurred |
| 18 | 0x40000 | Throttling occurred |
| 19 | 0x80000 | Soft temp limit occurred |

### Solutions

1. **Add active cooling** - Official Active Cooler recommended
2. **Improve ventilation** - Ensure case airflow
3. **Reduce CPU load** - Stop non-essential services
4. **Check PSU** - Use official 27W USB-C PSU

## Disk Full

### Diagnosis

```bash
# Check usage
df -h

# Find large directories
du -sh data/*
du -sh /var/lib/docker/*
```

### Cleanup Actions

```bash
# Clean Docker (removes unused images, containers, volumes)
docker system prune -a

# Rotate container logs
truncate -s 0 /var/lib/docker/containers/*/*-json.log

# Save and clear compose logs
docker compose logs --no-color > /tmp/griddown-logs.txt
```

### Prevent Future Issues

Add log rotation to docker-compose.yml:

```yaml
services:
  core:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## Network Access Issues

### Local Verification First

```bash
# Test locally
curl http://localhost/health
curl http://localhost/status
```

### Network Checks

```bash
# Check service binding
docker compose ps

# Verify IP address
ip addr show eth0

# Check firewall
sudo ufw status

# Test from another host
ping <server-ip>
curl http://<server-ip>/health
```

### Firewall Rules

```bash
# Required ports
sudo ufw allow ssh
sudo ufw allow 80/tcp

# Verify rules
sudo ufw status numbered
```

## Container Resource Issues

### Monitor Usage

```bash
# Real-time stats
docker stats

# Specific container
docker stats griddown-core-1
```

### Apply Resource Limits

Add to docker-compose.yml:

```yaml
services:
  core:
    deploy:
      resources:
        limits:
          memory: 256M
        reservations:
          memory: 128M
```

## Kiwix-Specific Issues

### ZIM Files Not Loading

```bash
# Check files exist
ls -la data/library/*.zim

# Verify permissions
docker compose exec kiwix ls -la /data/

# Force reload
docker compose restart kiwix
```

### Search Not Working

ZIM file may lack full-text search index. Check if file supports search:

```bash
# View ZIM metadata
docker compose exec kiwix kiwix-manage /data/<file>.zim show
```

## Calibre-Web Issues

### Can't Find Database

1. Verify path in Admin → Basic Configuration
2. Path should be `/books` (container path), not host path
3. Check `metadata.db` exists: `ls data/books/metadata.db`

### OPDS Feed Issues

Enable OPDS in Admin → Basic Configuration → Feature Configuration.

### Book Conversion Fails

Install Calibre binaries:
```bash
# In container or host
apt-get install calibre
```

Configure path in Admin → Basic Configuration → External binaries.
