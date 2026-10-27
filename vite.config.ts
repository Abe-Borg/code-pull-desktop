import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const distElectron = path.resolve(rootDir, 'dist-electron')

export default defineConfig(({ command }) => ({
  root: path.resolve(rootDir, 'app/renderer'),
  base: command === 'build' ? './' : '/',
  plugins: [
    react(),
    tailwindcss(),
    electron({
      entry: path.resolve(rootDir, 'app/main/preload.ts'),
      onstart({ reload }) {
        reload()
      },
      vite: {
        build: {
          outDir: distElectron,
          emptyOutDir: true,
          lib: {
            entry: path.resolve(rootDir, 'app/main/preload.ts'),
            formats: ['cjs'],
            fileName: () => 'preload.cjs',
          },
          rollupOptions: {
            output: {
              // Sandboxed preloads load as classic scripts, so this file is CommonJS.
              format: 'cjs',
              inlineDynamicImports: true,
              entryFileNames: 'preload.cjs',
            },
          },
        },
      },
    }),
    electron({
      entry: path.resolve(rootDir, 'app/main/playwright-host.ts'),
      onstart() {
        // Utility process. Launching Electron here would open a second app.
      },
      vite: {
        build: {
          outDir: distElectron,
          emptyOutDir: false,
          rollupOptions: {
            external: ['playwright', 'playwright-core', 'electron'],
            output: {
              format: 'es',
              entryFileNames: 'playwright-host.js',
            },
          },
        },
      },
    }),
    electron({
      entry: path.resolve(rootDir, 'app/main/index.ts'),
      onstart({ startup }) {
        startup()
      },
      vite: {
        build: {
          outDir: distElectron,
          emptyOutDir: false,
          rollupOptions: {
            external: ['playwright', 'playwright-core', 'keytar', 'electron'],
            output: {
              format: 'es',
              entryFileNames: 'main.js',
            },
          },
        },
      },
    }),
  ],
  build: {
    outDir: path.resolve(rootDir, 'dist'),
    emptyOutDir: true,
  },
  server: {
    host: '127.0.0.1',
    port: 43123,
    strictPort: true,
  },
}))
