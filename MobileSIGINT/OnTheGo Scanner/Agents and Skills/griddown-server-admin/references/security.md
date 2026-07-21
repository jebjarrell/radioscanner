# Security Hardening Reference

## SSH Security

### Disable Password Authentication

```bash
# Edit SSH config
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config

# Restart SSH
sudo systemctl restart sshd
```

**Important**: Copy SSH public key BEFORE disabling password auth:

```bash
# From client machine
ssh-copy-id pi@<server-ip>
```

### SSH Key Generation

```bash
# Generate ed25519 key (recommended)
ssh-keygen -t ed25519 -C "griddown-admin"

# Or RSA 4096 for compatibility
ssh-keygen -t rsa -b 4096 -C "griddown-admin"
```

### Restrict SSH Access

```bash
# Allow specific users only
echo "AllowUsers pi admin" | sudo tee -a /etc/ssh/sshd_config

# Change default port (optional)
sudo sed -i 's/#Port 22/Port 2222/' /etc/ssh/sshd_config

sudo systemctl restart sshd
```

## Firewall Configuration (ufw)

### Basic Setup

```bash
# Set defaults
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow essential services
sudo ufw allow ssh          # Port 22
sudo ufw allow 80/tcp       # HTTP for GridDown

# Enable firewall
sudo ufw enable

# Verify
sudo ufw status verbose
```

### Custom SSH Port

```bash
sudo ufw delete allow ssh
sudo ufw allow 2222/tcp comment 'SSH custom port'
```

### Rate Limiting

```bash
# Limit SSH connections (6 per 30 seconds)
sudo ufw limit ssh

# Or for custom port
sudo ufw limit 2222/tcp
```

## Admin Password

### Configuration

Set strong password in `.env`:

```bash
BULLETIN_ADMIN_PASSWORD=<minimum-16-characters>
```

### Usage

Required for privileged API operations:

```bash
# Delete post via API
curl -X DELETE http://localhost/board/posts/123 \
  -H "X-Admin-Password: <password>"
```

### Password Requirements

- Minimum 16 characters
- Mix of uppercase, lowercase, numbers, symbols
- Not based on dictionary words
- Unique to this deployment

## Service Hardening

### Docker Security

```bash
# Run containers as non-root
# In docker-compose.yml:
services:
  core:
    user: "1000:1000"

# Read-only root filesystem (where possible)
services:
  kiwix:
    read_only: true
    tmpfs:
      - /tmp
```

### Resource Limits

Prevent container resource exhaustion:

```yaml
services:
  core:
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: '1.0'
        reservations:
          memory: 128M
```

## Pi-Specific Hardening

### Disable Unnecessary Services

```bash
sudo systemctl disable bluetooth
sudo systemctl disable avahi-daemon    # Unless using mDNS
sudo systemctl disable triggerhappy
sudo systemctl disable hciuart
```

### GPU Memory (Headless)

In `/boot/firmware/config.txt`:

```
gpu_mem=16
```

### Automatic Updates

```bash
# Install unattended-upgrades
sudo apt install unattended-upgrades

# Enable security updates only
sudo dpkg-reconfigure -plow unattended-upgrades
```

## Backup Security

### Encrypt Backups

```bash
# Create encrypted backup
tar czf - data/ .env | gpg -c -o backups/griddown-$(date +%Y%m%d).tar.gz.gpg

# Restore encrypted backup
gpg -d backups/griddown-YYYYMMDD.tar.gz.gpg | tar xzf -
```

### Secure Backup Storage

- Store backups on separate physical media
- Keep at least one offsite copy
- Test restore procedures regularly

## Network Security

### Bind to Specific Interface

In docker-compose.yml, bind to mesh network interface only:

```yaml
services:
  caddy:
    ports:
      - "10.73.0.2:80:80"   # Mesh network only
```

### Disable IPv6 (if not used)

```bash
# In /etc/sysctl.conf
net.ipv6.conf.all.disable_ipv6 = 1
net.ipv6.conf.default.disable_ipv6 = 1

# Apply
sudo sysctl -p
```

## Audit Logging

### Enable System Auditing

```bash
sudo apt install auditd

# Log all sudo commands
sudo auditctl -a exit,always -F arch=b64 -S execve -F euid=0

# Log SSH access
sudo auditctl -w /var/log/auth.log -p wa -k auth_log
```

### Docker Logging

Ensure logs capture security events:

```yaml
services:
  core:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"
        labels: "service"
```

## Checklist

- [ ] SSH key-only authentication enabled
- [ ] Firewall enabled with minimal rules
- [ ] Strong admin password configured
- [ ] Unnecessary services disabled
- [ ] GPU memory minimized
- [ ] Resource limits configured
- [ ] Backups encrypted
- [ ] Audit logging enabled
- [ ] Automatic security updates enabled
