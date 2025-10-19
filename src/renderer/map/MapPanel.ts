import { Map as MapLibreMap, Marker, NavigationControl } from 'maplibre-gl';

import {
  SERVICE_KEYS,
  SERVICE_LABELS,
  SERVICE_SUGGESTIONS,
  type ServiceKey,
} from '../../types/services.js';
import type { TelemetryAircraft, TelemetryFrame, TelemetryHealthSnapshot } from '../types.js';
import { WaterfallCanvas } from '../waterfall/WaterfallCanvas.js';

type LayerKey = 'aircraft' | 'drones' | 'signals' | 'waterfall';
type DependencyMode = 'all' | 'rfOnly' | 'localizeOnly' | 'offlineDemo';

const MAP_STYLE_URL = 'https://demotiles.maplibre.org/style.json';
const MAP_DEFAULT_CENTER: [number, number] = [-73.935242, 40.73061];
const DEFAULT_ZOOM = 9.5;

const DEFAULT_WATERFALL_ROWS = 100;
const PERFORMANCE_WATERFALL_ROWS = 40;
const DEFAULT_AIRCRAFT_LIMIT = 200;
const PERFORMANCE_AIRCRAFT_LIMIT = 40;

const LAYER_LABELS: Record<LayerKey, string> = {
  aircraft: 'Aircraft',
  drones: 'Remote ID',
  signals: 'Signal status',
  waterfall: 'RF waterfall',
};

const LAYER_DEPENDENCIES: Record<LayerKey, ServiceKey[]> = {
  aircraft: ['dump1090'],
  drones: ['kismet', 'gps'],
  signals: ['rtlTcp', 'gps'],
  waterfall: ['rtlTcp'],
};

const MODE_DEFINITIONS: Array<{
  id: DependencyMode;
  label: string;
  description: string;
  required: ServiceKey[];
}> = [
  {
    id: 'all',
    label: 'All Services',
    description: 'All telemetry layers and localization features.',
    required: ['rtlTcp', 'dump1090', 'kismet', 'gps'],
  },
  {
    id: 'rfOnly',
    label: 'RF-only',
    description: 'Waterfall + ADS-B feeds without localization.',
    required: ['rtlTcp', 'dump1090'],
  },
  {
    id: 'localizeOnly',
    label: 'Localize-only',
    description: 'Remote ID and GPS fallback without RF feeds.',
    required: ['kismet', 'gps'],
  },
  {
    id: 'offlineDemo',
    label: 'Offline Demo',
    description: 'UI walkthrough without live services.',
    required: [],
  },
];

type ServiceAvailabilityMap = Record<ServiceKey, boolean>;

interface StatusEntry {
  root: HTMLDivElement;
  indicator: HTMLSpanElement;
  value: HTMLSpanElement;
  lastSeen: HTMLSpanElement;
  retry: HTMLButtonElement;
}

interface LayerOverlay {
  root: HTMLDivElement;
  stack: HTMLDivElement;
}

interface OverlayMessage {
  layer: LayerKey;
  missing: ServiceKey[];
}

interface MatrixRow {
  row: HTMLTableRowElement;
  status: HTMLSpanElement;
  detail: HTMLDivElement;
  cells: Record<ServiceKey, HTMLSpanElement>;
}

interface MapPanelOptions {
  version: string;
  onAircraftClick?: (icao: string) => void;
}

export class MapPanel {
  private readonly root: HTMLElement;
  private readonly panel: HTMLDivElement;
  private readonly header: HTMLDivElement;
  private readonly controls: HTMLDivElement;
  private readonly mapContainer: HTMLDivElement;
  private readonly waterfallContainer: HTMLDivElement;
  private readonly statusBar: HTMLDivElement;
  private readonly telemetryBadge: HTMLSpanElement;
  private readonly versionBadge: HTMLSpanElement;

  private readonly layerInputs: Record<LayerKey, HTMLInputElement>;
  private readonly layerState: Record<LayerKey, boolean>;

  private readonly performanceToggle: HTMLInputElement;

  private readonly waterfall: WaterfallCanvas;
  private readonly map: MapLibreMap;

