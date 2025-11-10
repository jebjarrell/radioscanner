import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { app, BrowserWindow, dialog, ipcMain, session, shell } from 'electron';

import type { ServiceKey } from '../types/services.js';

import { registerCleanup } from './main_cleanup.js';

const isDev = !app.isPackaged;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAP_TILE_ORIGIN = 'https://demotiles.maplibre.org';
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `img-src 'self' blob: data: ${MAP_TILE_ORIGIN}`,
  `connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:* wss://127.0.0.1:* ${MAP_TILE_ORIGIN}`,
  `font-src 'self' ${MAP_TILE_ORIGIN}`,
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "worker-src 'self' blob:",
  "object-src 'none'",
].join('; ');

const shouldUseMockData = parseBooleanEnv(process.env.USE_MOCK_DATA);

const BACKEND_HOST = '127.0.0.1';
const BACKEND_PORT = process.env.BACKEND_PORT ?? '3000';
const BACKEND_BASE_URL = `http://${BACKEND_HOST}:${BACKEND_PORT}`;
const BACKEND_HEALTH_URL = `${BACKEND_BASE_URL}/health`;

const RETRYABLE_SERVICES = new Set<ServiceKey>(['rtlTcp', 'dump1090', 'kismet', 'gps']);

let backendProcess: ChildProcess | null = null;
let backendStopping = false;
let appQuitting = false;
let quitHandling = false;

function getBackendCwd(): string {
  if (!app.isPackaged) {
    return path.join(__dirname, '..', '..');
  }
  return app.getAppPath();
}

async function startBackend(): Promise<void> {
  if (backendProcess) {
    return;
  }
  const cwd = getBackendCwd();
  const child = spawn('node', ['--import', 'tsx/esm', 'src/backend/server.ts'], {
    cwd,
    env: {
      ...process.env,
      BACKEND_PORT,
      USE_MOCK_DATA: shouldUseMockData ? '1' : '0',
    },
    stdio: 'inherit',
  });

  backendProcess = child;
  backendStopping = false;

  child.once('exit', (code, signal) => {
    const expectedShutdown = appQuitting || backendStopping;
    backendProcess = null;
    backendStopping = false;
    if (!expectedShutdown) {
      console.error(
        `Backend process exited unexpectedly${code !== null ? ` (code ${code})` : ''}${
          signal ? ` (signal ${signal})` : ''
        }`,
      );
      dialog.showErrorBox(
        'Backend Process Exited',
        'The OnTheGo backend process stopped unexpectedly. Please restart the application.',
      );
      app.quit();
    }
  });

  child.once('error', (err) => {
    backendProcess = null;
    backendStopping = false;
    console.error('Failed to spawn backend process', err);
  });
}

async function waitForBackendReady(timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (backendProcess && backendProcess.exitCode !== null) {
      throw new Error('Backend process exited before becoming ready.');
    }
    try {
      const response = await fetch(BACKEND_HEALTH_URL, { method: 'GET' });
      if (response.ok) {
        return;
      }
    } catch {
      // retry
    }
    await delay(500);
  }
  throw new Error('Backend did not become ready within the expected time.');
}

async function stopBackend(): Promise<void> {
  const child = backendProcess;
  if (!child || child.exitCode !== null || backendStopping) {
    return;
  }

  backendStopping = true;

  await new Promise<void>((resolve) => {
    const handleExit = () => {
      backendStopping = false;
      backendProcess = null;
      clearTimeout(forceKillTimer);
      resolve();
    };

    child.once('exit', handleExit);
    child.once('error', handleExit);

    const forceKillTimer = setTimeout(() => {
      if (child.exitCode === null) {
        child.kill('SIGKILL');
      }
    }, 5_000);

    child.kill('SIGTERM');
  });
}

registerCleanup(async () => {
  await stopBackend();
});

app.on('before-quit', (event) => {
  if (appQuitting) {
    return;
  }
  event.preventDefault();
  if (quitHandling) {
    return;
  }
  quitHandling = true;
  void (async () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (!window) {
      appQuitting = true;
      app.quit();
      return;
    }

    let hasData = false;
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/stats`);
      if (response.ok) {
        const stats = (await response.json()) as {
          aircraftCount?: number;
          droneCount?: number;
          signalCount?: number;
        };
        const { aircraftCount = 0, droneCount = 0, signalCount = 0 } = stats;
        const total = aircraftCount + droneCount + signalCount;
        hasData = total > 0;
      }
    } catch {
      hasData = false;
    }

    if (!hasData) {
      appQuitting = true;
      app.quit();
      quitHandling = false;
      return;
    }

    const { response: choice } = await dialog.showMessageBox(window, {
      type: 'question',
      buttons: ['Save & Quit', 'Quit Without Saving', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      title: 'Save Session Data?',
      message: 'You have unsaved session data.',
      detail: 'Do you want to save before closing?',
    });

    if (choice === 2) {
      quitHandling = false;
      return;
    }

    if (choice === 0) {
      const { filePath } = await dialog.showSaveDialog(window, {
        title: 'Save Session Data',
        defaultPath: path.join(
          app.getPath('documents'),
          'Radio-Scanner-Sessions',
          `session_${Date.now()}.sqlite`,
        ),
        filters: [{ name: 'SQLite Database', extensions: ['sqlite', 'db'] }],
      });
      if (!filePath) {
        quitHandling = false;
        return;
      }

      try {
        const response = await fetch(`${BACKEND_BASE_URL}/api/session/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: filePath }),
        });
        if (!response.ok) {
          throw new Error(`Save failed with status ${response.status}`);
        }
      } catch (err) {
        const { response: followUp } = await dialog.showMessageBox(window, {
          type: 'error',
          buttons: ['Quit Anyway', 'Cancel'],
          defaultId: 1,
          cancelId: 1,
          title: 'Save Failed',
          message: 'Failed to save session data.',
          detail: err instanceof Error ? err.message : 'Unknown error',
        });
        if (followUp === 1) {
          quitHandling = false;
          return;
        }
      }
    }

    appQuitting = true;
    app.quit();
    quitHandling = false;
  })();
});

const createWindow = async () => {
  const preloadPath = isDev
    ? path.join(__dirname, '../../src/preload/index.cjs')
    : path.join(__dirname, '../preload/index.cjs');

  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const indexHtml = path.join(__dirname, '../../dist/index.html');
    await mainWindow.loadFile(indexHtml);
  }
};

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
  }
});

app.whenReady().then(async () => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [CONTENT_SECURITY_POLICY],
      },
    });
  });

  ipcMain.handle('app:get-version', () => app.getVersion());
  ipcMain.handle('service:retry', async (_event, rawService: unknown) => {
    if (typeof rawService !== 'string' || !RETRYABLE_SERVICES.has(rawService as ServiceKey)) {
      return false;
    }
    const service = rawService as ServiceKey;
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/service/retry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ service }),
      });
      if (!response.ok) {
        return false;
      }
      const payload = (await response.json()) as { success?: unknown };
      return Boolean(payload.success);
    } catch (err) {
      console.error(`Retry request failed for ${service}`, err);
      return false;
    }
  });

  if (shouldUseMockData && process.env.NODE_ENV !== 'production') {
    console.info('USE_MOCK_DATA enabled - backend will start in mock mode.');
  }

  try {
    await startBackend();
    await waitForBackendReady();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown backend startup failure.';
    console.error('Failed to start backend server', err);
    dialog.showErrorBox('Backend Startup Failed', message);
    app.quit();
    return;
  }

  await createWindow();
});

export { registerCleanup };

function parseBooleanEnv(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}
