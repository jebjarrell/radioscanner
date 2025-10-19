import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';

import { MapPanel } from './map/MapPanel.js';
import { connectWS } from './services/wsReconnect.js';
import type { TelemetryFrame } from './types.js';

const TELEMETRY_URL = 'ws://127.0.0.1:3000/ws';

const root = document.querySelector<HTMLDivElement>('#app');

const bootstrap = async () => {
  if (!root) {
    return;
  }

  root.innerHTML = '';

  const version = await window.onthego.getVersion();
  const mapPanel = new MapPanel(root, { version });

  const stop = connectWS(
    TELEMETRY_URL,
    {
      onOpen: () => mapPanel.setTelemetryConnected(true),
      onClose: () => mapPanel.setTelemetryConnected(false),
      onError: () => mapPanel.setTelemetryConnected(false),
      onMessage: (event) => {
        try {
          const payload =
            typeof event.data === 'string'
              ? event.data
              : typeof event.data === 'object' && event.data instanceof ArrayBuffer
                ? new TextDecoder().decode(event.data)
                : null;
          if (!payload) {
            return;
          }
          const frame = JSON.parse(payload) as TelemetryFrame;
          mapPanel.updateTelemetry(frame);
        } catch (err) {
          console.error('Failed to parse telemetry frame', err);
        }
      },
    },
    {
      initialDelayMs: 1000,
      maxDelayMs: 15000,
      randomJitterMs: 500,
    },
  );

  window.addEventListener('beforeunload', () => {
    stop();
    mapPanel.dispose();
  });
};

void bootstrap();
