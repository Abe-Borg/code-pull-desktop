import * as fs from 'node:fs'
import { handleHostRequest, type HostRequest } from '../../adapters/nfpa-link/handle'

/**
 * Utility process for source adapters.
 * NFPA LiNK navigates here. UpCodes does not.
 */
interface ParentPort {
  on(event: 'message', listener: (event: { data: HostRequest }) => void): void
  postMessage(message: unknown): void
}

const parentPort = (process as NodeJS.Process & { parentPort: ParentPort }).parentPort
let queue = Promise.resolve()

parentPort.on('message', (event) => {
  const request = event.data
  if (!request || typeof request !== 'object' || !request.id) return
  queue = queue
    .then(() =>
      handleHostRequest(request, {
        chromiumStatus: reportChromium,
        fixtureMode: process.env.CODE_PULL_SMOKE === '1',
      }),
    )
    .then((response) => parentPort.postMessage(response))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      parentPort.postMessage({
        id: request.id,
        type: request.type === 'sign-in' ? 'sign-in-result' : request.type === 'ping' ? 'pong' : 'retrieve-result',
        ready: false,
        chromiumPath: null,
        detail: message,
        signedIn: false,
        message,
        result: { ok: false, code: 'navigation-error', message: `NFPA LiNK could not be opened. ${message}` },
      })
    })
})

async function reportChromium(): Promise<{ ready: boolean; chromiumPath: string | null; detail: string }> {
  try {
    const importer = new Function('specifier', 'return import(specifier)') as (
      specifier: string,
    ) => Promise<{ chromium: { executablePath(): string } }>
    const playwright = await importer('playwright')
    const chromiumPath = playwright.chromium.executablePath()
    const installed = fs.existsSync(chromiumPath)
    return {
      ready: true,
      chromiumPath: installed ? chromiumPath : null,
      detail: installed
        ? 'Chromium is installed. NFPA LiNK uses the persistent browser profile.'
        : 'Playwright is loaded. Install Chromium with npx playwright install chromium before NFPA LiNK can open.',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      ready: false,
      chromiumPath: null,
      detail: `Browser host could not load Playwright. ${message}`,
    }
  }
}
