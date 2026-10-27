import { utilityProcess, type UtilityProcess } from 'electron'
import * as path from 'node:path'
import type { BrowserHostPong } from '../../adapters/browser-host'
import type { HostStatus } from '../../shared/contracts'

export interface BrowserHost {
  status(): Promise<HostStatus>
  stop(): void
}

export function startBrowserHost(hostPath: string): BrowserHost {
  let child: UtilityProcess
  try {
    child = utilityProcess.fork(hostPath, [], {
      serviceName: 'code-pull-browser-host',
      stdio: 'pipe',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      status: async () => ({
        ready: false,
        chromiumPath: null,
        detail: `Browser host failed to start. ${message}`,
      }),
      stop() {},
    }
  }

  let pending: ((message: BrowserHostPong) => void) | null = null

  child.on('message', (message) => {
    const pong = message as BrowserHostPong
    if (pong?.type !== 'pong') return
    pending?.(pong)
    pending = null
  })

  child.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString().trim()
    if (text) console.error(`[browser-host] ${text}`)
  })

  return {
    status() {
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          pending = null
          resolve({
            ready: false,
            chromiumPath: null,
            detail: 'Browser host did not respond.',
          })
        }, 15_000)

        pending = (pong) => {
          clearTimeout(timer)
          resolve({
            ready: pong.ready,
            chromiumPath: pong.chromiumPath,
            detail: pong.detail,
          })
        }

        try {
          child.postMessage({ type: 'ping' })
        } catch (error) {
          clearTimeout(timer)
          const message = error instanceof Error ? error.message : String(error)
          resolve({
            ready: false,
            chromiumPath: null,
            detail: `Browser host is not running. ${message}`,
          })
        }
      })
    },
    stop() {
      child.kill()
    },
  }
}

export function browserHostPath(dirname: string): string {
  return path.join(dirname, 'playwright-host.js')
}
