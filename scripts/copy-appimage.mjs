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
      `[copy-appimage] installers directory missing (${installersDir}): ${error.message}`,
    );
    return;
  }

  const appImages = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.AppImage'))
    .map((entry) => entry.name);

  if (appImages.length === 0) {
    console.warn('[copy-appimage] no AppImage artifacts found to copy.');
    return;
  }

  await mkdir(distDir, { recursive: true });

  await Promise.all(
    appImages.map(async (filename) => {
      const source = path.join(installersDir, filename);
      const destination = path.join(distDir, filename);
      await copyFile(source, destination);
      console.info(`[copy-appimage] copied ${filename} to dist/`);
    }),
  );
}

main().catch((err) => {
  console.error('[copy-appimage] failed to copy AppImage artifact:', err);
  process.exit(1);
});
