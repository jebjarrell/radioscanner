# Critical Bug Fixes and Configuration Centralization

## 🎯 Summary

This PR fixes **5 critical bugs** and eliminates **27+ hardcoded service URLs** by implementing a centralized configuration system. All changes are focused on stability, maintainability, and configurability.

## 🐛 Critical Bugs Fixed

### 1. SQL Export Parameter Binding Error 🔴
**Files**: `signalDb.ts`, `aircraftDb.ts`

**Issue**:
```typescript
// BUG - start parameter passed twice
this.exportStmt.all(start ?? null, start ?? null, end ?? null, end ?? null)
```

**Fix**: Now correctly passes start/end pairs for date range queries

**Impact**: CSV export with custom date ranges now works correctly

---

### 2. Unhandled Promise Rejection in Quit Handler 🔴
**File**: `main/index.ts:151-284`

**Issue**: Async quit handler wrapped in `void` without error handling, causing silent crashes

**Fix**:
- Complete try-catch wrapper with error recovery
- Fallback error dialog for quit failures
- Graceful handling of missing windows
- Double-catch on promise rejection

**Impact**: Application no longer crashes silently during shutdown

---

### 3. TypeScript Import Warnings 🟡
**Files**: All database modules

**Issue**: Incorrect import from better-sqlite3
```typescript
// Before
import Database from 'better-sqlite3';
type Statement = Database.Statement;

// After
import BetterSqlite3 from 'better-sqlite3';
type Statement = BetterSqlite3.Statement;
```

**Impact**: Clean TypeScript compilation

---

### 4. Missing Database Error Handling 🟠
**Files**: `signalDb.ts`, `aircraftDb.ts`, `droneDb.ts`

**Added**:
- Try-catch blocks on all database operations
- `insertBatch()`: Logs errors, allows telemetry to continue (non-critical)
- `getCount()`: Returns 0 on error (safe fallback)
- `exportToCsv()`: Throws descriptive error (critical operation)

**Impact**: No more silent data loss; all errors properly logged with context

---

### 5. Hardcoded Service URLs 🟠
**Files**: 22 files across frontend/backend

**Issue**: 27+ instances of hardcoded URLs like:
- `'ws://127.0.0.1:3000/ws'`
- `'http://127.0.0.1:8080/data/aircraft.json'`
- `'http://127.0.0.1:2501/system/status.json'`

**Fix**: Created centralized configuration system

---

## ⚙️ Configuration System

### Backend Configuration (`src/config/index.ts`)
```typescript
// Environment variable support
const config = {
  backend: { host, port, baseUrl, wsUrl },
  dump1090: { host, port, baseUrl },
  kismet: { host, port, baseUrl },
  rtlTcp: { host, port },
  gpsd: { host, port }
};
```

**Supported Environment Variables**:
```bash
BACKEND_HOST=127.0.0.1
BACKEND_PORT=3000
DUMP1090_HOST=127.0.0.1
DUMP1090_PORT=8080
KISMET_HOST=127.0.0.1
KISMET_PORT=2501
RTL_TCP_HOST=127.0.0.1
RTL_TCP_PORT=1234
GPSD_HOST=127.0.0.1
GPSD_PORT=2947
```

### Frontend Configuration (`src/config/client.ts`)
Uses Vite environment variables:
```bash
VITE_BACKEND_HOST=127.0.0.1
VITE_BACKEND_PORT=3000
```

---

## 📊 Changes Summary

**Files Changed**: 22 files
**Lines Added**: +476
**Lines Removed**: -203
**Net Change**: +273 lines

### Updated Files

**Backend Services**:
- ✅ `dump1090Client.ts` - ADS-B aircraft tracking
- ✅ `kismetClient.ts` - Kismet status checking
- ✅ `kismetRid.ts` - Remote ID drone detection
- ✅ `gpsClient.ts` - GPS position data
- ✅ `rtlTcpClient.ts` (2 files) - RTL-SDR TCP clients
- ✅ `server.ts` - Fastify backend with dynamic CORS

**Database Layer**:
- ✅ `aircraftDb.ts` - Aircraft persistence with error handling
- ✅ `droneDb.ts` - Drone records with error handling
- ✅ `signalDb.ts` - RF signal peaks with error handling

**Main Process**:
- ✅ `main/index.ts` - Quit handler fixes + dynamic CSP policy

**Frontend Components**:
- ✅ `TelemetryContext.tsx` - WebSocket connection
- ✅ `DashboardCounters.tsx` - RF scan controls
- ✅ `ExportDialog.tsx` - CSV export
- ✅ `SettingsPanel.tsx` - Settings API
- ✅ `DroneDetail.tsx` - Drone export
- ✅ `RfControls.tsx` - RF controls
- ✅ `useRfStream.ts` - RF spectrum hook
- ✅ `useSignals.ts` - Signals API hook
- ✅ `legacy-main.ts` - Legacy telemetry

**New Files**:
- ✨ `src/config/index.ts` - Backend configuration module
- ✨ `src/config/client.ts` - Frontend configuration module

---

## ✅ Verification

- ✅ All hardcoded IPs removed (verified with grep)
- ✅ No TypeScript import warnings
- ✅ All database operations have error handling
- ✅ Configuration modules properly export all endpoints
- ✅ Environment variable fallbacks work correctly

---

## 🧪 Testing Instructions

### Configuration Testing
```bash
# Test with default configuration
npm run dev

# Test with custom backend port
BACKEND_PORT=4000 npm run dev

# Test with custom service endpoints
DUMP1090_PORT=9000 KISMET_PORT=3000 npm run dev
```

### CSV Export Testing
1. Start application
2. Wait for telemetry data (aircraft/signals)
3. Open Export Dialog
4. Select date range (all, last hour, or custom)
5. Verify CSV exports successfully

### Quit Handler Testing
1. Generate some session data
2. Attempt to quit application
3. Verify save dialog appears
4. Test "Save & Quit", "Quit Without Saving", and "Cancel"
5. Test error scenario by providing invalid save path

---

## 🎯 Breaking Changes

**None** - All changes are backwards compatible. Default values match previous hardcoded values.

---

## 📝 Migration Guide

If you were previously relying on hardcoded URLs:

### Before
```typescript
const response = await fetch('http://127.0.0.1:3000/api/signals');
```

### After
```typescript
import { BACKEND_URL } from '../config/client.js';
const response = await fetch(`${BACKEND_URL}/api/signals`);
```

---

## 🔗 Related Issues

Fixes issues mentioned in project state document:
- 🔴 Critical: SQL export bug
- 🔴 Critical: Unhandled promise rejection
- 🟠 High: Hardcoded service URLs
- 🟠 High: Missing database error handling
- 🟡 Medium: TypeScript import warnings

---

## 📸 Screenshots

N/A - Internal bug fixes and refactoring only, no UI changes.

---

## Commits

- `69ff71b` - fix: critical bug fixes and configuration centralization
- `2097196` - fix: update remaining rtlTcpClient to use centralized config

---

## Checklist

- [x] All critical bugs fixed
- [x] Configuration centralized with environment variable support
- [x] Error handling added to all database operations
- [x] TypeScript warnings resolved
- [x] All hardcoded URLs removed (verified)
- [x] Backwards compatible (no breaking changes)
- [x] Code follows project conventions
- [x] Ready for review

---

**Reviewer Notes**:
- This PR is focused on stability and maintainability
- No new features added
- All changes preserve existing functionality
- Configuration system enables easier deployment across different environments
