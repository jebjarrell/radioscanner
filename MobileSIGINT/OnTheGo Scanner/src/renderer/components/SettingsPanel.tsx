import React, { useEffect, useState } from 'react';

import { BACKEND_URL } from '../../config/client.js';

const MODES: Array<{ value: 'memory' | 'disk'; label: string }> = [
  { value: 'memory', label: 'In-Memory (default)' },
  { value: 'disk', label: 'Disk-Backed (restart required)' },
];

export const SettingsPanel: React.FC = () => {
  const [mode, setMode] = useState<'memory' | 'disk'>('memory');
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/settings`);
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as Record<string, string>;
        const saved = payload['session_storage_mode'];
        if (!cancelled && (saved === 'memory' || saved === 'disk')) {
          setMode(saved);
        }
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[settings] failed to load session storage mode', err);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch(`${BACKEND_URL}/api/settings/session-storage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      if (!response.ok) {
        throw new Error(`Failed to update mode (${response.status})`);
      }
      setStatus('Will apply on next restart.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to update setting');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-panel">
      <div className="settings-panel__field">
        <label htmlFor="session-mode">Session Storage</label>
        <select
          id="session-mode"
          value={mode}
          onChange={(event) => setMode(event.target.value as 'memory' | 'disk')}
        >
          {MODES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <button type="button" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save Preference'}
      </button>
      {status && <div className="settings-panel__status">{status}</div>}
    </div>
  );
};
