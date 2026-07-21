---
name: griddown-sqlite
description: SQLite database operations for GridDown emergency preparedness intranet servers. Use when working with the bulletin board database, implementing CRUD operations, managing WAL-mode crash resilience, performing database backups and integrity checks, writing parameterized queries, or troubleshooting SQLite issues in the GridDown context. Triggers on requests involving bulletin.db, posts table operations, database migrations, or Python sqlite3 patterns for offline-first emergency systems.
---

# GridDown SQLite Database Operations

SQLite database skill for the GridDown emergency preparedness intranet, optimized for offline resilience and crash recovery on resource-constrained hardware.

## Why SQLite for GridDown

SQLite's architecture makes it ideal for emergency communications:

- **Zero-configuration**: No server process, no setup, no administration
- **Serverless**: Reads/writes directly to disk files—no network dependency
- **Single file**: Entire database in one portable file (easy backup/restore)
- **Crash resilient**: WAL mode survives power failures without corruption
- **Cross-platform**: Same database file works on any architecture

## Database Location

```
{DATA_PATH}/bulletin/
├── bulletin.db          # Main database
├── bulletin.db-shm      # WAL shared memory (temp)
├── bulletin.db-wal      # Write-ahead log (temp)
└── backups/             # Auto-pruned (max 10)
```

Default `DATA_PATH`: `./data` (via environment variable)

## Schema

### posts Table

```sql
CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    media_url TEXT,
    media_type TEXT,
    priority TEXT DEFAULT 'normal',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_id_desc ON posts(id DESC);
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | INTEGER | Auto | Primary key, auto-increment |
| author | TEXT | Yes | HTML-escaped |
| title | TEXT | Yes | HTML-escaped |
| body | TEXT | No | HTML-escaped |
| media_url | TEXT | No | Relative path to media |
| media_type | TEXT | No | "image" or "video" |
| priority | TEXT | No | "normal", "important", "urgent" |
| created_at | TEXT | Yes | ISO 8601: `YYYY-MM-DDTHH:MM:SSZ` |

**Note on manifest typing**: SQLite uses dynamic typing—values can be stored in any column regardless of declared type. However, `INTEGER PRIMARY KEY` columns only accept integers.

## Connection Configuration

### Required PRAGMAs for Crash Resilience

```python
import sqlite3

def _get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row      # Dict-like access: row["column"]
    conn.execute("PRAGMA journal_mode=WAL")      # Write-Ahead Logging
    conn.execute("PRAGMA synchronous=FULL")      # Maximum durability
    return conn
```

**WAL mode explained**: Instead of overwriting original data, changes write to a separate WAL file. Readers see consistent snapshots while writers append. Survives crashes because original data remains intact until checkpoint.

**synchronous=FULL**: Ensures data reaches physical disk before reporting success. Slower but guarantees durability—critical for emergency systems.

### Connection Patterns

Always use context managers to ensure proper cleanup:

```python
# Pattern 1: Direct connection (always commits/closes)
with sqlite3.connect(db_path) as conn:
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    cursor = conn.execute("SELECT * FROM posts WHERE id = ?", (post_id,))
    row = cursor.fetchone()
    # Auto-commits on exit (if no exception)

# Pattern 2: Explicit transaction control
with _get_connection() as conn:
    try:
        conn.execute("INSERT INTO posts (...) VALUES (...)", params)
        conn.execute("UPDATE posts SET priority = ? WHERE id = ?", ("urgent", 1))
        conn.commit()  # Explicit commit for multi-statement transactions
    except sqlite3.Error:
        conn.rollback()
        raise
```

## Row Factories

The `sqlite3.Row` factory provides flexible column access:

```python
conn.row_factory = sqlite3.Row
cursor = conn.execute("SELECT author, title, created_at FROM posts")
row = cursor.fetchone()

# Multiple access patterns
row[0]              # Index: 'John Doe'
row["author"]       # Name: 'John Doe'  
row["AUTHOR"]       # Case-insensitive: 'John Doe'
row.keys()          # ['author', 'title', 'created_at']
dict(row)           # Convert to dict
```

For dataclass conversion:

```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class Post:
    id: int
    author: str
    title: str
    body: Optional[str]
    media_url: Optional[str]
    media_type: Optional[str]
    priority: str
    created_at: str

def row_to_post(row: sqlite3.Row) -> Post:
    return Post(**dict(row))
