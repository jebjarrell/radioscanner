import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom';

import styles from './ExportDialog.module.css';

type ExportTable = 'aircraft' | 'drones' | 'signals';
type RangeOption = 'all' | 'last-hour' | 'custom';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const OVERLAY_ID = 'export-dialog-overlay';

export const ExportDialog: React.FC<ExportDialogProps> = ({ isOpen, onClose }) => {
  const [table, setTable] = useState<ExportTable>('aircraft');
  const [range, setRange] = useState<RangeOption>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const portalTarget = useMemo(() => {
    let node = document.getElementById(OVERLAY_ID);
    if (!node) {
      node = document.createElement('div');
      node.id = OVERLAY_ID;
      document.body.appendChild(node);
    }
    return node;
  }, []);

  if (!isOpen) {
    return null;
  }

  const computeRangeParams = (): { start?: number; end?: number } => {
    if (range === 'all') {
      return {};
    }
    if (range === 'last-hour') {
      return { start: Date.now() - 60 * 60 * 1000 };
    }
    const startMs = customStart ? Date.parse(customStart) : NaN;
    const endMs = customEnd ? Date.parse(customEnd) : NaN;
    return {
      start: Number.isFinite(startMs) ? startMs : undefined,
      end: Number.isFinite(endMs) ? endMs : undefined,
    };
  };

  const handleExport = async () => {
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams({ table });
      const { start, end } = computeRangeParams();
      if (start != null) {
        params.set('startTime', String(Math.floor(start)));
      }
      if (end != null) {
        params.set('endTime', String(Math.floor(end)));
      }
      const url = `http://127.0.0.1:3000/api/export/csv?${params.toString()}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Export failed with status ${response.status}`);
      }
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = `${table}_${Date.now()}.csv`;
      anchor.click();
      URL.revokeObjectURL(downloadUrl);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export data');
    } finally {
      setBusy(false);
    }
  };

  const dialog = (
    <div className={styles.overlay}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="export-dialog-title">
        <h2 id="export-dialog-title">Export CSV</h2>
        <div className={styles.field}>
          <label htmlFor="export-table">Data Type</label>
          <select
            id="export-table"
            value={table}
            onChange={(event) => setTable(event.target.value as ExportTable)}
          >
            <option value="aircraft">Aircraft</option>
            <option value="drones">Drones</option>
            <option value="signals">Signals</option>
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="export-range">Time Range</label>
          <select id="export-range" value={range} onChange={(event) => setRange(event.target.value as RangeOption)}>
            <option value="all">All Data</option>
            <option value="last-hour">Last Hour</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>
        {range === 'custom' && (
          <div className={styles.customRange}>
            <div>
              <label htmlFor="export-start">Start</label>
              <input
                id="export-start"
                type="datetime-local"
                value={customStart}
                onChange={(event) => setCustomStart(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="export-end">End</label>
              <input
                id="export-end"
                type="datetime-local"
                value={customEnd}
                onChange={(event) => setCustomEnd(event.target.value)}
              />
            </div>
          </div>
        )}
        {error && <div className={styles.error}>{error}</div>}
        <div className={styles.actions}>
          <button type="button" onClick={onClose} className={styles.secondaryButton} disabled={busy}>
            Cancel
          </button>
          <button type="button" onClick={handleExport} className={styles.primaryButton} disabled={busy}>
            {busy ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(dialog, portalTarget);
};
