import { useCallback, useEffect, useState } from 'react';

import type { AppSettings } from '../../backend/services/settingsParser';
import { BACKEND_URL } from '../../config/client';

interface UseSettingsResult {
  settings: AppSettings | null;
  loading: boolean;
  error: string | null;
  updateSetting: (key: string, value: string) => Promise<{ success: boolean; requiresRestart: boolean }>;
  updateBulk: (updates: Array<{ key: string; value: string }>) => Promise<{ success: boolean; requiresRestart: boolean }>;
  testConnection: (service: string, host: string, port: number) => Promise<{ success: boolean; latencyMs?: number; error?: string }>;
  resetSettings: (section?: string) => Promise<{ success: boolean; requiresRestart: boolean }>;
  refresh: () => Promise<void>;
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BACKEND_URL}/api/settings`);
      if (!response.ok) {
        throw new Error(`Failed to fetch settings: ${response.status}`);
      }
      const data = await response.json();
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  const updateSetting = useCallback(async (key: string, value: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update setting: ${response.status}`);
      }

      const result = await response.json();
      await fetchSettings();
      return { success: true, requiresRestart: result.requiresRestart || false };
    } catch (err) {
      console.error('Failed to update setting:', err);
      return { success: false, requiresRestart: false };
    }
  }, [fetchSettings]);

  const updateBulk = useCallback(async (updates: Array<{ key: string; value: string }>) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/settings/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) {
        throw new Error(`Failed to bulk update settings: ${response.status}`);
      }

      const result = await response.json();
      await fetchSettings();
      return { success: true, requiresRestart: result.requiresRestart || false };
    } catch (err) {
      console.error('Failed to bulk update settings:', err);
      return { success: false, requiresRestart: false };
    }
  }, [fetchSettings]);

  const testConnection = useCallback(async (service: string, host: string, port: number) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/settings/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service, host, port }),
      });

      if (!response.ok) {
        throw new Error(`Connection test failed: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Connection test failed',
      };
    }
  }, []);

  const resetSettings = useCallback(async (section?: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/settings/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section }),
      });

      if (!response.ok) {
        throw new Error(`Failed to reset settings: ${response.status}`);
      }

      const result = await response.json();
      await fetchSettings();
      return { success: true, requiresRestart: result.requiresRestart || false };
    } catch (err) {
      console.error('Failed to reset settings:', err);
      return { success: false, requiresRestart: false };
    }
  }, [fetchSettings]);

  return {
    settings,
    loading,
    error,
    updateSetting,
    updateBulk,
    testConnection,
    resetSettings,
    refresh: fetchSettings,
  };
}
