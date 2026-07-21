# Kiwix Server Reference

## Overview

Kiwix serves ZIM file content over HTTP, providing offline access to Wikipedia and other reference content. Accessible at `/library` through Caddy reverse proxy.

## Recommended ZIM Files

| Content | Size | Emergency Value |
|---------|------|-----------------|
| wikipedia_en_all_mini | ~10 GB | Compressed general reference |
| wikipedia_en_all_maxi | ~100 GB | Full Wikipedia with images |
| wikihow_en_all | ~5 GB | Practical how-to guides |
| medlineplus_en_all | ~2 GB | Medical information |
| stackexchange_en | ~50 GB | Technical Q&A |
| gutenberg_en_all | ~60 GB | Public domain books |

## Installing ZIM Files

```bash
# Download to library folder
cd data/library
wget https://download.kiwix.org/zim/wikipedia/wikipedia_en_all_mini_2024-01.zim

# Restart to detect new content
docker compose restart kiwix
```

## Kiwix Server Options

Key command-line options for docker-compose configuration:

```yaml
command:
  - kiwix-serve
  - --port=8080
  - --urlRootLocation=/library
  - --nodatealiases        # -z: Cleaner URLs without dates
  - --threads=4            # -t: Parallel threads
  - /data/*.zim
```

| Option | Description |
|--------|-------------|
| `-p PORT` | TCP port (default: 80) |
| `-r ROOT` | URL prefix (e.g., /library) |
| `-z` | Remove date from URLs (wikipedia_en_all vs wikipedia_en_all_2024-01) |
| `-t N` | Thread count (default: 4) |
| `-m` | Disable library home button |
| `-n` | Disable search bar |
| `-b` | Block external link navigation |

## API Endpoints

All relative to `/library` root:

- `/` - Welcome/library page
- `/catalog/v2/root.xml` - OPDS catalog root
- `/catalog/v2/entries` - Paginated book list (params: `start`, `count`)
- `/search?content=ZIMNAME&pattern=QUERY` - Full-text search
- `/suggest?content=ZIMNAME&term=QUERY` - Autocomplete suggestions

## Pagination Example

```bash
# First 10 entries
curl 'http://localhost/library/catalog/v2/entries'

# Next 10 entries
curl 'http://localhost/library/catalog/v2/entries?start=10'

# All entries (no limit)
curl 'http://localhost/library/catalog/v2/entries?count=-1'
```

## Docker Compose Configuration

```yaml
kiwix:
  image: ghcr.io/kiwix/kiwix-serve:latest
  profiles: ["full"]
  volumes:
    - ./data/library:/data:ro
  command: ["kiwix-serve", "--port=8080", "-z", "/data/*.zim"]
  restart: unless-stopped
```

## Library File Monitoring

Send SIGHUP to reload library without restart:

```bash
docker compose exec kiwix kill -HUP 1
```

Or use `-M` flag for automatic monitoring of library changes.
