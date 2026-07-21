# SQLite Advanced Reference

Detailed technical information for advanced SQLite operations in GridDown.

## Transaction Control

### Understanding Transactions

SQLite transactions ensure atomic operations—either all changes succeed or none do.

```python
import sqlite3

# PEP 249 compliant: autocommit=False (recommended)
conn = sqlite3.connect("bulletin.db", autocommit=False)

# Transaction is always open after connect
conn.execute("INSERT INTO posts (author, title) VALUES (?, ?)", ("Alice", "Test"))
conn.execute("UPDATE posts SET priority = 'urgent' WHERE id = 1")

# Explicit commit required
conn.commit()  # Both changes saved atomically

# Or rollback on error
conn.rollback()  # Discard all uncommitted changes
```

### Context Manager Behavior

```python
# With context manager: auto-commits on success, auto-rollbacks on exception
with sqlite3.connect("bulletin.db") as conn:
    conn.execute("INSERT ...")  # If this succeeds...
    conn.execute("UPDATE ...")  # ...and this succeeds...
    # Auto-commit happens here

# If exception raised inside the block:
# - Changes are rolled back
# - Exception propagates
# - Connection remains open (not closed)
```

### Legacy vs Modern Transaction Control

```python
# Modern (Python 3.12+): explicit autocommit
conn = sqlite3.connect("bulletin.db", autocommit=False)

# Legacy: isolation_level (still default for compatibility)
conn = sqlite3.connect("bulletin.db")  # isolation_level='DEFERRED'
conn.isolation_level = None  # Disable implicit transactions (raw autocommit)
```

## WAL Mode Deep Dive

### How WAL Works

Write-Ahead Logging changes how SQLite handles writes:

1. **Without WAL (rollback journal)**:
   - Before modifying a page, copy original to rollback journal
   - Modify page in place
   - On crash: restore from rollback journal
   - Readers block writers, writers block readers

2. **With WAL**:
   - Append changes to WAL file
   - Original database unchanged until checkpoint
   - On crash: WAL changes discarded, original intact
   - Readers and writers can work concurrently

### WAL Files

```
bulletin.db      # Main database (unchanged during writes)
bulletin.db-wal  # Write-ahead log (new changes)
bulletin.db-shm  # Shared memory for coordination
```

**Important**: All three files must stay together. Copying only `bulletin.db` loses uncommitted WAL changes.

### Checkpointing

WAL changes periodically merge back to main database:

```python
# Automatic: happens when WAL reaches ~1000 pages
# Manual: force checkpoint
conn.execute("PRAGMA wal_checkpoint(PASSIVE)")   # Non-blocking, best-effort
conn.execute("PRAGMA wal_checkpoint(FULL)")      # Wait for readers, then checkpoint
conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")  # Full + truncate WAL file to zero
conn.execute("PRAGMA wal_checkpoint(RESTART)")   # Full + reset WAL to beginning
```

### When to Use WAL vs Rollback Journal

**Use WAL (default for GridDown)**:
- Multiple readers with occasional writes
- Crash resilience is critical
- Need concurrent access

**Use rollback journal**:
- Network filesystems (NFS, SMB) - WAL doesn't work
- Need to copy single file (no -wal/-shm)
- Very old SQLite versions

## Performance Optimization

### Indexing Strategy

```sql
-- Query pattern determines index design
-- For: SELECT * FROM posts WHERE author = ? ORDER BY created_at DESC

-- Good: covers both filter and sort
CREATE INDEX idx_author_created ON posts(author, created_at DESC);

-- Check if index is used
EXPLAIN QUERY PLAN SELECT * FROM posts WHERE author = 'Alice' ORDER BY created_at DESC;
-- Should show: SEARCH posts USING INDEX idx_author_created
```

### Batch Operations

```python
# Slow: individual commits
for item in large_list:
    conn.execute("INSERT INTO posts VALUES (...)", item)
    conn.commit()  # Disk sync each time

# Fast: batch commit
conn.execute("BEGIN")
for item in large_list:
    conn.execute("INSERT INTO posts VALUES (...)", item)
conn.commit()  # Single disk sync

# Fastest: executemany
conn.executemany("INSERT INTO posts VALUES (?, ?, ?)", large_list)
conn.commit()
```

### Memory Settings

```python
# Increase cache for read-heavy workloads (default: 2000 pages = ~8MB)
conn.execute("PRAGMA cache_size = -64000")  # Negative = KB, so 64MB

# Memory-mapped I/O for faster reads (use cautiously)
conn.execute("PRAGMA mmap_size = 268435456")  # 256MB
```