  private readonly statusEntries: Record<ServiceKey, StatusEntry>;
  private readonly statusTimer: number;

  private readonly overlays: {
    map: LayerOverlay;
    waterfall: LayerOverlay;
  };

  private readonly matrixContainer: HTMLDivElement;
  private readonly matrixRows: Record<DependencyMode, MatrixRow>;

  private readonly retryResetTimers = new Map<ServiceKey, number>();
  private readonly onAircraftClick?: (icao: string) => void;

  private latestFrame: TelemetryFrame | null = null;
  private performanceMode = false;
  private serviceAvailability: ServiceAvailabilityMap = {
    rtlTcp: false,
    dump1090: false,
    kismet: false,
    gps: false,
  };

  private aircraftMarkers = new Map<string, Marker>();
  private droneMarker: Marker | null = null;
  private signalMarkers: { rtl: Marker; gps: Marker } | null = null;

  constructor(root: HTMLElement, options: MapPanelOptions) {
    this.root = root;
    this.root.classList.add('app-shell');
    this.onAircraftClick = options.onAircraftClick;

    this.panel = document.createElement('div');
    this.panel.className = 'map-panel';
    this.root.append(this.panel);

    this.header = document.createElement('div');
    this.header.className = 'map-panel__header';
    this.panel.append(this.header);

    const titleGroup = document.createElement('div');
    titleGroup.className = 'map-panel__title';
    this.header.append(titleGroup);

    const title = document.createElement('h1');
    title.textContent = 'OnTheGo Scanner';
    titleGroup.append(title);

    const version = document.createElement('span');
    version.className = 'map-panel__version';
    version.textContent = `v${options.version}`;
    titleGroup.append(version);
    this.versionBadge = version;

    this.telemetryBadge = document.createElement('span');
    this.telemetryBadge.className = 'map-panel__telemetry map-panel__telemetry--disconnected';
    this.telemetryBadge.textContent = 'Telemetry: offline';
    this.header.append(this.telemetryBadge);

    this.controls = document.createElement('div');
    this.controls.className = 'map-panel__controls';
    this.header.append(this.controls);

    this.layerState = {
      aircraft: true,
      drones: true,
      signals: true,
      waterfall: true,
    };

    this.layerInputs = {
      aircraft: this.createLayerToggle('aircraft', 'Aircraft'),
      drones: this.createLayerToggle('drones', 'Drones'),
      signals: this.createLayerToggle('signals', 'Signals'),
      waterfall: this.createLayerToggle('waterfall', 'Waterfall'),
    };

    this.performanceToggle = this.createPerformanceToggle();

    const body = document.createElement('div');
    body.className = 'map-panel__body';
    this.panel.append(body);

    this.mapContainer = document.createElement('div');
    this.mapContainer.className = 'map-panel__map';
    body.append(this.mapContainer);

    this.waterfallContainer = document.createElement('div');
    this.waterfallContainer.className = 'map-panel__waterfall';
    body.append(this.waterfallContainer);

    const waterfallCanvasEl = document.createElement('canvas');
    waterfallCanvasEl.className = 'waterfall-canvas';
    this.waterfallContainer.append(waterfallCanvasEl);
    this.waterfall = new WaterfallCanvas(waterfallCanvasEl, { maxRows: DEFAULT_WATERFALL_ROWS });

    this.map = this.createMap();

    this.overlays = {
      map: this.createLayerOverlay(this.mapContainer),
      waterfall: this.createLayerOverlay(this.waterfallContainer),
    };

    this.matrixContainer = this.createDependencyMatrix();
    this.panel.append(this.matrixContainer);

    this.statusBar = document.createElement('div');
    this.statusBar.className = 'status-bar';
    this.panel.append(this.statusBar);

    this.statusEntries = {
      rtlTcp: this.createStatusEntry('rtlTcp'),
      dump1090: this.createStatusEntry('dump1090'),
      kismet: this.createStatusEntry('kismet'),
      gps: this.createStatusEntry('gps'),
    };

    this.statusTimer = window.setInterval(() => {
      this.refreshStatusBar();
    }, 1000);

    this.matrixRows = this.initMatrixRows();
    this.refreshStatusBar();
  }

