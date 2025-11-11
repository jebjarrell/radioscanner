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
