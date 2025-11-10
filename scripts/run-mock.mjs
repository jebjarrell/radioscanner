#!/usr/bin/env node
import { spawn } from 'node:child_process';
import process from 'node:process';

const childEnv = { ...process.env, USE_MOCK_DATA: 'true' };
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const child = spawn(npmCmd, ['run', 'dev'], {
  stdio: 'inherit',
  env: childEnv,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on('error', (err) => {
  console.error('[mock] Failed to start development server', err);
  process.exit(1);
});
