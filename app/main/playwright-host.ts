import * as fs from 'node:fs'
import type { BrowserHostPing, BrowserHostPong } from '../../adapters/browser-host'

/**
 * Utility process for future source adapters.
 * This increment only reports whether Playwright can see a Chromium binary.
 * It does not open NFPA LiNK, UpCodes, or any other site.
 */
interface ParentPort {
  on(event: 'message', listener: (event: { data: BrowserHostPing }) => void): void
  postMessage(message: BrowserHostPong): void
}

const parentPort = (process as NodeJS.Process & { parentPort: ParentPort }).parentPort

parentPort.on('message', (event) => {
  if (!event.data || event.data.type !== 'ping') return
  void report().then((message) => parentPort.postMessage(message))
})

async function report(): Promise<BrowserHostPong> {
  try {
    const importer = new Function('specifier', 'return import(specifier)') as (
      specifier: string,
    ) => Promise<{ chromium: { executablePath(): string } }>
    const playwright = await importer('playwright')
    const chromiumPath = playwright.chromium.executablePath()
    const installed = fs.existsSync(chromiumPath)
    return {
      type: 'pong',
      ready: true,
      chromiumPath: installed ? chromiumPath : null,
      detail: installed
        ? 'Chromium is installed. The browser host is idle until a source adapter is connected.'
        : 'Playwright is loaded. Install Chromium with npx playwright install chromium before a source adapter can open a site.',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      type: 'pong',
      ready: false,
      chromiumPath: null,
      detail: `Browser host could not load Playwright. ${message}`,
    }
  }
}
