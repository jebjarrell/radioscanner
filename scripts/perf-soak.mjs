#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.USE_MOCK_DATA = 'true';

const SNAPSHOT_INTERVAL_MS = 60_000;
const DURATION_MS = 60 * 60 * 1_000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const tsconfigPath = path.join(projectRoot, 'tsconfig.perf.json');
const outDir = path.join(projectRoot, '.perf-tmp');
const tscCandidates = [
  path.join(projectRoot, 'node_modules', 'typescript', 'bin', 'tsc.js'),
  path.join(projectRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
];

function buildBackendBundle() {
  const tscCli = resolveTscBinary();
  const result = spawnSync(process.execPath, [tscCli, '--project', tsconfigPath], {
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error('TypeScript compilation for perf soak failed');
  }
}

function resolveTscBinary() {
  for (const candidate of tscCandidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(
    'Unable to locate TypeScript compiler binary (tsc). Have you installed dependencies?',
  );
}

async function loadHealthMonitor() {
  buildBackendBundle();
  const moduleUrl = pathToFileURL(path.join(outDir, 'backend', 'health.js'));
  const module = await import(`${moduleUrl.href}?t=${Date.now()}`);
  if (!module.HealthMonitor) {
    throw new Error('HealthMonitor export not found in compiled backend bundle');
  }
  return module.HealthMonitor;
}

async function main(HealthMonitorCtor) {
  const monitor = new HealthMonitorCtor({ useMockData: true });
  monitor.on('error', (err) => console.error('[perf] health monitor error', err));

  await monitor.start();
  console.info('[perf] HealthMonitor started in mock mode');

  let iteration = 0;
  const startedAt = Date.now();
  const controller = new AbortController();

  const shutdown = async (label) => {
    if (!controller.signal.aborted) {
      console.info(`[perf] ${label} – stopping soak`);
      controller.abort();
      await delay(0);
    }
  };

  process.once('SIGINT', () => {
    void shutdown('SIGINT received');
  });
  process.once('SIGTERM', () => {
    void shutdown('SIGTERM received');
  });

  try {
    while (!controller.signal.aborted) {
      const elapsed = Date.now() - startedAt;
      logMemorySnapshot(++iteration, elapsed);

      if (elapsed >= DURATION_MS) {
        break;
      }

      const remaining = Math.min(SNAPSHOT_INTERVAL_MS, DURATION_MS - elapsed);
      try {
        await delay(remaining, { signal: controller.signal });
      } catch (err) {
        if (!(err instanceof Error) || err.name !== 'AbortError') {
          throw err;
        }
      }
    }
  } finally {
    monitor.stop();
    logMemorySnapshot(-1, Date.now() - startedAt, true);
    console.info('[perf] Perf soak complete');
  }
}

function logMemorySnapshot(iteration, elapsedMs, final = false) {
  const usage = process.memoryUsage();
  const toMb = (value) => `${(value / 1024 / 1024).toFixed(1)} MB`;
  const elapsed = (elapsedMs / 1000).toFixed(0);
  const label = final ? 'final snapshot' : `snapshot #${iteration} @ +${elapsed}s`;
  console.info(
    `[perf] ${label}: rss=${toMb(usage.rss)} heapUsed=${toMb(usage.heapUsed)} heapTotal=${toMb(
      usage.heapTotal,
    )} external=${toMb(usage.external)}`,
  );
}

let HealthMonitorCtor;
try {
  HealthMonitorCtor = await loadHealthMonitor();
} catch (err) {
  console.error('[perf] Failed to prepare HealthMonitor bundle', err);
  process.exitCode = 1;
  process.exit();
}

void main(HealthMonitorCtor).catch((err) => {
  console.error('[perf] soak failed', err);
  process.exitCode = 1;
});
