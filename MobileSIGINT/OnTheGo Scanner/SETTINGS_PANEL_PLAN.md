# Enhanced Settings Panel - Implementation Plan

## Overview

This document outlines the implementation plan for a comprehensive Settings Panel that allows users to configure all aspects of the OnTheGo Scanner application at runtime.

## Current State Analysis

### Existing Infrastructure ✅

1. **Settings Database** (`src/backend/storage/settingsDb.ts`):
   - SQLite-based persistent settings storage
   - Key-value structure
   - Methods: `getAll()`, `set(key, value)`, `close()`
   - Default settings:
     - `session_storage_mode: 'memory'`
     - `distance_unit: 'miles'`
     - `default_band: 'airband'`
     - `map_zoom: '10'`
     - `map_center: '-73.935,40.730'`

2. **Backend API** (`src/backend/server.ts`):
   - `GET /api/settings` - Returns all settings
   - `POST /api/settings` - Updates a single setting (key/value)
   - `POST /api/settings/session-storage` - Special endpoint for session storage mode

3. **Frontend Settings Panel** (`src/renderer/components/SettingsPanel.tsx`):
   - Minimal UI - only session storage mode setting
   - Basic fetch/save pattern
   - No validation, no grouping

4. **Configuration System** (`src/config/index.ts`, `src/config/client.ts`):
   - Environment variable based
   - Separate backend/client configs
   - Service URLs (dump1090, kismet, rtlTcp, gpsd)
   - Currently not runtime-configurable

### What Needs to be Built 🏗️

1. **Service URL Configuration UI**
   - Runtime configuration for all service endpoints
   - Validation (host/port format)
   - Test connection buttons
   - Restart notification

2. **User Preferences**
   - Distance units (miles/kilometers/nautical miles)
   - Map style selection (different tile providers)
   - Default map center and zoom