## Error Handling

### Common Exceptions

```python
import sqlite3

try:
    conn.execute("INSERT INTO posts ...")
    conn.commit()
except sqlite3.IntegrityError:
    # UNIQUE constraint, NOT NULL violation, etc.
    conn.rollback()
except sqlite3.OperationalError as e:
    # Database locked, disk I/O error, etc.
    if "locked" in str(e):
        # Retry logic
        pass
    conn.rollback()
except sqlite3.DatabaseError:
    # Corruption, malformed database
    # Restore from backup
    pass
```

### Timeout Configuration

```python
# Wait up to 30 seconds for locks to clear (default: 5)
conn = sqlite3.connect("bulletin.db", timeout=30.0)
```

## Type Handling

### SQLite Type Affinity

SQLite has 5 storage classes: NULL, INTEGER, REAL, TEXT, BLOB

```python
# Python types map to SQLite types:
None       → NULL
int        → INTEGER
float      → REAL
str        → TEXT
bytes      → BLOB

# Reading back:
NULL       → None
INTEGER    → int
REAL       → float
TEXT       → str (depends on text_factory)
BLOB       → bytes
```

### Custom Type Adapters

```python
import sqlite3
from datetime import datetime
from uuid import UUID

# Register adapter: Python → SQLite
def adapt_datetime(dt):
    return dt.isoformat()

def adapt_uuid(u):
    return str(u)

sqlite3.register_adapter(datetime, adapt_datetime)
sqlite3.register_adapter(UUID, adapt_uuid)

# Register converter: SQLite → Python
def convert_datetime(b):
    return datetime.fromisoformat(b.decode())

def convert_uuid(b):
    return UUID(b.decode())

sqlite3.register_converter("DATETIME", convert_datetime)
sqlite3.register_converter("UUID", convert_uuid)

# Enable converters
conn = sqlite3.connect("bulletin.db", detect_types=sqlite3.PARSE_DECLTYPES)
```

## Concurrent Access

### Multiple Processes

SQLite handles multiple processes safely with locking:

```python
# Process 1: Writing
conn1 = sqlite3.connect("bulletin.db", timeout=30)
conn1.execute("BEGIN IMMEDIATE")  # Acquire write lock early
# ... long operation ...
conn1.commit()  # Release lock

# Process 2: Reading (works even during Process 1's write with WAL)
conn2 = sqlite3.connect("bulletin.db")
cursor = conn2.execute("SELECT * FROM posts")  # Sees consistent snapshot
```

### Thread Safety

```python
# Default: can only use connection in creating thread
conn = sqlite3.connect("bulletin.db")  # check_same_thread=True

# Allow sharing (use with external locking)
conn = sqlite3.connect("bulletin.db", check_same_thread=False)
# You must implement thread synchronization yourself
```

## Recovery Procedures

### From Corruption

```bash
# Step 1: Attempt recovery
sqlite3 corrupt.db ".recover" > recovered.sql

# Step 2: Create new database
sqlite3 new.db < recovered.sql

# Step 3: Verify
sqlite3 new.db "PRAGMA integrity_check"
```

### From WAL File

If main database is intact but WAL wasn't applied:

```bash
# Open database to trigger WAL replay
sqlite3 bulletin.db "SELECT 1"

# Or force checkpoint
sqlite3 bulletin.db "PRAGMA wal_checkpoint(TRUNCATE)"
```

### Export/Import

```bash
# Full export (schema + data)
sqlite3 bulletin.db ".dump" > full_backup.sql

# Schema only
sqlite3 bulletin.db ".schema" > schema.sql

# Data only (requires existing schema)
sqlite3 bulletin.db ".mode insert" ".output data.sql" "SELECT * FROM posts;"

# Import
sqlite3 new.db < full_backup.sql
```

## Debugging

### Query Explanation

```bash
# See execution plan
sqlite3 bulletin.db "EXPLAIN QUERY PLAN SELECT * FROM posts WHERE author = 'Alice'"

# Full bytecode (advanced)
sqlite3 bulletin.db "EXPLAIN SELECT * FROM posts WHERE author = 'Alice'"
```

### Database Statistics

```python
# Table sizes
cursor = conn.execute("""
    SELECT name, 
           (SELECT COUNT(*) FROM posts) as row_count
    FROM sqlite_master 
    WHERE type='table' AND name='posts'
""")

# Index usage statistics (requires SQLITE_STAT4)
cursor = conn.execute("SELECT * FROM sqlite_stat1")
```