```

## CRUD Operations

### Create

```python
def create_post(author: str, title: str, body: str = None, 
                priority: str = "normal") -> Post:
    from html import escape
    from datetime import datetime, timezone
    
    author = escape(author.strip())
    title = escape(title.strip())
    body = escape(body.strip()) if body else None
    created_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    
    with _get_connection() as conn:
        cursor = conn.execute("""
            INSERT INTO posts (author, title, body, priority, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (author, title, body, priority, created_at))
        conn.commit()
        post_id = cursor.lastrowid
        
    return get_post_by_id(post_id)
```

### Read

```python
def get_posts(limit: int = 50, offset: int = 0) -> list[Post]:
    with _get_connection() as conn:
        cursor = conn.execute("""
            SELECT * FROM posts 
            ORDER BY created_at DESC, id DESC
            LIMIT ? OFFSET ?
        """, (limit, offset))
        return [row_to_post(row) for row in cursor.fetchall()]

def get_post_by_id(post_id: int) -> Optional[Post]:
    with _get_connection() as conn:
        cursor = conn.execute(
            "SELECT * FROM posts WHERE id = ?", (post_id,)
        )
        row = cursor.fetchone()
        return row_to_post(row) if row else None
```

### Delete

```python
def delete_post(post_id: int) -> None:
    # Caller must delete associated media files first
    with _get_connection() as conn:
        conn.execute("DELETE FROM posts WHERE id = ?", (post_id,))
        conn.commit()
```

### Count

```python
def count_posts() -> int:
    with _get_connection() as conn:
        cursor = conn.execute("SELECT COUNT(*) FROM posts")
        return cursor.fetchone()[0]
```

## SQL Injection Prevention

**Always use parameterized queries with `?` placeholders:**

```python
# CORRECT - Parameters bound safely
conn.execute("SELECT * FROM posts WHERE author = ?", (author,))
conn.execute("SELECT * FROM posts WHERE id IN (?, ?, ?)", (1, 2, 3))

# CORRECT - executemany for batch inserts
data = [("Alice", "Post 1"), ("Bob", "Post 2")]
conn.executemany("INSERT INTO posts (author, title) VALUES (?, ?)", data)

# WRONG - SQL injection vulnerability
conn.execute(f"SELECT * FROM posts WHERE author = '{author}'")  # NEVER
conn.execute("SELECT * FROM posts WHERE author = '%s'" % author)  # NEVER
```

## Database Maintenance

### Backup (Online Safe)

```python
def backup_database(backup_dir: Path = None) -> Path:
    """Hot backup using SQLite's backup API - safe during active operations."""
    from datetime import datetime
    
    backup_dir = backup_dir or Path(DATA_PATH) / "bulletin" / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = backup_dir / f"bulletin_{timestamp}.db"
    
    with _get_connection() as src:
        with sqlite3.connect(backup_path) as dst:
            src.backup(dst)  # Atomic, consistent backup
    
    # Prune to keep only 10 most recent
    backups = sorted(backup_dir.glob("bulletin_*.db"), reverse=True)
    for old_backup in backups[10:]:
        old_backup.unlink()
    
    return backup_path
```

### Integrity Check

```python
def check_database_integrity() -> dict:
    with _get_connection() as conn:
        integrity = conn.execute("PRAGMA integrity_check").fetchone()[0]
        journal = conn.execute("PRAGMA journal_mode").fetchone()[0]
        count = conn.execute("SELECT COUNT(*) FROM posts").fetchone()[0]
        
    return {
        "healthy": integrity == "ok" and journal == "wal",
        "wal_mode": journal == "wal",
        "integrity": integrity,
        "post_count": count
    }
```

### Migration Support

Add columns without breaking existing databases:

```python
def _migrate_db(conn: sqlite3.Connection) -> None:
    cursor = conn.execute("PRAGMA table_info(posts)")
    columns = {row[1] for row in cursor.fetchall()}
    
    if 'priority' not in columns:
        conn.execute("ALTER TABLE posts ADD COLUMN priority TEXT DEFAULT 'normal'")
        conn.commit()
```

## CLI Commands

```bash
# Health check
sqlite3 data/bulletin/bulletin.db "PRAGMA integrity_check"    # → ok
sqlite3 data/bulletin/bulletin.db "PRAGMA journal_mode"       # → wal

# Force WAL checkpoint (merge WAL into main db)
sqlite3 data/bulletin/bulletin.db "PRAGMA wal_checkpoint(TRUNCATE)"

# View schema
sqlite3 data/bulletin/bulletin.db ".schema"

# Backup
sqlite3 data/bulletin/bulletin.db ".backup backups/bulletin_backup.db"

# Export/import for recovery
sqlite3 data/bulletin/bulletin.db ".dump" > dump.sql
sqlite3 new_bulletin.db < dump.sql
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "database is locked" | Long-running transaction | Check for zombie processes: `fuser bulletin.db` |
| WAL file grows large | No checkpoints | `PRAGMA wal_checkpoint(TRUNCATE)` |
| Corruption after crash | Not in WAL mode | Restore from backup, enable WAL |
| Slow reads | Missing indexes | Add indexes on query columns |
| "unable to open database" | Permissions | `chmod 664 bulletin.db*` |

## Testing

```python
@pytest.fixture
def clean_db(tmp_path):
    import os
    test_data = tmp_path / "data" / "bulletin"
    test_data.mkdir(parents=True, exist_ok=True)
    os.environ["DATA_PATH"] = str(tmp_path / "data")
    
    from models.bulletin import reset_database
    reset_database()  # Drops and recreates tables
    
    yield test_data
```

## Detailed References

- **Advanced topics**: See [references/advanced.md](references/advanced.md) for transaction control, WAL deep dive, performance optimization, type handling, concurrency, and recovery procedures

## Key Files

| File | Purpose |
|------|---------|
| `griddown/models/bulletin.py` | All SQLite operations |
| `griddown/config.py` | Path configuration |
| `griddown/routers/bulletin.py` | API endpoints |
| `griddown/conftest.py` | Test fixtures |

## Design Principles

1. **Crash resilience**: WAL + FULL synchronous for power-failure survival
2. **Simplicity**: Single table, no complex joins—emergency systems stay simple
3. **Offline-first**: No external dependencies, works without network
4. **Self-healing**: Auto-migration handles schema updates gracefully
5. **Portable**: Single file database, easy backup and restore
