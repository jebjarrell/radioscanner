import React from 'react';

import { useRfStream } from '../../hooks/useRfStream';

import { RfControls } from './RfControls';
import { RfSpectrum } from './RfSpectrum';
import { RfWaterfall } from './RfWaterfall';

export const RfPanel: React.FC = () => {
  const frame = useRfStream();

  return (
    <div className="rf-panel">
      <RfControls />
      <div className="rf-panel__section">
        <RfSpectrum frame={frame} />
      </div>
      <div className="rf-panel__section">
        <RfWaterfall frame={frame} />
      </div>
    </div>
  );
};
