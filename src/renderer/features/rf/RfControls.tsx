import React, { useMemo, useState } from 'react';

import { useTelemetry } from '../../contexts/TelemetryContext';

import { RF_BANDS, type RfBandKey } from './bands';

type GainValue = 'auto' | number;

export const RfControls: React.FC = () => {
  const { telemetry } = useTelemetry();
  const rtlAvailable = telemetry?.signals?.rtlTcpConnected ?? false;

  const [band, setBand] = useState<RfBandKey>('airband');
  const [centerHz, setCenterHz] = useState<number>(RF_BANDS.airband.centerHz);
  const [sampleRate, setSampleRate] = useState<number>(RF_BANDS.airband.sampleRate);
  const [spanHz, setSpanHz] = useState<number>(RF_BANDS.airband.spanHz);
  const [gain, setGain] = useState<GainValue>('auto');
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);

  const gainOptions = useMemo(() => ['auto', 0, 10, 20, 30, 40] as Array<'auto' | number>, []);

  const applyPreset = (key: RfBandKey) => {
    setBand(key);
    const preset = RF_BANDS[key];
    setCenterHz(preset.centerHz);
    setSampleRate(preset.sampleRate);
    setSpanHz(preset.spanHz);
  };

  const start = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch('http://127.0.0.1:3000/api/scan/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          band,
          centerHz,
          sampleRate,
          spanHz,
          gain,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `start failed with status ${response.status}`);
      }
      setRunning(true);
    } catch (err) {
      console.error('[rf] failed to start scan', err);
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch('http://127.0.0.1:3000/api/scan/stop', { method: 'POST' });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `stop failed with status ${response.status}`);
      }
      setRunning(false);
    } catch (err) {
      console.error('[rf] failed to stop scan', err);
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    try {
      const res = await fetch('http://127.0.0.1:3000/api/export/csv?table=signals');
      if (!res.ok) {
        throw new Error(`export csv failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `signals_${Date.now()}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[rf] failed to export signals CSV', err);
    }
  };

  const disableStart = busy || running || !rtlAvailable;
  const disableStop = busy || !running;

  return (
    <div className="rf-controls">
      <div className="row">
        <label htmlFor="rf-band">Band</label>
        <select
          id="rf-band"
          value={band}
          onChange={(event) => applyPreset(event.target.value as RfBandKey)}
        >
          {Object.entries(RF_BANDS).map(([key, value]) => (
            <option key={key} value={key}>
              {value.label}
            </option>
          ))}
        </select>
      </div>
      <div className="row">
        <label htmlFor="rf-center">Center (Hz)</label>
        <input
          id="rf-center"
          type="number"
          value={centerHz}
          onChange={(event) => setCenterHz(Number(event.target.value))}
        />
      </div>
      <div className="row">
        <label htmlFor="rf-span">Span (Hz)</label>
        <input
          id="rf-span"
          type="number"
          value={spanHz}
          onChange={(event) => setSpanHz(Number(event.target.value))}
        />
      </div>
      <div className="row">
        <label htmlFor="rf-srate">Sample Rate (Hz)</label>
        <input
          id="rf-srate"
          type="number"
          value={sampleRate}
          onChange={(event) => setSampleRate(Number(event.target.value))}
        />
      </div>
      <div className="row">
        <label htmlFor="rf-gain">Gain</label>
        <select
          id="rf-gain"
          value={String(gain)}
          onChange={(event) => {
            const value = event.target.value;
            setGain(value === 'auto' ? 'auto' : Number(value));
          }}
        >
          {gainOptions.map((option) => (
            <option key={option} value={option}>
              {option === 'auto' ? 'Auto' : `${option} dB`}
            </option>
          ))}
        </select>
      </div>
      <div className="row">
        <button type="button" onClick={start} disabled={disableStart}>
          Start
        </button>
        <button type="button" onClick={stop} disabled={disableStop}>
          Stop
        </button>
        <button type="button" onClick={exportCsv}>
          Export CSV
        </button>
      </div>
      {!rtlAvailable && (
        <p className="rf-controls__hint">RTL-SDR service offline. Check rtl_tcp and retry.</p>
      )}
    </div>
  );
};
