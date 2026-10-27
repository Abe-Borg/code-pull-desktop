import { createWriteStream } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const revision = '1248'
const version = '156.0.8078.4'
const root = path.resolve('build/playwright-browsers')
const browserDir = path.join(root, `chromium-${revision}`)
const exe = path.join(browserDir, 'chrome-win64', 'chrome.exe')
const zipUrl = `https://cdn.playwright.dev/builds/cft/${version}/win64/chrome-win64.zip`

if (await exists(exe)) {
  console.log(`Windows Chromium already present at ${exe}`)
  process.exit(0)
}

await fs.mkdir(root, { recursive: true })
const zipPath = path.join(root, 'chrome-win64.zip')
console.log(`Downloading ${zipUrl}`)
const response = await fetch(zipUrl)
if (!response.ok || !response.body) {
  throw new Error(`Chromium download failed (${response.status}).`)
}
await pipeline(response.body, createWriteStream(zipPath))
await fs.rm(browserDir, { recursive: true, force: true })
await fs.mkdir(browserDir, { recursive: true })
await execFileAsync('unzip', ['-q', zipPath, '-d', browserDir])
await fs.rm(zipPath, { force: true })
await fs.writeFile(path.join(browserDir, 'INSTALLATION_COMPLETE'), '')
if (!(await exists(exe))) {
  throw new Error(`Expected ${exe} after unzip.`)
}
console.log(`Installed Windows Chromium at ${exe}`)

async function exists(file) {
  try {
    await fs.access(file)
    return true
  } catch {
    return false
  }
}