  public dispose(): void {
    this.map.remove();
    window.clearInterval(this.statusTimer);
    this.waterfall.terminate();
    this.clearAircraftMarkers();
    this.removeDroneMarker();
    this.removeSignalMarkers();
    this.retryResetTimers.forEach((timer) => window.clearTimeout(timer));
    this.retryResetTimers.clear();
    // Remove the panel we appended to the container to avoid duplicates on remount
    try {
      this.panel.remove();
    } catch {}
    // Best-effort: if we added styling class to the host container, keep it but
    // React StrictMode will remount cleanly and we won't duplicate the DOM now.
  }

  public updateTelemetry(frame: TelemetryFrame): void {
    this.latestFrame = frame;
    this.refreshLayers();
    this.refreshStatusBar();
  }

  public setTelemetryConnected(connected: boolean): void {
    this.telemetryBadge.classList.toggle('map-panel__telemetry--connected', connected);
    this.telemetryBadge.classList.toggle('map-panel__telemetry--disconnected', !connected);
    this.telemetryBadge.textContent = connected ? 'Telemetry: streaming' : 'Telemetry: offline';

    if (!connected) {
      this.latestFrame = null;
      this.refreshLayers();
      this.refreshStatusBar();
    }
  }

  public setVersion(version: string): void {
    this.versionBadge.textContent = `v${version}`;
  }

  public isLayerEnabled(layer: LayerKey): boolean {
    return this.layerState[layer];
  }

  public pushWaterfallRow(row: Float32Array): void {
    if (!this.layerState.waterfall) {
      return;
    }
    this.waterfall.pushRow(row);
  }

  private createMap(): MapLibreMap {
    const map = new MapLibreMap({
      container: this.mapContainer,
      style: MAP_STYLE_URL,
      center: MAP_DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
    });
    map.addControl(new NavigationControl({ showZoom: true, showCompass: true }), 'top-right');
    return map;
  }

  private createLayerToggle(layer: LayerKey, label: string): HTMLInputElement {
    const wrapper = document.createElement('label');
    wrapper.className = 'layer-toggle';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = true;
    input.dataset.layer = layer;

    const span = document.createElement('span');
    span.textContent = label;

    wrapper.append(input, span);
    this.controls.append(wrapper);

    input.addEventListener('change', () => {
      this.handleLayerToggle(layer, input.checked);
    });

    return input;
  }

  private createPerformanceToggle(): HTMLInputElement {
    const wrapper = document.createElement('label');
    wrapper.className = 'layer-toggle layer-toggle--performance';

    const input = document.createElement('input');
    input.type = 'checkbox';

    const span = document.createElement('span');
    span.textContent = 'Performance Mode';

    wrapper.append(input, span);
    this.controls.append(wrapper);

    input.addEventListener('change', () => {
      this.performanceMode = input.checked;
      this.applyPerformanceMode();
    });

    return input;
  }

  private createStatusEntry(key: ServiceKey): StatusEntry {
    const entry = document.createElement('div');
    entry.className = 'status-bar__entry';

    const label = document.createElement('span');
    label.className = 'status-bar__label';
    label.textContent = SERVICE_LABELS[key];

    const indicator = document.createElement('span');
    indicator.className = 'status-bar__indicator status-bar__indicator--offline';

    const value = document.createElement('span');
    value.className = 'status-bar__value';
    value.textContent = '—';

    const lastSeen = document.createElement('span');
    lastSeen.className = 'status-bar__last';
    lastSeen.textContent = 'Last seen: —';

    const retry = document.createElement('button');
    retry.className = 'status-bar__retry';
    retry.type = 'button';
    retry.textContent = 'Retry';
    retry.dataset.state = 'idle';
    retry.hidden = true;
    retry.addEventListener('click', () => {
      void this.handleRetry(key);
    });

    entry.append(label, indicator, value, lastSeen, retry);
    this.statusBar.append(entry);

    return { root: entry, indicator, value, lastSeen, retry };
  }

  private createLayerOverlay(container: HTMLElement): LayerOverlay {
    container.classList.add('layer-container');
    const overlay = document.createElement('div');
    overlay.className = 'layer-overlay';

    const stack = document.createElement('div');
    stack.className = 'layer-overlay__stack';
    overlay.append(stack);

    container.append(overlay);
    return { root: overlay as HTMLDivElement, stack: stack as HTMLDivElement };
  }

