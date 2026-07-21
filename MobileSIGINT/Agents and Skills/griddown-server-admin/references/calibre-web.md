# Calibre-Web Reference

## Overview

Calibre-Web provides web-based access to e-book libraries. Accessible at `/books` through Caddy reverse proxy on port 8083.

## Initial Setup

### Default Credentials

- **Username**: admin
- **Password**: admin123
- **Action**: Change immediately after first login

### Creating Empty Library

If no existing Calibre library exists:

```bash
# Create library structure
mkdir -p data/books/.calnotes

# Initialize empty database
calibredb restore_database --really-do-it --with-library data/books
```

### Database Location Configuration

On first run, set the Calibre database location in Admin → Basic Configuration:
- Path: `/books` (container mount point)
- Do not include `metadata.db` in path

## Docker Compose Configuration

```yaml
calibre-web:
  image: lscr.io/linuxserver/calibre-web:latest
  profiles: ["full"]
  environment:
    - PUID=1000
    - PGID=1000
    - TZ=America/New_York
  volumes:
    - ./data/books:/books
    - ./config/calibre-web:/config
  restart: unless-stopped
```

## Caddy Reverse Proxy

Required header for HTTPS detection behind proxy:

```
reverse_proxy localhost:8083 {
    header_up X-Scheme https
}
```

For GridDown (HTTP only):
```
reverse_proxy localhost:8083
```

## Command Line Options

| Option | Description |
|--------|-------------|
| `-p path` | Settings database location |
| `-i address` | Bind to specific IP |
| `-l` | Allow localhost cover loading |
| `-o path` | Log file location |
| `-s user:pass` | Change user password and exit |
| `-r` | Enable `/reconnect` route |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CALIBRE_DBPATH` | Home directory for settings (app.db, logs) |
| `CALIBRE_PORT` | Default listening port |
| `CALIBRE_RECONNECT` | Enable reconnect endpoint |
| `CALIBRE_LOCALHOST` | Allow localhost cover loading |
| `FLASK_DEBUG` | Enable debug mode |

## Key Features

### Enable in Basic Configuration

- **Uploading**: Allow PDF, EPUB, MOBI, etc. uploads
- **Anonymous browsing**: Guest access without login
- **Public registration**: Self-registration with email
- **Kobo sync**: Sync with Kobo e-readers

### Supported Upload Formats

PDF, EPUB, KEPUB, FB2, TXT, MOBI, AZW, AZW3, HTML, RTF, ODT, DJVU, PRC, DOC, DOCX, MP3, M4A, M4B, CBR, CBZ, CBT

## Log Configuration

- **Location**: Configurable via UI or `-o` flag
- **Levels**: DEBUG, INFO, WARNING, ERROR
- **Rotation**: Auto-rotates at 10KB, keeps 2 backups
- **Stdout/stderr**: Use `/dev/stdout` or `/dev/stderr`

## Troubleshooting

### Database Not Found

```bash
# Verify metadata.db exists
ls -la data/books/metadata.db

# Check container mount
docker compose exec calibre-web ls -la /books
```

### Permission Issues

```bash
# Fix ownership (match PUID/PGID)
sudo chown -R 1000:1000 data/books
sudo chown -R 1000:1000 config/calibre-web
```

### Reset Admin Password

```bash
docker compose exec calibre-web cps -s admin:newpassword
docker compose restart calibre-web
```

### Database Reconnect

If database connection lost, access `/reconnect` endpoint (requires `-r` flag or `CALIBRE_RECONNECT=1`).
