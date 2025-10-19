import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@main': path.resolve(__dirname, 'src/main'),
      '@preload': path.resolve(__dirname, 'src/preload')
    }
  },
  server: {
    port: 5173
  },
  preview: {
    port: 4173
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true
  },
  plugins: [
    electron({
      main: {
        entry: 'src/main/index.ts',
        vite: {
          build: {
            outDir: 'dist-electron/main',
            emptyOutDir: true,
            sourcemap: true,
            target: 'node18'
          }
        }
      },
      preload: {
        input: {
          main: path.join(__dirname, 'src/preload/index.ts')
        },
        vite: {
          build: {
            outDir: 'dist-electron/preload',
            emptyOutDir: true,
            sourcemap: true,
            target: 'node18'
          }
        }
      },
      renderer: {}
    }),
    renderer()
  ]
});