3. **Notification Settings**
   - Toast notification system (doesn't exist yet!)
   - Enable/disable notifications
   - Drone detection alerts
   - Aircraft proximity alerts
   - New signal alerts

4. **Performance Tuning**
   - Waterfall history rows (40-200)
   - Max aircraft displayed (40-200)
   - Peak detection sensitivity
   - Update intervals

## Architecture

### 1. Settings Data Model

```typescript
interface AppSettings {
  // Service URLs
  services: {
    backendHost: string;
    backendPort: number;
    dump1090Host: string;
    dump1090Port: number;
    kismetHost: string;
    kismetPort: number;
    rtlTcpHost: string;
    rtlTcpPort: number;
    gpsdHost: string;
    gpsdPort: number;
  };

  // User Preferences
  preferences: {
    distanceUnit: 'miles' | 'kilometers' | 'nautical';
    mapStyle: 'osm' | 'dark' | 'satellite' | 'demotiles';
    mapDefaultCenter: { lat: number; lon: number };
    mapDefaultZoom: number;
  };

  // Notifications
  notifications: {
    enabled: boolean;
    droneDetected: boolean;
    aircraftProximity: boolean;
    aircraftProximityThresholdMiles: number;
    newSignal: boolean;
    duration: number; // ms
    position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  };

  // Performance
  performance: {
    waterfallMaxRows: number;
    maxAircraftDisplayed: number;
    peakDetectionSensitivity: 'low' | 'medium' | 'high';
    telemetryUpdateInterval: number; // ms
  };

  // Session
  session: {
    storageMode: 'memory' | 'disk';
  };
}
```

### 2. Settings Database Schema

Current: Simple key-value pairs in `settings` table

**Migration Strategy:**
- Keep existing key-value structure for compatibility
- Use dot notation for nested settings: `services.dump1090Host`, `preferences.distanceUnit`
- Backend parses into structured object for API responses

Example keys:
```
services.backendHost = "127.0.0.1"
services.backendPort = "3000"
services.dump1090Host = "127.0.0.1"
services.dump1090Port = "8080"
preferences.distanceUnit = "miles"
preferences.mapStyle = "demotiles"
notifications.enabled = "true"
notifications.droneDetected = "true"
performance.waterfallMaxRows = "100"
```

### 3. Backend API Enhancements

**New Endpoints:**

```typescript
// Get all settings (already exists, enhance response)
GET /api/settings
Response: {
  services: { ... },
  preferences: { ... },
  notifications: { ... },
  performance: { ... },
  session: { ... }
}

// Update multiple settings atomically
POST /api/settings/bulk
Body: { updates: Array<{ key: string; value: string }> }
Response: { success: boolean; requiresRestart: boolean }

// Test service connection
POST /api/settings/test-connection
Body: { service: 'dump1090' | 'kismet' | 'rtlTcp' | 'gpsd'; host: string; port: number }
Response: { success: boolean; error?: string; latencyMs?: number }

// Reset to defaults
POST /api/settings/reset
Body: { section?: 'services' | 'preferences' | 'notifications' | 'performance' }
Response: { success: boolean }
```

### 4. Frontend Components

**New Components to Create:**

1. **`src/renderer/components/Toast.tsx`**
   - Toast notification component
   - Auto-dismiss with configurable duration
   - Different types: info, success, warning, error
   - Position configurable

2. **`src/renderer/contexts/ToastContext.tsx`**
   - Global toast state management
   - `showToast(message, type, duration)` function
   - Queue management for multiple toasts

3. **Enhanced `src/renderer/components/SettingsPanel.tsx`**
   - Tab-based interface (Services, Preferences, Notifications, Performance)
   - Form validation
   - Save/Cancel/Reset buttons
   - "Requires Restart" warning

**Settings Panel Structure:**

```tsx
<SettingsPanel>
  <Tabs>
    <Tab name="Services">
      <ServiceSection
        label="Backend Server"
        host={settings.services.backendHost}
        port={settings.services.backendPort}
        onTest={testConnection}
      />
      <ServiceSection label="dump1090" ... />
      <ServiceSection label="Kismet" ... />
      <ServiceSection label="RTL-SDR (rtl_tcp)" ... />
      <ServiceSection label="GPSd" ... />
    </Tab>

    <Tab name="Preferences">
      <Select label="Distance Units" options={['miles', 'kilometers', 'nautical']} />
      <Select label="Map Style" options={mapStyles} />
      <MapCenterPicker />
      <NumberInput label="Default Zoom" min={1} max={20} />
    </Tab>

    <Tab name="Notifications">
      <Checkbox label="Enable Notifications" />
      <Checkbox label="Drone Detected" />
      <Checkbox label="Aircraft Proximity Alert" />
      <NumberInput label="Proximity Threshold (miles)" />
      <Checkbox label="New Signal Detected" />
      <NumberInput label="Toast Duration (ms)" />
      <Select label="Position" options={positions} />
    </Tab>

    <Tab name="Performance">
      <RangeInput label="Waterfall History (rows)" min={40} max={200} />
      <RangeInput label="Max Aircraft Displayed" min={40} max={200} />
      <Select label="Peak Detection" options={['low', 'medium', 'high']} />
      <NumberInput label="Update Interval (ms)" min={500} max={5000} />
    </Tab>
  </Tabs>

  <Actions>
    <Button onClick={handleSave}>Save Changes</Button>
    <Button onClick={handleCancel}>Cancel</Button>
    <Button onClick={handleReset}>Reset to Defaults</Button>
  </Actions>
</SettingsPanel>
```

### 5. Distance Unit Conversion

**Create:** `src/renderer/utils/distance.ts`

```typescript
type DistanceUnit = 'miles' | 'kilometers' | 'nautical';

export function convertDistance(
  meters: number,
  toUnit: DistanceUnit
): number {
  switch (toUnit) {
    case 'miles':
      return meters * 0.000621371;
    case 'kilometers':
      return meters * 0.001;
    case 'nautical':
      return meters * 0.000539957;
  }
}

export function formatDistance(
  meters: number,
  unit: DistanceUnit,
  precision: number = 1
): string {
  const value = convertDistance(meters, unit);
  const suffix = unit === 'nautical' ? 'nm' : unit === 'miles' ? 'mi' : 'km';
  return `${value.toFixed(precision)} ${suffix}`;
}
```

**Integration Points:**
- `src/renderer/features/aircraft/AircraftList.tsx` - Display distances
- `src/renderer/features/drone/DroneList.tsx` - Display distances
- `src/renderer/features/aircraft/AircraftDetail.tsx` - Detail view
- `src/renderer/features/drone/DroneDetail.tsx` - Detail view

### 6. Map Style Configuration

**Map Style Options:**

```typescript
const MAP_STYLES = {
  demotiles: {
    name: 'MapLibre Demo Tiles',
    url: 'https://demotiles.maplibre.org/style.json',
    attribution: 'MapLibre'
  },
  osm: {
    name: 'OpenStreetMap',
    url: 'https://tiles.openfreemap.org/styles/liberty',
    attribution: '© OpenStreetMap contributors'
  },
  dark: {
    name: 'Dark Mode',
    url: 'https://tiles.openfreemap.org/styles/dark',
    attribution: '© OpenStreetMap contributors'
  },
  satellite: {
    name: 'Satellite',
    url: 'https://tiles.openfreemap.org/styles/satellite',
    attribution: '© OpenStreetMap contributors'
  }
};
```

**Modify:** `src/renderer/map/MapPanel.ts`

```typescript
// Remove hardcoded MAP_STYLE_URL
// Add method to update map style dynamically
public setMapStyle(styleUrl: string): void {
  this.map.setStyle(styleUrl);
}
```

**Integration:**
- Fetch map style from settings on load
- Allow runtime changes via settings panel
- Save preference to settings database

### 7. Notification System

**Create:** `src/renderer/components/Toast.tsx`

```tsx
export interface ToastProps {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration: number;
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({
  id,
  message,
  type,
  duration,
  position,
  onDismiss
}) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  return (
    <div className={`toast toast--${type} toast--${position}`}>
      <div className="toast__message">{message}</div>
      <button className="toast__close" onClick={() => onDismiss(id)}>×</button>
    </div>
  );
};
```

**Create:** `src/renderer/contexts/ToastContext.tsx`

```tsx
interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastState[]>([]);

  const showToast = (message: string, type: ToastType = 'info', duration = 3000) => {
    const id = `toast-${Date.now()}`;
    setToasts(prev => [...prev, { id, message, type, duration }]);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(toast => (
          <Toast key={toast.id} {...toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};
```

**Notification Triggers:**

1. **Drone Detection:**
```typescript
useEffect(() => {
  if (settings.notifications.enabled && settings.notifications.droneDetected) {
    const newDrones = currentDrones.filter(d => !previousDrones.has(d.droneId));
    newDrones.forEach(drone => {
      showToast(
        `Drone detected: ${drone.manufacturer} ${drone.model}`,
        'warning',
        settings.notifications.duration
      );
    });
  }
}, [currentDrones]);
```

2. **Aircraft Proximity:**
```typescript
useEffect(() => {
  if (settings.notifications.enabled && settings.notifications.aircraftProximity) {
    const threshold = convertDistance(
      settings.notifications.aircraftProximityThresholdMiles,
      'miles',
      'meters'
    );

    aircraft.forEach(plane => {
      const distance = calculateDistance(userPosition, planePosition);
      if (distance < threshold && !alertedAircraft.has(plane.hex)) {
        showToast(
          `Aircraft nearby: ${plane.flight} at ${formatDistance(distance, settings.preferences.distanceUnit)}`,
          'info',
          settings.notifications.duration
        );
        alertedAircraft.add(plane.hex);
      }
    });
  }
}, [aircraft]);
```

3. **New Signal:**
```typescript
useEffect(() => {
  if (settings.notifications.enabled && settings.notifications.newSignal) {
    if (signals.rtlTcpConnected && !wasRtlConnected) {
      showToast('RTL-SDR connected', 'success', settings.notifications.duration);
    }
    if (signals.gpsConnected && !wasGpsConnected) {
      showToast('GPS lock acquired', 'success', settings.notifications.duration);
    }
  }
}, [signals]);
```

### 8. Performance Settings Integration

**Modify:** `src/renderer/map/MapPanel.ts`

```typescript
// Add methods to update performance settings dynamically
public setWaterfallMaxRows(maxRows: number): void {
  this.waterfall.setMaxRows(maxRows);
}

public setMaxAircraftDisplayed(limit: number): void {
  this.maxAircraftLimit = limit;
  this.refreshLayers();
}
```

**Modify:** `src/backend/sdr/peakDetector.ts`

```typescript
// Add method to update sensitivity
public setSensitivity(level: 'low' | 'medium' | 'high'): void {
  switch (level) {
    case 'low':
      this.minSnrDb = 10; // More strict
      this.minWidth = 3;
      break;
    case 'medium':
      this.minSnrDb = 6; // Default
      this.minWidth = 1;
      break;
    case 'high':
      this.minSnrDb = 3; // More sensitive
      this.minWidth = 1;
      break;
  }
}
```

## Implementation Phases

### Phase 1: Notification System (Foundation)

**Goal:** Build toast notification infrastructure

1. Create `Toast.tsx` component
2. Create `ToastContext.tsx` provider
3. Add CSS styling for toasts
4. Integrate ToastProvider into app root
5. Test with manual triggers

**Files to Create:**
- `src/renderer/components/Toast.tsx`
- `src/renderer/contexts/ToastContext.tsx`
- Add toast styles to `src/renderer/style.css`

**Files to Modify:**
- `src/renderer/main.tsx` - Wrap app in ToastProvider

### Phase 2: Settings Data Layer

**Goal:** Expand settings database and API

1. Add default settings for all new categories
2. Create settings parsing/structuring logic
3. Implement bulk update endpoint
4. Implement test connection endpoint
5. Implement reset endpoint

**Files to Modify:**
- `src/backend/storage/settingsDb.ts` - Add new defaults
- `src/backend/server.ts` - Add new API endpoints

**Files to Create:**
- `src/backend/services/settingsParser.ts` - Parse flat keys to structured object

### Phase 3: Enhanced Settings Panel UI

**Goal:** Build comprehensive settings interface

1. Create tabbed settings panel layout
2. Implement Services tab (URL configuration)
3. Implement Preferences tab (units, map style)
4. Implement Notifications tab (alerts configuration)
5. Implement Performance tab (tuning options)
6. Add validation and error handling
7. Add "Requires Restart" warnings

**Files to Modify:**
- `src/renderer/components/SettingsPanel.tsx` - Complete rewrite

**Files to Create:**
- `src/renderer/components/SettingsPanel.module.css` - Styles
- `src/renderer/hooks/useSettings.ts` - Settings fetch/update hook

### Phase 4: Distance Unit Integration

**Goal:** Apply distance unit preference throughout app

1. Create distance conversion utilities
2. Update aircraft list to show distances in selected unit
3. Update drone list to show distances in selected unit
4. Update detail views
5. Test with all three units

**Files to Create:**
- `src/renderer/utils/distance.ts`

**Files to Modify:**
- `src/renderer/features/aircraft/AircraftList.tsx`
- `src/renderer/features/aircraft/AircraftDetail.tsx`
- `src/renderer/features/drone/DroneList.tsx`
- `src/renderer/features/drone/DroneDetail.tsx`

### Phase 5: Map Style Configuration

**Goal:** Make map style runtime-configurable

1. Define map style options
2. Add setMapStyle method to MapPanel
3. Fetch map style from settings on init
4. Handle style changes from settings panel
5. Test all map styles

**Files to Modify:**
- `src/renderer/map/MapPanel.ts`

### Phase 6: Notification Triggers

**Goal:** Connect notifications to actual events

1. Add drone detection notifications
2. Add aircraft proximity notifications
3. Add signal status notifications
4. Add settings change confirmations
5. Test notification queue and dismissal

**Files to Modify:**
- `src/renderer/features/drone/hooks/useDrones.ts`
- `src/renderer/contexts/TelemetryContext.tsx`
- `src/renderer/components/SettingsPanel.tsx`

### Phase 7: Performance Settings Integration

**Goal:** Make performance settings functional

1. Add methods to update waterfall rows
2. Add methods to update max aircraft
3. Integrate peak detection sensitivity
4. Handle settings changes dynamically
5. Test performance impact

**Files to Modify:**
- `src/renderer/map/MapPanel.ts`
- `src/backend/sdr/peakDetector.ts`
- `src/backend/sdr/rfController.ts`

## Testing Strategy

### Unit Tests

```typescript
describe('Distance Conversion', () => {
  it('should convert meters to miles correctly', () => {
    expect(convertDistance(1609.34, 'miles')).toBeCloseTo(1, 2);
  });

  it('should convert meters to kilometers correctly', () => {
    expect(convertDistance(1000, 'kilometers')).toBe(1);
  });

  it('should convert meters to nautical miles correctly', () => {
    expect(convertDistance(1852, 'nautical')).toBeCloseTo(1, 2);
  });
});

describe('Settings Parser', () => {
  it('should parse flat settings to structured object', () => {
    const flat = {
      'services.dump1090Host': '127.0.0.1',
      'services.dump1090Port': '8080',
      'preferences.distanceUnit': 'miles'
    };
    const structured = parseSettings(flat);
    expect(structured.services.dump1090Host).toBe('127.0.0.1');
    expect(structured.preferences.distanceUnit).toBe('miles');
  });
});
```

### Integration Tests

1. **Settings Persistence:**
   - Save settings, restart app, verify persistence
   - Bulk update, verify all changes applied
   - Reset to defaults, verify all reset correctly

2. **Notification System:**
   - Trigger drone detection, verify toast appears
   - Trigger multiple notifications, verify queue
   - Disable notifications, verify no toasts

3. **Distance Units:**
   - Change unit preference, verify all displays update
   - Test with aircraft at known distances
   - Verify proximity alerts use correct units

4. **Map Styles:**
   - Change map style, verify map updates
   - Verify style persists across reloads
   - Test all available map styles

5. **Performance Settings:**
   - Change waterfall rows, verify update
   - Change max aircraft, verify limit applied
   - Change peak sensitivity, verify detection changes

### Visual Testing

- Test settings panel on different screen sizes
- Verify toast positioning in all corners
- Test map style appearance
- Verify form validation UI
- Test tab navigation

## Success Criteria

> **Status update 2026-07-21:** All phases complete. Notable fixes made while
> closing this out: the session storage mode never actually applied (writers
> used `session.storageMode` while `db.ts` read the legacy
> `session_storage_mode` key — now fixed with legacy fallback);
> `performance.telemetryUpdateInterval` was stored but never consumed (now
> drives the WebSocket broadcast cadence, restart-applied); the old
> single-setting SettingsPanel embedded in DashboardCounters was removed in
> favor of the tabbed EnhancedSettingsPanel, which gained the missing Session
> tab and client-side validation (`utils/settingsValidation.ts`).
> Remaining: visual pass in the running app.

### Settings Panel ✓
- [x] All five categories implemented (Services, Preferences, Notifications, Performance, Session)
- [x] Settings persist across app restarts
- [x] Validation prevents invalid configurations *(client-side, `settingsValidation.ts`)*
- [x] "Requires Restart" warnings shown appropriately
- [x] Reset to defaults works for each section

### Notification System ✓
- [ ] Toast component displays correctly
- [ ] Multiple toasts queue properly
- [ ] Auto-dismiss works with configurable duration
- [ ] Drone detection triggers notifications
- [ ] Aircraft proximity triggers notifications
- [ ] Signal status triggers notifications

### Distance Units ✓
- [ ] All three units (miles, km, nautical) work
- [ ] Aircraft list shows correct units
- [ ] Drone list shows correct units
- [ ] Detail views show correct units
- [ ] Proximity alerts use correct units

### Map Styles ✓
- [ ] At least 3 map styles available
- [ ] Map style changes work at runtime
- [ ] Map style preference persists
- [ ] No map rendering errors

### Performance ✓
- [ ] Waterfall rows configurable (40-200)
- [ ] Max aircraft configurable (40-200)
- [ ] Peak sensitivity configurable
- [ ] Changes apply without restart
- [ ] Performance mode still works

### Service URLs ✓
- [ ] All service URLs configurable
- [ ] Test connection validates connectivity
- [ ] Invalid URLs show errors
- [ ] Changes require restart (warning shown)

## Timeline Estimate

- **Phase 1 (Notifications):** 2-3 hours
- **Phase 2 (Data Layer):** 2-3 hours
- **Phase 3 (Settings UI):** 4-5 hours
- **Phase 4 (Distance Units):** 2 hours
- **Phase 5 (Map Styles):** 1-2 hours
- **Phase 6 (Notification Triggers):** 2 hours
- **Phase 7 (Performance):** 2 hours
- **Testing & Polish:** 2-3 hours
- **Total:** 17-23 hours

## Security Considerations

1. **Input Validation:**
   - Validate host/port format
   - Prevent script injection in text inputs
   - Range validation for numeric inputs

2. **URL Safety:**
   - Validate service URLs are HTTP/HTTPS
   - Prevent access to file:// or other protocols
   - Timeout on connection tests

3. **Settings Storage:**
   - Settings database is local-only (SQLite)
   - No sensitive data (passwords) stored
   - No remote sync (privacy)

## Future Enhancements

1. **Import/Export Settings:**
   - Export settings to JSON file
   - Import settings from JSON file
   - Share configurations between installations

2. **Profiles:**
   - Multiple setting profiles
   - Quick switch between profiles
   - Profile auto-selection based on location

3. **Advanced Performance:**
   - Auto-adjust based on system resources
   - FPS counter and performance metrics
   - Memory usage monitoring

4. **Theme Customization:**
   - Light/dark mode toggle
   - Custom color schemes
   - Font size adjustment

## References

- [MapLibre GL JS Styles](https://maplibre.org/maplibre-style-spec/)
- [OpenFreeMap Tile Servers](https://openfreemap.org/)
- [React Context Best Practices](https://react.dev/learn/passing-data-deeply-with-context)
- [Toast Notification UX](https://uxdesign.cc/toast-notification-or-dialog-box-is-that-the-question-42f5450a9ec1)