  private createDependencyMatrix(): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'dependency-matrix';

    const title = document.createElement('div');
    title.className = 'dependency-matrix__title';
    title.textContent = 'Dependency Matrix';
    container.append(title);

    const table = document.createElement('table');
    table.className = 'dependency-matrix__table';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');

    const modeHeader = document.createElement('th');
    modeHeader.scope = 'col';
    modeHeader.textContent = 'Mode';
    headRow.append(modeHeader);

    SERVICE_KEYS.forEach((service) => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = SERVICE_LABELS[service];
      headRow.append(th);
    });

    const statusHeader = document.createElement('th');
    statusHeader.scope = 'col';
    statusHeader.textContent = 'Status';
    headRow.append(statusHeader);

    thead.append(headRow);
    table.append(thead);

    const tbody = document.createElement('tbody');

    MODE_DEFINITIONS.forEach((mode) => {
      const row = document.createElement('tr');

      const modeCell = document.createElement('th');
      modeCell.scope = 'row';
      modeCell.className = 'dependency-matrix__mode';
      modeCell.innerHTML = `<span>${mode.label}</span><small>${mode.description}</small>`;
      row.append(modeCell);

      SERVICE_KEYS.forEach((service) => {
        const cell = document.createElement('td');
        cell.className = 'dependency-matrix__cell';
        cell.dataset.service = service;
        const badge = document.createElement('span');
        badge.className = 'dependency-matrix__badge';
        badge.textContent = '—';
        cell.append(badge);
        row.append(cell);
      });

      const statusCell = document.createElement('td');
      statusCell.className = 'dependency-matrix__status-cell';
      const status = document.createElement('span');
      status.className = 'dependency-matrix__status';
      status.textContent = 'Unavailable';
      const detail = document.createElement('div');
      detail.className = 'dependency-matrix__detail';
      detail.textContent = 'No telemetry';
      statusCell.append(status, detail);
      row.append(statusCell);

      tbody.append(row);
    });

    table.append(tbody);
    container.append(table);

    return container;
  }

  private initMatrixRows(): Record<DependencyMode, MatrixRow> {
    const rows: Partial<Record<DependencyMode, MatrixRow>> = {};
    const table = this.matrixContainer.querySelector<HTMLTableElement>('.dependency-matrix__table');
    const bodyRows = table?.tBodies[0]?.rows;
    if (!table || !bodyRows) {
      throw new Error('Dependency matrix table not initialized correctly.');
    }

    MODE_DEFINITIONS.forEach((mode, index) => {
      const row = bodyRows[index];
      const statusCell = row.querySelector<HTMLTableCellElement>('.dependency-matrix__status-cell');
      if (!statusCell) {
        throw new Error(`Status cell missing for matrix row ${mode.id}`);
      }
      const status = statusCell.querySelector<HTMLSpanElement>('.dependency-matrix__status');
      const detail = statusCell.querySelector<HTMLDivElement>('.dependency-matrix__detail');
      if (!status || !detail) {
        throw new Error(`Status elements missing for matrix row ${mode.id}`);
      }
      const cellMap: Record<ServiceKey, HTMLSpanElement> = {
        rtlTcp: this.requireBadge(row, 'rtlTcp'),
        dump1090: this.requireBadge(row, 'dump1090'),
        kismet: this.requireBadge(row, 'kismet'),
        gps: this.requireBadge(row, 'gps'),
      };

      rows[mode.id] = { row, status, detail, cells: cellMap };
    });

    return rows as Record<DependencyMode, MatrixRow>;
  }

  private requireBadge(row: HTMLTableRowElement, service: ServiceKey): HTMLSpanElement {
    const cell = row.querySelector<HTMLTableCellElement>(
      `.dependency-matrix__cell[data-service="${service}"]`,
    );
    if (!cell) {
      throw new Error(`Matrix cell missing for service ${service}`);
    }
    const badge = cell.querySelector<HTMLSpanElement>('.dependency-matrix__badge');
    if (!badge) {
      throw new Error(`Matrix badge missing for service ${service}`);
    }
    return badge;
  }

  private handleLayerToggle(layer: LayerKey, enabled: boolean): void {
    this.layerState[layer] = enabled;
    if (layer === 'waterfall') {
      this.waterfallContainer.classList.toggle('map-panel__waterfall--hidden', !enabled);
    }
    this.refreshLayers();
  }

  private applyPerformanceMode(): void {
    const maxRows = this.performanceMode ? PERFORMANCE_WATERFALL_ROWS : DEFAULT_WATERFALL_ROWS;
    this.waterfall.setMaxRows(maxRows);
    this.panel.classList.toggle('map-panel--performance', this.performanceMode);
    this.refreshLayers();
  }

  private refreshLayers(): void {
    if (this.layerState.aircraft) {
      this.renderAircraftMarkers();
    } else {
      this.clearAircraftMarkers();
    }

    if (this.layerState.drones) {
      this.renderDroneMarker();
    } else {
      this.removeDroneMarker();
    }

    if (this.layerState.signals) {
      this.renderSignalMarkers();
    } else {
      this.removeSignalMarkers();
    }
  }

  private renderAircraftMarkers(): void {
    if (!this.latestFrame) {
      this.clearAircraftMarkers();
      return;
    }

    const { aircraft } = this.latestFrame;
    const limit = this.performanceMode ? PERFORMANCE_AIRCRAFT_LIMIT : DEFAULT_AIRCRAFT_LIMIT;
    const filtered = this.filterAircraft(aircraft, limit);
    const active = new Set<string>();

    filtered.forEach((plane) => {
      const id = plane.hex.toUpperCase();
      active.add(id);

      const position: [number, number] = [plane.lon!, plane.lat!];
      let marker = this.aircraftMarkers.get(id);
      if (!marker) {
        const element = document.createElement('div');
        element.className = 'map-marker map-marker--aircraft';
        element.title = this.formatAircraftTitle(plane);
        element.addEventListener('click', () => {
          this.onAircraftClick?.(id);
        });
        marker = new Marker({
          element,
          anchor: 'center',
        })
          .setLngLat(position)
          .addTo(this.map);
        this.aircraftMarkers.set(id, marker);
      } else {
        marker.getElement().title = this.formatAircraftTitle(plane);
        marker.setLngLat(position);
      }
    });

    this.aircraftMarkers.forEach((marker, id) => {
      if (!active.has(id)) {
        marker.remove();
        this.aircraftMarkers.delete(id);
      }
    });
  }

  private clearAircraftMarkers(): void {
    this.aircraftMarkers.forEach((marker) => marker.remove());
    this.aircraftMarkers.clear();
  }

  private renderDroneMarker(): void {
    if (!this.latestFrame) {
      this.removeDroneMarker();
      return;
    }

    const { drone, health } = this.latestFrame;
    const coords = this.getGpsCoordinates();
    if (!coords) {
      this.removeDroneMarker();
      return;
    }

    if (!this.droneMarker) {
      const element = document.createElement('div');
      element.className = 'map-marker map-marker--drone';
      this.droneMarker = new Marker({ element, anchor: 'bottom' })
        .setLngLat(coords)
        .addTo(this.map);
    } else {
      this.droneMarker.setLngLat(coords);
    }

    const element = this.droneMarker.getElement();
    element.classList.toggle('map-marker--active', drone.ridAvailable);
    element.classList.toggle('map-marker--inactive', !drone.ridAvailable);
    element.title = drone.ridAvailable ? 'Remote ID sources available' : 'Remote ID unavailable';

    if (health.gps.lastFix) {
      const { lat, lon, timestamp } = health.gps.lastFix;
      element.dataset.lat = lat.toFixed(4);
      element.dataset.lon = lon.toFixed(4);
      element.dataset.timestamp = timestamp.toString();
    }
  }

  private removeDroneMarker(): void {
    if (this.droneMarker) {
      this.droneMarker.remove();
      this.droneMarker = null;
    }
  }

  private renderSignalMarkers(): void {
    if (!this.latestFrame) {
      this.removeSignalMarkers();
      return;
    }

    const center = this.map.getCenter();
    const rtlPosition: [number, number] = [center.lng - 0.05, center.lat - 0.02];
    const gpsPosition: [number, number] = [center.lng + 0.05, center.lat - 0.02];

    if (!this.signalMarkers) {
      const rtlElement = document.createElement('div');
      rtlElement.className = 'map-marker map-marker--signal';
      rtlElement.dataset.type = 'rtl';

      const gpsElement = document.createElement('div');
      gpsElement.className = 'map-marker map-marker--signal';
      gpsElement.dataset.type = 'gps';

      this.signalMarkers = {
        rtl: new Marker({ element: rtlElement, anchor: 'center' })
          .setLngLat(rtlPosition)
          .addTo(this.map),
        gps: new Marker({ element: gpsElement, anchor: 'center' })
          .setLngLat(gpsPosition)
          .addTo(this.map),
      };
    } else {
      this.signalMarkers.rtl.setLngLat(rtlPosition);
      this.signalMarkers.gps.setLngLat(gpsPosition);
    }

    const rtlElement = this.signalMarkers.rtl.getElement();
    rtlElement.classList.toggle('map-marker--active', this.latestFrame.signals.rtlTcpConnected);
    rtlElement.classList.toggle('map-marker--inactive', !this.latestFrame.signals.rtlTcpConnected);
    rtlElement.title = this.latestFrame.signals.rtlTcpConnected
      ? 'RTL-SDR connected'
      : 'RTL-SDR offline';

    const gpsElement = this.signalMarkers.gps.getElement();
    gpsElement.classList.toggle('map-marker--active', this.latestFrame.signals.gpsConnected);
    gpsElement.classList.toggle('map-marker--inactive', !this.latestFrame.signals.gpsConnected);
    gpsElement.title = this.latestFrame.signals.gpsConnected ? 'GPS lock' : 'GPS offline';
  }

  private removeSignalMarkers(): void {
    if (!this.signalMarkers) {
      return;
    }
    this.signalMarkers.rtl.remove();
    this.signalMarkers.gps.remove();
    this.signalMarkers = null;
  }

  private refreshStatusBar(): void {
    const frame = this.latestFrame;
    const availability = this.computeServiceAvailability(frame?.health ?? null);
    this.serviceAvailability = availability;

    if (!frame) {
      Object.entries(this.statusEntries).forEach(([service, entry]) => {
        entry.indicator.classList.remove('status-bar__indicator--online');
        entry.indicator.classList.add('status-bar__indicator--offline');
        entry.value.textContent = '—';
        entry.lastSeen.textContent = 'Last seen: —';
        this.ensureRetryVisible(service as ServiceKey, true);
        if (entry.retry.dataset.state === 'idle') {
          this.resetRetryButton(service as ServiceKey);
        }
      });
      this.updateLayerAvailability(availability);
      this.updateDependencyMatrix(availability);
      return;
    }

    const { health } = frame;
    this.updateStatusEntry('rtlTcp', {
      online: health.rtlTcp.connected,
      value: health.rtlTcp.connected ? 'Connected' : 'Offline',
      lastSeenMs: health.rtlTcp.lastConnectedAt ?? health.timestamp,
    });

    this.updateStatusEntry('dump1090', {
      online: health.dump1090.healthy,
      value: health.dump1090.healthy ? 'Healthy' : 'Degraded',
      lastSeenMs: health.dump1090.lastUpdated ?? null,
    });

    this.updateStatusEntry('kismet', {
      online: health.kismet.available,
      value: health.kismet.available ? 'Available' : 'Unavailable',
      lastSeenMs: health.kismet.lastChecked ?? null,
    });

    const gpsLast = health.gps.lastFix?.timestamp ?? health.gps.lastChecked ?? null;
    this.updateStatusEntry('gps', {
      online: health.gps.connected,
      value: health.gps.connected ? 'Locked' : 'No Fix',
      lastSeenMs: gpsLast,
    });

    this.updateLayerAvailability(availability);
    this.updateDependencyMatrix(availability);
  }

  private computeServiceAvailability(
    health: TelemetryHealthSnapshot | null,
  ): ServiceAvailabilityMap {
    return {
      rtlTcp: Boolean(health?.rtlTcp.connected),
      dump1090: Boolean(health?.dump1090.healthy),
      kismet: Boolean(health?.kismet.available),
      gps: Boolean(health?.gps.connected),
    };
  }

  private updateLayerAvailability(availability: ServiceAvailabilityMap): void {
    const mapMessages: OverlayMessage[] = [];
    const waterfallMessages: OverlayMessage[] = [];

    (Object.keys(LAYER_DEPENDENCIES) as LayerKey[]).forEach((layer) => {
      const dependencies = LAYER_DEPENDENCIES[layer];
      const missing = dependencies.filter((service) => !availability[service]);
      const input = this.layerInputs[layer];
      const toggleWrapper = input.parentElement as HTMLLabelElement | null;
      if (toggleWrapper) {
        toggleWrapper.classList.toggle('layer-toggle--unavailable', missing.length > 0);
      }

      if (missing.length === 0) {
        return;
      }

      const message: OverlayMessage = { layer, missing };
      if (layer === 'waterfall') {
        waterfallMessages.push(message);
      } else {
        mapMessages.push(message);
      }
    });

    this.applyOverlay(this.overlays.map, this.mapContainer, mapMessages);
    this.applyOverlay(this.overlays.waterfall, this.waterfallContainer, waterfallMessages);
  }

  private applyOverlay(
    overlay: LayerOverlay,
    container: HTMLElement,
    messages: OverlayMessage[],
  ): void {
    overlay.stack.innerHTML = '';
    if (messages.length === 0) {
      overlay.root.classList.remove('layer-overlay--visible');
      container.classList.remove('layer-container--unavailable');
      return;
    }

    container.classList.add('layer-container--unavailable');
    overlay.root.classList.add('layer-overlay--visible');

    messages.forEach((message) => {
      const card = document.createElement('div');
      card.className = 'layer-overlay__card';

      const title = document.createElement('div');
      title.className = 'layer-overlay__title';
      title.textContent = `${LAYER_LABELS[message.layer]} feature unavailable`;

      const subtitle = document.createElement('div');
      subtitle.className = 'layer-overlay__subtitle';
      subtitle.textContent = 'Suggested actions:';

      const list = document.createElement('ul');
      list.className = 'layer-overlay__suggestions';

      message.missing.forEach((service) => {
        const suggestion = document.createElement('li');
        const strong = document.createElement('strong');
        strong.textContent = SERVICE_LABELS[service];
        const text = document.createElement('span');
        text.textContent = ` — ${SERVICE_SUGGESTIONS[service]}`;
        suggestion.append(strong, text);
        list.append(suggestion);
      });

      card.append(title, subtitle, list);
      overlay.stack.append(card);
    });
  }

  private updateDependencyMatrix(availability: ServiceAvailabilityMap): void {
    MODE_DEFINITIONS.forEach((mode) => {
      const row = this.matrixRows[mode.id];
      const missing = mode.required.filter((service) => !availability[service]);
      const ready = missing.length === 0;
      row.status.textContent = ready ? 'Ready' : 'Unavailable';
      row.status.classList.toggle('dependency-matrix__status--ok', ready);
      row.status.classList.toggle('dependency-matrix__status--warn', !ready);
      row.row.classList.toggle('dependency-matrix__row--ready', ready);
      row.row.classList.toggle('dependency-matrix__row--missing', !ready);

      if (mode.required.length === 0) {
        row.detail.textContent = 'No dependencies required';
      } else if (ready) {
        row.detail.textContent = 'All dependencies satisfied';
      } else {
        row.detail.textContent = `Missing: ${missing
          .map((service) => SERVICE_LABELS[service])
          .join(', ')}`;
      }

      SERVICE_KEYS.forEach((service) => {
        const badge = row.cells[service];
        const required = mode.required.includes(service);
        const available = availability[service];

        badge.classList.toggle('dependency-matrix__badge--required', required);
        badge.classList.toggle('dependency-matrix__badge--optional', !required);
        badge.classList.toggle('dependency-matrix__badge--ok', required && available);
        badge.classList.toggle('dependency-matrix__badge--missing', required && !available);
        badge.textContent = required ? (available ? '✓' : '✕') : '—';
        badge.title = required
          ? `${SERVICE_LABELS[service]} ${available ? 'available' : 'missing'}`
          : `${SERVICE_LABELS[service]} not required`;
      });
    });
  }

  private updateStatusEntry(
    key: ServiceKey,
    data: { online: boolean; value: string; lastSeenMs: number | null },
  ): void {
    const entry = this.statusEntries[key];
    entry.indicator.classList.toggle('status-bar__indicator--online', data.online);
    entry.indicator.classList.toggle('status-bar__indicator--offline', !data.online);
    entry.value.textContent = data.value;
    entry.lastSeen.textContent = `Last seen: ${this.formatLastSeen(data.lastSeenMs)}`;

    if (data.online) {
      this.ensureRetryVisible(key, false);
    } else {
      this.ensureRetryVisible(key, true);
      if (entry.retry.dataset.state === 'idle') {
        this.resetRetryButton(key);
      }
    }
  }

  private ensureRetryVisible(service: ServiceKey, visible: boolean): void {
    const button = this.statusEntries[service].retry;
    button.hidden = !visible;
    button.classList.toggle('status-bar__retry--hidden', !visible);
  }

  private resetRetryButton(service: ServiceKey): void {
    const button = this.statusEntries[service].retry;
    const timer = this.retryResetTimers.get(service);
    if (timer) {
      window.clearTimeout(timer);
      this.retryResetTimers.delete(service);
    }
    button.disabled = false;
    button.textContent = 'Retry';
    button.dataset.state = 'idle';
  }

  private async handleRetry(service: ServiceKey): Promise<void> {
    const entry = this.statusEntries[service];
    const button = entry.retry;
    if (button.disabled) {
      return;
    }
    const timer = this.retryResetTimers.get(service);
    if (timer) {
      window.clearTimeout(timer);
      this.retryResetTimers.delete(service);
    }
    button.disabled = true;
    button.dataset.state = 'busy';
    button.textContent = 'Retrying…';

    try {
      const success = await window.onthego.retryService(service);
      button.textContent = success ? 'Retry sent' : 'Retry failed';
      button.dataset.state = success ? 'cooldown' : 'error';
    } catch (err) {
      console.error(`Retry request failed for ${service}`, err);
      button.textContent = 'Retry failed';
      button.dataset.state = 'error';
    }

    const resetTimer = window.setTimeout(() => {
      this.resetRetryButton(service);
    }, 2000);
    this.retryResetTimers.set(service, resetTimer);
  }

  private formatLastSeen(timestamp: number | null): string {
    if (!timestamp) {
      return '—';
    }
    const deltaMs = Date.now() - timestamp;
    if (deltaMs < 0) {
      return '0s';
    }
    const seconds = Math.floor(deltaMs / 1000);
    if (seconds <= 0) {
      return 'now';
    }
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    return `${hours}h`;
  }

  private filterAircraft(entries: TelemetryAircraft[], limit: number): TelemetryAircraft[] {
    const filtered: TelemetryAircraft[] = [];
    for (const aircraft of entries) {
      if (typeof aircraft.lat === 'number' && typeof aircraft.lon === 'number') {
        filtered.push(aircraft);
        if (filtered.length >= limit) {
          break;
        }
      }
    }
    return filtered;
  }

  private formatAircraftTitle(plane: TelemetryAircraft): string {
    const label = plane.flight ? plane.flight.trim() : plane.hex;
    const altitude = typeof plane.alt_baro === 'number' ? `${plane.alt_baro} ft` : 'n/a';
    const seen = typeof plane.seen === 'number' ? `${plane.seen}s ago` : 'n/a';
    return `${label}\nAlt: ${altitude}\nSeen: ${seen}`;
  }

  private getGpsCoordinates(): [number, number] | null {
    const frame = this.latestFrame;
    if (!frame) {
      return null;
    }
    const fix = frame.health.gps.lastFix;
    if (fix && typeof fix.lat === 'number' && typeof fix.lon === 'number') {
      return [fix.lon, fix.lat];
    }
    return MAP_DEFAULT_CENTER;
  }
}
