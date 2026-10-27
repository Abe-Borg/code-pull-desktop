import { app } from 'electron'
import { spawn } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { playwrightBrowsersDir } from '../../adapters/nfpa-link/profile'

let current: Promise<void> | null = null

export function installChromium(onLine: (line: string) => void): Promise<void> {
  if (current) return current
  const browsers = playwrightBrowsersDir()
  fs.mkdirSync(browsers, { recursive: true })
  const cli = playwrightCliPath()
  current = new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, 'install', 'chromium'], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        PLAYWRIGHT_BROWSERS_PATH: browsers,
      },
      windowsHide: true,
    })
    const emit = (chunk: Buffer) => {
      for (const line of chunk.toString().split(/\r?\n/)) {
        const trimmed = line.trim()
        if (trimmed) onLine(trimmed)
      }
    }
    child.stdout.on('data', emit)
    child.stderr.on('data', emit)
    child.on('error', (error) => {
      current = null
      reject(error)
    })
    child.on('close', (code) => {
      current = null
      if (code === 0) resolve()
      else reject(new Error(`Chromium install exited ${code ?? 'unknown'}.`))
    })
  })
  return current
}

function playwrightCliPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'playwright', 'cli.js')
  }
  return path.join(app.getAppPath(), 'node_modules', 'playwright', 'cli.js')
}
