import { copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

async function main() {
  const scriptPath = fileURLToPath(import.meta.url);
  const projectRoot = path.resolve(path.dirname(scriptPath), '..');
  const distDir = path.join(projectRoot, 'dist');
  const installersDir = path.join(distDir, 'installers');

  let entries;
  try {
    entries = await readdir(installersDir, { withFileTypes: true });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.warn(
      `[copy-windows] installers directory missing (${installersDir}): ${error.message}`,
    );
    return;
  }

  const windowsInstallers = entries
    .filter(
      (entry) => entry.isFile() && (entry.name.endsWith('.exe') || entry.name.endsWith('.msi')),
    )
    .map((entry) => entry.name);

  if (windowsInstallers.length === 0) {
    console.warn('[copy-windows] no Windows installer artifacts found to copy.');
    return;
  }

  await mkdir(distDir, { recursive: true });

  await Promise.all(
    windowsInstallers.map(async (filename) => {
      const source = path.join(installersDir, filename);
      const destination = path.join(distDir, filename);
      await copyFile(source, destination);
      console.info(`[copy-windows] copied ${filename} to dist/`);
    }),
  );
}

main().catch((err) => {
  console.error('[copy-windows] failed to copy Windows installer artifacts:', err);
  process.exit(1);
});
