# OnTheGo Scanner - Development Guide

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Setup Development Environment](#setup-development-environment)
3. [Project Structure](#project-structure)
4. [Development Workflow](#development-workflow)
5. [Backend Services](#backend-services)
6. [Frontend Components](#frontend-components)
7. [State Management](#state-management)
8. [Testing](#testing)
9. [Building & Packaging](#building--packaging)
10. [Contributing](#contributing)

---

## Architecture Overview

### Technology Stack

**Frontend:**
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **MapLibre GL** - Interactive maps
- **CSS Modules** - Component styling

**Backend:**
- **Node.js** - Runtime environment
- **Fastify** - HTTP server framework
- **WebSockets** - Real-time data streaming
- **better-sqlite3** - Database
- **tsx** - TypeScript execution

**Desktop:**
- **Electron** - Desktop application wrapper
- **electron-builder** - Packaging and distribution

### Application Flow

```
┌──────────────────────────────────────────────────┐
│                  Electron Main                    │
│  - Window management                              │
│  - Backend server lifecycle                       │
│  - IPC bridge                                     │
└──────────────┬───────────────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
┌──────▼──────┐  ┌─────▼──────┐
│   Backend   │  │  Renderer  │
│   (Node.js) │  │   (React)  │
└──────┬──────┘  └─────▲──────┘
       │                │
       │    WebSocket   │
       └────────────────┘
       │
       │ TCP/HTTP
       │
┌──────▼──────────────────────────┐
│  External Services               │
│  - RTL-TCP (RF data)             │
│  - dump1090 (ADS-B)              │
│  - Kismet (Remote ID)            │
│  - gpsd (GPS)                    │
└──────────────────────────────────┘
```

### Data Flow

1. **External services** provide raw data (IQ samples, aircraft positions, GPS fixes)
2. **Backend** processes, aggregates, and stores data
3. **WebSocket** streams telemetry frames to frontend
4. **React components** render UI based on telemetry state
5. **User actions** send HTTP requests to backend API

---

## Setup Development Environment

### Prerequisites

- **Node.js** 18.17.0+ (LTS recommended)
- **npm** 9.0.0+
- **Operating System:**
  - **Linux** (Ubuntu/Debian recommended for full hardware support)
  - **Windows** 10/11 (limited hardware support, see [WINDOWS_BUILD.md](WINDOWS_BUILD.md))
- **Git**

**Note for Windows developers:** See [WINDOWS_BUILD.md](WINDOWS_BUILD.md) for Windows-specific setup instructions including build tools and native module compilation.

### Optional Hardware

- RTL-SDR dongle (for RF scanning)
- GPS receiver (for positioning)
- WiFi adapter (for Remote ID capture)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/radioscanner.git
   cd radioscanner
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Verify installation:**
   ```bash
   npm run typecheck
   npm run lint
   ```

### Development Tools

**Recommended IDE:**
- **VS Code** with extensions:
  - ESLint
  - Prettier
  - TypeScript and JavaScript Language Features

**Optional Tools:**
- **rtl-sdr tools** - `sudo apt install rtl-sdr`
- **dump1090** - `sudo apt install dump1090-mutability`
- **Kismet** - `sudo apt install kismet`
- **gpsd** - `sudo apt install gpsd gpsd-clients`

---

## Project Structure

```
radioscanner/
├── src/
│   ├── backend/           # Backend server code
│   │   ├── server.ts      # Main Fastify server
│   │   ├── health.ts      # Health monitor
│   │   ├── clients/       # Service client implementations
│   │   ├── sdr/           # RF/SDR processing
│   │   ├── services/      # Business logic services
│   │   └── storage/       # Database layer
│   │
│   ├── renderer/          # Frontend React code
│   │   ├── App.tsx        # Root component
│   │   ├── components/    # Reusable UI components
│   │   ├── contexts/      # React contexts
│   │   ├── features/      # Feature-specific components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── map/           # Map-related code
│   │   ├── utils/         # Utility functions
│   │   └── waterfall/     # Waterfall visualization
│   │
│   ├── config/            # Configuration
│   │   ├── index.ts       # Backend config
│   │   └── client.ts      # Frontend config
│   │
│   └── main/              # Electron main process
│       └── index.ts       # Main entry point
│
├── dist/                  # Production build output
├── dist-electron/         # Electron build output
├── data/                  # Runtime data (databases)
├── scripts/               # Build and utility scripts
├── docs/                  # Additional documentation
│
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── vite.config.ts         # Vite build configuration
├── electron-builder.json5 # Electron packager config
└── .eslintrc.cjs          # ESLint configuration
```

### Key Files

- **src/backend/server.ts** - Main backend entry point, routes, WebSocket
- **src/backend/health.ts** - Service health monitoring and telemetry
- **src/renderer/App.tsx** - React app root, provider setup
- **src/main/index.ts** - Electron main process, window management

---

## Development Workflow

### Running the App

**Development mode with mock data:**
```bash
USE_MOCK_DATA=true npm run dev
```

This starts:
- Backend server on `http://127.0.0.1:3000`
- Frontend dev server on `http://localhost:5173`
- Electron window with hot reload

**Development mode with real hardware:**
```bash
# Terminal 1: Start services
rtl_tcp -a 127.0.0.1 -p 1234 &
dump1090 --net --quiet &
sudo kismet -c wlan0 &
sudo systemctl start gpsd

# Terminal 2: Run app
npm run dev
```

**Backend only:**
```bash
npm run backend
```

**Frontend only:**
```bash
npm run dev
```

### Code Quality

**Type checking:**
```bash
npm run typecheck
```

**Linting:**
```bash
npm run lint

# Auto-fix issues
npm run lint -- --fix
```

**Format code:**
```bash
npx prettier --write .
```

### Debugging

**Backend debugging:**
Add `--inspect` flag to backend command:
```bash
node --inspect --import tsx/esm src/backend/server.ts
```

Then attach Chrome DevTools or VS Code debugger.

**Frontend debugging:**
- Open Chrome DevTools in Electron window (Ctrl+Shift+I)
- Use React DevTools extension
- Check browser console for errors

**Electron main process debugging:**
```bash
ELECTRON_ENABLE_LOGGING=1 npm run dev
```

---

## Backend Services

### Service Architecture

Each external service has a client class:

- **RtlTcpClient** - Connects to rtl_tcp, receives IQ data
- **Dump1090Client** - Polls dump1090 REST API for aircraft
- **KismetClient** - Connects to Kismet for drone Remote ID
- **GpsClient** - Connects to gpsd for GPS fixes

All clients:
- Extend `TypedEventEmitter`
- Implement `start()` and `stop()` methods
- Emit events for data and errors
- Provide `getStatus()` for health checks

### Health Monitor

**Location:** `src/backend/health.ts`

**Responsibilities:**
- Manages all service clients
- Aggregates telemetry from all sources
- Emits consolidated `TelemetryFrame` every second
- Handles service reconnection
- Provides `retry(service)` method

**Telemetry Frame Structure:**
```typescript
interface TelemetryFrame {
  timestamp: string;
  health: HealthSnapshot;
  aircraft: Aircraft[];
  drone: {
    ridAvailable: boolean;
    detections: Drone[];
  };
  signals: {
    rtlTcpConnected: boolean;
    gpsConnected: boolean;
  };
}
```

### API Endpoints

**Telemetry:**
- `GET /ws` - WebSocket for live telemetry stream

**Settings:**
- `GET /api/settings` - Get all settings
- `POST /api/settings` - Update single setting
- `POST /api/settings/bulk` - Update multiple settings
- `POST /api/settings/reset` - Reset to defaults
- `POST /api/services/test` - Test service connection

**RF Scanner:**
- `POST /api/scan/start` - Start RF scan
- `POST /api/scan/stop` - Stop RF scan

**Export:**
- `GET /api/export/csv?table=<aircraft|drones|signals>` - Export CSV
- `GET /api/export/json?table=<aircraft|drones|signals>` - Export JSON

### Database Schema

**Settings Database (`data/settings.sqlite`):**
```sql
CREATE TABLE user_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at INTEGER
);
```

**Session Database (in-memory or disk):**
```sql
-- Aircraft table
CREATE TABLE aircraft (
  hex TEXT PRIMARY KEY,
  flight TEXT,
  lat REAL,
  lon REAL,
  altitude INTEGER,
  ...
  first_seen INTEGER,
  last_seen INTEGER
);

-- Drones table
CREATE TABLE drones (
  drone_id TEXT PRIMARY KEY,
  lat REAL,
  lon REAL,
  altitude REAL,
  ...
  first_seen INTEGER,
  last_seen INTEGER
);

-- Signals table (RF peaks)
CREATE TABLE signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER,
  frequency_mhz REAL,
  power_db REAL,
  bandwidth_hz INTEGER
);
```

### Adding a New Service

1. **Create client class:**
   ```typescript
   // src/backend/clients/myServiceClient.ts
   export class MyServiceClient extends TypedEventEmitter<MyEvents> {
     async start(): Promise<void> { }
     stop(): void { }
     getStatus(): MyStatus { }
   }
   ```

2. **Add to HealthMonitor:**
   ```typescript
   // src/backend/health.ts
   constructor() {
     this.myService = new MyServiceClient();
   }
   ```

3. **Update TelemetryFrame type:**
   ```typescript
   interface TelemetryFrame {
     // ... existing fields
     myServiceData: MyData;
   }
   ```

4. **Add mock client** (optional):
   ```typescript
   // src/backend/mockClients.ts
   export class MockMyServiceClient extends TypedEventEmitter<MyEvents> {
     // Mock implementation
   }
   ```

---

## Frontend Components

### Component Architecture

**Atomic Design Structure:**
- **Atoms** - Basic components (buttons, inputs)
- **Molecules** - Simple component combinations
- **Organisms** - Complex components (panels, lists)
- **Templates** - Page layouts
- **Pages** - Full page components

### Key Components

**Top-Level:**
- `App.tsx` - Root component, provider setup
- `TopBar.tsx` - Status indicators, settings, export
- `MainContent.tsx` - Map and side panel layout

**Features:**
- `features/aircraft/` - Aircraft list and detail
- `features/drone/` - Drone list and detail
- `features/rf/` - RF scanner controls and display

**Contexts:**
- `TelemetryContext` - WebSocket telemetry stream
- `GPSContext` - GPS position data
- `ToastContext` - Notification system
- `SelectionContext` - Selected aircraft/drone state

### Creating a New Component

1. **Create component file:**
   ```typescript
   // src/renderer/components/MyComponent.tsx
   import React from 'react';

   interface MyComponentProps {
     data: string;
   }

   export const MyComponent: React.FC<MyComponentProps> = ({ data }) => {
     return <div>{data}</div>;
   };
   ```

2. **Add styles (optional):**
   ```css
   /* src/renderer/components/MyComponent.module.css */
   .container {
     padding: 1rem;
   }
   ```

3. **Use in parent:**
   ```typescript
   import { MyComponent } from './components/MyComponent';

   <MyComponent data="Hello" />
   ```

### Custom Hooks

**Telemetry:**
```typescript
const { telemetry, connected } = useTelemetry();
```

**Settings:**
```typescript
const { settings, loading, update, reset } = useSettings();
```

**User Position:**
```typescript
const position = useUserPosition(); // GPS or settings default
```

**GPS:**
```typescript
const { position, connected } = useGPS();
```

**Notifications:**
```typescript
const { showToast } = useToast();
showToast('Message', 'success');
```

---

## State Management

### React Context Pattern

State is managed through React Contexts:

1. **TelemetryContext** - WebSocket connection and live data
2. **GPSContext** - GPS position derived from telemetry
3. **SelectionContext** - UI selection state (which aircraft/drone clicked)
4. **ToastContext** - Notification queue

### Settings State

Settings are:
- Stored in SQLite database (backend)
- Fetched on app start
- Cached in React state
- Updated via API calls
- Persisted across sessions

### Real-time Updates

WebSocket connection in `TelemetryContext`:
```typescript
useEffect(() => {
  const ws = new WebSocket('ws://localhost:3000/ws');

  ws.onmessage = (event) => {
    const frame = JSON.parse(event.data);
    setTelemetry(frame);
  };

  // Automatic reconnection on disconnect
}, []);
```

---

## Testing

### Unit Tests

**Run tests:**
```bash
npm test
```

**Watch mode:**
```bash
npm test -- --watch
```

**Test structure:**
```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from './myFunction';

describe('myFunction', () => {
  it('should return expected value', () => {
    expect(myFunction('input')).toBe('output');
  });
});
```

### Integration Tests

Test with mock services:
```bash
USE_MOCK_DATA=true npm run backend &
npm run dev
```

Verify:
- Aircraft appear on map
- Drones appear in list
- RF scanner shows data
- Settings persist
- Export works

### End-to-End Tests

Test with real hardware:
```bash
# Start all services
rtl_tcp -a 127.0.0.1 -p 1234 &
dump1090 --net --quiet &
sudo kismet -c wlan0 &
sudo systemctl start gpsd

# Run app
npm run dev

# Verify all features work
```

### Performance Testing

**Monitor performance:**
```bash
npm run perf
```

This runs a load test with:
- 100+ aircraft
- Frequent updates
- Continuous RF scanning

**Check for:**
- Memory leaks
- CPU usage
- UI responsiveness
- WebSocket stability

---

## Building & Packaging

### Development Build

```bash
npm run build
```

This:
1. Runs linting
2. Runs type checking
3. Builds frontend (Vite)
4. Builds backend (Vite SSR)
5. Builds Electron main process
6. Packages as Linux AppImage

### Production Build

**For Linux:**
```bash
npm run build
```

Output: `dist/onthego-scanner-0.1.0-x64.AppImage`

### Build Configuration

**Vite config:** `vite.config.ts`
- Frontend build settings
- Backend SSR build
- Plugin configuration

**Electron Builder:** `electron-builder.json5`
- App metadata
- Packaging options
- Linux AppImage settings

### Debugging Build Issues

**Clear caches:**
```bash
rm -rf node_modules dist dist-electron
npm install
npm run build
```

**Check for errors:**
- TypeScript errors in build output
- Missing dependencies
- File permission issues

---

## Contributing

### Code Style

**TypeScript:**
- Use TypeScript for all new code
- Avoid `any` type (use `unknown` with type guards)
- Use explicit return types for functions
- Prefer `interface` over `type` for objects

**React:**
- Use functional components
- Use hooks for state and effects
- Extract complex logic into custom hooks
- Keep components small and focused

**Naming:**
- Components: `PascalCase`
- Files: `camelCase.tsx` or `PascalCase.tsx`
- Variables/functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- CSS classes: `kebab-case`

### Git Workflow

**Branching:**
```bash
git checkout -b feature/my-feature
```

**Commits:**
```bash
# Use conventional commits
git commit -m "feat: add new feature"
git commit -m "fix: resolve bug"
git commit -m "docs: update documentation"
```

**Pull Requests:**
1. Create feature branch
2. Make changes
3. Run tests and linting
4. Push to remote
5. Create pull request
6. Address review feedback

### Testing Requirements

Before submitting PR:
1. All tests pass: `npm test`
2. No lint errors: `npm run lint`
3. No type errors: `npm run typecheck`
4. App builds: `npm run build`
5. Manual testing completed

### Documentation

Update documentation when:
- Adding new features
- Changing APIs
- Modifying configuration
- Adding dependencies

---

## Common Development Tasks

### Add New Settings Field

1. **Update default settings:**
   ```typescript
   // src/backend/storage/settingsDb.ts
   const DEFAULT_SETTINGS = [
     // ...
     ['my.newSetting', 'defaultValue'],
   ];
   ```

2. **Update settings parser:**
   ```typescript
   // src/backend/services/settingsParser.ts
   export interface Settings {
     my: {
       newSetting: string;
     };
   }
   ```

3. **Add to settings UI:**
   ```typescript
   // src/renderer/components/EnhancedSettingsPanel.tsx
   <input
     value={getValue('my.newSetting')}
     onChange={(e) => handleChange('my.newSetting', e.target.value)}
   />
   ```

### Add New RF Band

1. **Update bands file:**
   ```typescript
   // src/renderer/features/rf/bands.ts
   export const RF_BANDS = {
     // ...
     newBand: {
       label: 'New Band',
       centerHz: 150_000_000,
       sampleRate: 2_048_000,
       spanHz: 2_048_000
     },
   };
   ```

2. **Band automatically appears in dropdown**

### Add New Map Style

1. **Update map configuration:**
   ```typescript
   // src/renderer/map/MapPanel.ts
   const STYLES = {
     // ...
     newStyle: 'https://tiles.example.com/style.json',
   };
   ```

2. **Add to settings dropdown:**
   ```typescript
   // src/renderer/components/EnhancedSettingsPanel.tsx
   <option value="newStyle">New Style</option>
   ```

---

## Performance Optimization

### Frontend

**Rendering:**
- Use `React.memo()` for expensive components
- Memoize callbacks with `useCallback()`
- Memoize values with `useMemo()`
- Virtualize long lists (react-window)

**Bundle Size:**
- Code split with `React.lazy()`
- Import only needed functions
- Remove unused dependencies
- Analyze bundle: `npm run build -- --analyze`

### Backend

**Database:**
- Use indexes on frequently queried columns
- Limit result sets
- Use prepared statements
- Vacuum database periodically

**Memory:**
- Limit in-memory caches
- Use streams for large data
- Clean up old records
- Monitor with: `node --inspect`

**CPU:**
- Offload intensive work to workers
- Throttle API requests
- Batch database writes
- Use efficient algorithms

---

## Debugging Tips

### Backend Issues

**Check logs:**
```bash
# Backend logs are printed to terminal
npm run backend | tee backend.log
```

**Common issues:**
- Port already in use: Change port or kill process
- Service connection failed: Verify service is running
- Database locked: Close other connections

### Frontend Issues

**React DevTools:**
- Install React DevTools extension
- Inspect component tree
- Check props and state
- Profile performance

**Network tab:**
- Check WebSocket connection
- Verify API responses
- Monitor request timing

### Electron Issues

**Main process logs:**
```bash
ELECTRON_ENABLE_LOGGING=1 npm run dev
```

**IPC issues:**
- Check preload script
- Verify IPC channel names
- Check security policy

---

## Resources

### Documentation

- [React Docs](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Electron Docs](https://www.electronjs.org/docs)
- [Fastify Docs](https://fastify.dev/)
- [MapLibre GL Docs](https://maplibre.org/)

### Tools

- [RTL-SDR Wiki](https://www.rtl-sdr.com/)
- [dump1090 GitHub](https://github.com/antirez/dump1090)
- [Kismet Docs](https://www.kismetwireless.net/docs/)
- [GPSD Project](https://gpsd.gitlab.io/gpsd/)

### Community

- GitHub Issues
- Discord (if available)
- Forum (if available)

---

## License

See LICENSE file for details.
