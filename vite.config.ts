import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron'
import * as esbuild from 'esbuild'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const distElectron = path.resolve(rootDir, 'dist-electron')

const preloadEntry = path.resolve(rootDir, 'app/main/preload.ts')
const hostEntry = path.resolve(rootDir, 'app/main/playwright-host.ts')
const mainEntry = path.resolve(rootDir, 'app/main/index.ts')

export default defineConfig(({ command }) => ({
  root: path.resolve(rootDir, 'app/renderer'),
  base: command === 'build' ? './' : '/',
  plugins: [
    react(),
    tailwindcss(),
    sideBundles(command),
    electron({
      entry: mainEntry,
      onstart({ startup }) {
        // The plugin default adds --no-sandbox. Keep the sandbox on Windows.
        startup(process.platform === 'win32' ? ['.'] : ['.', '--no-sandbox', '--disable-gpu'])
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

function sideBundles(command: 'build' | 'serve'): Plugin {
  return {
    name: 'code-pull-side-bundles',
    async buildStart() {
      if (command === 'build') await writeSideBundles()
    },
    async configureServer(server) {
      await writeSideBundles()
      const plugins = [
        {
          name: 'reload-renderer',
          setup(build: esbuild.PluginBuild) {
            build.onEnd((result) => {
              if (result.errors.length > 0) return
              server.ws.send({ type: 'full-reload' })
            })
          },
        },
      ]
      const preload = await esbuild.context({ ...preloadOptions(), plugins })
      const host = await esbuild.context(hostOptions())
      await preload.watch()
      await host.watch()
    },
  }
}

async function writeSideBundles(): Promise<void> {
  await esbuild.build(preloadOptions())
  await esbuild.build(hostOptions())
}

function preloadOptions(): esbuild.BuildOptions {
  return {
    entryPoints: [preloadEntry],
    outfile: path.join(distElectron, 'preload.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['electron'],
    logLevel: 'silent',
  }
}

function hostOptions(): esbuild.BuildOptions {
  return {
    entryPoints: [hostEntry],
    outfile: path.join(distElectron, 'playwright-host.js'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    external: ['electron', 'playwright', 'playwright-core'],
    packages: 'external',
    logLevel: 'silent',
  }
}
