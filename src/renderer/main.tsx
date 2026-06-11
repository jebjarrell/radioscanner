import React from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';

const root = document.querySelector<HTMLDivElement>('#app');

if (root) {
  const app = createRoot(root);
  app.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  );
}

// Register Service Worker for offline caching.
//
// Only register for production builds served over http(s). The service worker
// is skipped when:
//   - running under `vite dev` (import.meta.env.DEV) so it never interferes
//     with HMR or the test environment;
//   - the page is loaded from `file://` (packaged Electron uses loadFile), where
//     service workers cannot register and are unnecessary because all static
//     assets already load directly from local disk.
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./service-worker.js')
      .then((registration) => {
        console.log('[App] ServiceWorker registered:', registration.scope);

        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60000); // Check every minute
      })
      .catch((error) => {
        console.error('[App] ServiceWorker registration failed:', error);
      });
  });
}
