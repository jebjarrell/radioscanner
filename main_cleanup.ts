// main/cleanup.ts
// Electron main-process cleanup utilities: register async cleanup and hook into quit signals.

import { app } from 'electron';

type MaybePromise = void | Promise<void>;
type CleanupFn = () => MaybePromise;

const cleanupFns: CleanupFn[] = [];

export function registerCleanup(fn: CleanupFn) {
  cleanupFns.push(fn);
}

async function runCleanup() {
  for (const fn of cleanupFns) {
    try {
      await fn();
    } catch (err) {
      /* log if you have a logger */
    }
  }
}

function hardShutdown(_signal?: string) {
  // attempt cleanup, but don't hang forever
  const timeout = setTimeout(() => process.exit(1), 3000);
  runCleanup().finally(() => {
    clearTimeout(timeout);
    process.exit(0);
  });
}

app.on('before-quit', (e) => {
  e.preventDefault(); // we will quit after cleanup
  const done = () => {
    app.exit(0);
  };
  const timeout = setTimeout(done, 4000);
  runCleanup().finally(() => {
    clearTimeout(timeout);
    done();
  });
});

process.on('SIGTERM', () => hardShutdown('SIGTERM'));
process.on('SIGINT', () => hardShutdown('SIGINT'));
process.on('uncaughtException', () => hardShutdown('uncaughtException'));

// Example registration in your main index:
// registerCleanup(async () => {
//   await stopScans();
//   await closeSockets();
//   await db?.vacuumOrClearTemp?.();
// });
