import React from 'react';

import { MapContainer } from './MapContainer';
import { SidePanel } from './SidePanel';

export const MainContent: React.FC = () => (
  <main className="main-content">
    <div className="main-content__map">
      <MapContainer />
    </div>
    <aside className="main-content__side-panel">
      <SidePanel />
    </aside>
  </main>
);
