import path from 'node:path';

import { defineConfig } from 'vite';
import electronPkg from 'vite-plugin-electron';
import rendererPkg from 'vite-plugin-electron-renderer';

const electron = electronPkg as unknown as (typeof import('vite-plugin-electron'))['default'];
const renderer =
  rendererPkg as unknown as (typeof import('vite-plugin-electron-renderer'))['default'];

export default defineConfig({
  resolve: {
    alias: {
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@main': path.resolve(__dirname, 'src/main'),
      '@preload': path.resolve(__dirname, 'src/preload'),
    },
  },
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  plugins: [
    electron([
      {
        entry: 'src/main/index.ts',
        onstart({ startup }) {
          startup();
        },
        vite: {
          build: {
            outDir: 'dist-electron/main',
            emptyOutDir: true,
            sourcemap: true,
            target: 'node18',
            ssr: true,
          },
        },
      },
      {
        entry: 'src/preload/index.cjs',
        vite: {
          build: {
            outDir: 'dist-electron/preload',
            emptyOutDir: true,
            sourcemap: true,
            target: 'node18',
            ssr: true,
            lib: {
              entry: path.resolve(__dirname, 'src/preload/index.cjs'),
              formats: ['cjs'],
              fileName: () => 'index',
            },
            rollupOptions: {
              external: ['electron'],
              output: {
                entryFileNames: 'index.cjs',
                exports: 'named',
                esModule: false,
              },
            },
          },
        },
      },
    ]),
    renderer(),
  ],
});
