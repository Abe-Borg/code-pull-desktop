import { app, BrowserWindow } from 'electron'
import { installChromium } from './chromium-install'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { openSecretStore, type SecretStore } from '../../secrets'
import { browserHostPath, startBrowserHost, type BrowserHost } from './browser-host'
import { registerIpc } from './ipc'
import { createSmokeFetch } from './smoke-fetch'
import { runSmoke } from './smoke'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const smokeMode = process.env.CODE_PULL_SMOKE === '1'
const relaxSandbox = smokeMode || process.env.CODE_PULL_NO_SANDBOX === '1' || process.platform !== 'win32'

app.setName('Code Pull')

if (relaxSandbox) {
  app.commandLine.appendSwitch('no-sandbox')
  app.commandLine.appendSwitch('disable-gpu')
  app.commandLine.appendSwitch('disable-dev-shm-usage')
  app.disableHardwareAcceleration()
}

if (smokeMode) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-pull-smoke-'))
  app.setPath('userData', dir)
  process.env.CODE_PULL_SMOKE_USER_DATA = dir
}

const RENDERER_DIST = path.join(__dirname, '../dist')
let host: BrowserHost | null = null
let storePromise: Promise<SecretStore> | null = null

function getStore(): Promise<SecretStore> {
  if (!storePromise) {
    storePromise = openSecretStore(app.getPath('userData')).catch((error) => {
      storePromise = null
      throw error
    })
  }
  return storePromise
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1120,
    height: 840,
    minWidth: 720,
    minHeight: 560,
    show: false,
    backgroundColor: '#f3efe4',
    title: 'Code Pull',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // Windows keeps the renderer sandbox. Other platforms turn it off so the
      // window can open where Chromium cannot broker its sandbox.
      sandbox: !relaxSandbox,
    },
  })

  win.once('ready-to-show', () => win.show())

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    void win.loadURL(devUrl)
  } else {
    void win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  if (smokeMode) {
    const artifactDir = path.resolve(process.cwd(), 'smoke-artifacts')
    const timer = setTimeout(() => {
      console.error('Smoke timed out.')
      app.exit(1)
    }, 45_000)
    win.webContents.on('console-message', (event) => {
      if (event.level === 'warning' || event.level === 'error') {
        console.error(`[renderer] ${event.message}`)
      }
    })
    win.webContents.on('render-process-gone', (_event, details) => {
      console.error(`Renderer gone: ${details.reason} (exit ${details.exitCode})`)
    })
    win.webContents.once('did-finish-load', () => {
      void runSmoke(win, artifactDir).then(
        () => {
          clearTimeout(timer)
          app.exit(0)
        },
        (error: unknown) => {
          clearTimeout(timer)
          console.error(error instanceof Error ? error.stack ?? error.message : error)
          app.exit(1)
        },
      )
    })
  }

  return win
}

app.whenReady().then(() => {
  host = startBrowserHost(browserHostPath(__dirname))
  registerIpc({
    getStore,
    host,
    fetchImpl: smokeMode ? createSmokeFetch() : undefined,
  })
  createWindow()
  if (!smokeMode) void beginChromiumInstall()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  host?.stop()
})

function beginChromiumInstall(): void {
  const send = (phase: 'installing' | 'ready' | 'error', detail: string) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('chromium:progress', { phase, detail })
    }
  }
  void host?.status().then((status) => {
    if (status.chromiumPath) return
    send('installing', 'Downloading Chromium into LocalAppData\\CodePullDesktop\\ms-playwright.')
    return installChromium((line) => send('installing', line))
      .then(() => send('ready', 'Chromium is ready.'))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        send('error', message)
      })
  })
}
