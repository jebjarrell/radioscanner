import React from 'react';

import { ErrorBoundary } from './ErrorBoundary';
import { MapContainer } from './MapContainer';
import { SidePanel } from './SidePanel';

export const MainContent: React.FC = () => (
  <main className="main-content">
    <div className="main-content__map">
      <ErrorBoundary label="map">
        <MapContainer />
      </ErrorBoundary>
    </div>
    <aside className="main-content__side-panel">
      <ErrorBoundary label="side panel">
        <SidePanel />
      </ErrorBoundary>
    </aside>
  </main>
);
