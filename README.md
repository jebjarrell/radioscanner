# OnTheGo Scanner

OnTheGo Scanner couples an Electron shell with a Vite/TypeScript renderer to visualize RF and telemetry health on a single map panel. The desktop app orchestrates four backend services, streams consolidated status over WebSockets, and surfaces actionable controls (dependency matrix, retry buttons, waterfall) in the renderer.

## Services at a Glance

| Service | Purpose | Default Endpoint |
| --- | --- | --- |
| RTL-SDR (`rtlTcp`) | Raw IQ capture that drives the RF waterfall and signal status. | `rtl_tcp` on `127.0.0.1:1234` |
| ADS-B (`dump1090`) | Aircraft positions and metadata rendered on the map. | `http://127.0.0.1:8080/data/aircraft.json` |
| Remote ID (`kismet`) | RID availability and drone presence. | `http://127.0.0.1:2501/system/status.json` |
| GPS (`gps`) | Fix data for localization, fallbacks, and signal health. | `gpsd` on `127.0.0.1:2947` |

The renderer dependency matrix (All Services / RF-only / Localize-only / Offline Demo) greys out layers when the required services are unavailable, and every service row exposes an in-app **Retry** action that proxies `HealthMonitor.retry()`.

## Security Defaults

- `contextIsolation: true`, `nodeIntegration: false`, and an allow-listed preload API (`onthego.getVersion`, `onthego.retryService`).
- Browser windows enforce a strict Content Security Policy and deny new window creation unless routed through `shell.openExternal`.
- WebSocket telemetry binds to `127.0.0.1` and no remote code paths are exposed outside the known service ports.
- Health monitor errors stay internal unless you opt into development logging.

## Mock Mode

Set `USE_MOCK_DATA=1` (or `true/yes/on`) before launching the app to swap in mock clients for all four services. Mock mode drives deterministic snapshots, exercises the dependency matrix, and avoids live hardware requirements. The main process echoes an info banner when mock data is active, and the renderer remains fully interactive.

## Build, Package, and Tooling

- `npm install` (installs dependencies, including `electron-builder` for AppImage output).
- `npm run dev` (Vite + Electron watch mode).
- `npm run build` (lint ➜ typecheck ➜ Vite production build ➜ Linux AppImage). Packages land in `dist/installers/` and are copied to `dist/` (e.g. `dist/onthego-scanner-0.1.0-x64.AppImage`).
- Diagnostics and investigation helpers: `npm run doctor`, `npm run mock`, `npm run perf`, `npm run lint`, `npm run typecheck`.

## Troubleshooting

| Service | Symptoms | Quick Checks |
| --- | --- | --- |
| RTL-SDR | Waterfall/signal tiles greyed out, no RF markers. | Ensure `rtl_tcp` is listening on `127.0.0.1:1234` and the dongle is powered. |
| ADS-B | Aircraft layer disabled or stuck. | Confirm `dump1090` serves `/data/aircraft.json` on `127.0.0.1:8080`. |
| Remote ID | RID overlay missing, drone badge unavailable. | Start Kismet, confirm Remote ID capture is enabled (`127.0.0.1:2501`). |
| GPS | Dependency matrix blocks localization, GPS icon grey. | Verify `gpsd` on `127.0.0.1:2947` with sky view, or configure manual fallback. |

When in doubt, use the in-app **Retry** buttons per service and monitor the telemetry badge for reconnection state.

## Opening a Saved Session

You can persist the in-memory session database before quitting. Choose **Save & Quit** when prompted on exit, then relaunch with the saved file:

```bash
SESSION_DB_FILE=/full/path/to/session.sqlite npm run dev
```

The app will reuse that database for telemetry history, RF peaks, and drone records until you switch back to the default in-memory mode.
