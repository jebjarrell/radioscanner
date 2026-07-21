import React from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';

const root = document.querySelector<HTMLDivElement>('#app');

if (root) {
  const app = createRoot(root);
  app.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

// Register Service Worker for offline caching
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
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
