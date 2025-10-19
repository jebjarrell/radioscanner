import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const MIN_NODE_VERSION = [18, 17, 0];

const checkNodeVersion = () => {
  const [major, minor, patch] = process.versions.node.split('.').map(Number);
  const [reqMajor, reqMinor, reqPatch] = MIN_NODE_VERSION;

  if (
    major < reqMajor ||
    (major === reqMajor && minor < reqMinor) ||
    (major === reqMajor && minor === reqMinor && patch < reqPatch)
  ) {
    return {
      ok: false,
      message: `Node.js ${reqMajor}.${reqMinor}.${reqPatch}+ required. Detected ${process.versions.node}.`
    };
  }

  return { ok: true, message: `Node.js version ${process.versions.node} satisfies requirement.` };
};

const checkPaths = async () => {
  const requiredPaths = ['src/main', 'src/preload', 'src/renderer', 'index.html'];
  const missing = [];

  await Promise.all(
    requiredPaths.map(async (relPath) => {
      try {
        await access(path.resolve(process.cwd(), relPath), constants.F_OK);
      } catch {
        missing.push(relPath);
      }
    })
  );

  if (missing.length > 0) {
    return {
      ok: false,
      message: `Missing required project paths: ${missing.join(', ')}`
    };
  }

  return { ok: true, message: 'All required project paths are present.' };
};

const main = async () => {
  const checks = [checkNodeVersion(), await checkPaths()];

  const hasErrors = checks.some((check) => !check.ok);

  checks.forEach((check) => {
    const tag = check.ok ? 'PASS' : 'FAIL';
    // eslint-disable-next-line no-console
    console.log(`[${tag}] ${check.message}`);
  });

  if (hasErrors) {
    process.exitCode = 1;
  }
};

void main();
