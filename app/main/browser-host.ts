import { utilityProcess, type UtilityProcess } from 'electron'
import { randomUUID } from 'node:crypto'
import * as path from 'node:path'
import type { BrowserHostPong, LinkRetrieveRequest, LinkSignInRequest, RetrieveResultMessage, SignInResultMessage } from '../../adapters/browser-host'
import { playwrightBrowsersDir } from '../../adapters/nfpa-link/profile'
import type { HostStatus } from '../../shared/contracts'
import type { SourceRetrieval } from '../../adapters/types'

type HostResponse = BrowserHostPong | RetrieveResultMessage | SignInResultMessage

export type SourceId = 'nfpa-link' | 'upcodes'

export interface BrowserHost {
  status(): Promise<HostStatus>
  retrieve(source: SourceId, request: LinkRetrieveRequest): Promise<SourceRetrieval>
  signIn(source: SourceId, request: LinkSignInRequest): Promise<{ signedIn: boolean; message: string }>
  stop(): void
}

export function startBrowserHost(hostPath: string): BrowserHost {
  let child: UtilityProcess
  try {
    child = utilityProcess.fork(hostPath, [], {
      serviceName: 'code-pull-browser-host',
      stdio: 'pipe',
      env: childEnv(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return unavailableHost(message)
  }

  const waiters = new Map<string, { resolve: (message: HostResponse) => void; timer: NodeJS.Timeout }>()

  const failWaiters = (message: string) => {
    for (const [id, waiter] of waiters) {
      clearTimeout(waiter.timer)
      waiters.delete(id)
      waiter.resolve({
        id,
        type: 'pong',
        ready: false,
        chromiumPath: null,
        detail: message,
      })
    }
  }

  child.on('message', (message) => {
    const response = message as HostResponse
    if (!response || typeof response !== 'object' || !('id' in response)) return
    const waiter = waiters.get(response.id)
    if (!waiter) return
    clearTimeout(waiter.timer)
    waiters.delete(response.id)
    waiter.resolve(response)
  })

  child.on('exit', (code) => {
    failWaiters(`Browser host exited (${code ?? 'unknown'}).`)
  })

  child.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString().trim()
    if (text) console.error(`[browser-host] ${text}`)
  })

  function send<T extends HostResponse>(body: Record<string, unknown>, timeout: number): Promise<T> {
    const id = randomUUID()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        waiters.delete(id)
        reject(new Error('Browser host did not respond.'))
      }, timeout)
      waiters.set(id, {
        timer,
        resolve: (message) => resolve(message as T),
      })
      try {
        child.postMessage({ ...body, id })
      } catch (error) {
        clearTimeout(timer)
        waiters.delete(id)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }

  return {
    async status() {
      try {
        const pong = await send<BrowserHostPong>({ type: 'ping' }, 15_000)
        return { ready: pong.ready, chromiumPath: pong.chromiumPath, detail: pong.detail }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { ready: false, chromiumPath: null, detail: message }
      }
    },
    async retrieve(source, request) {
      try {
        const response = await send<RetrieveResultMessage>({ type: 'retrieve', source, ...request }, 120_000)
        if (response.type !== 'retrieve-result') {
          return { ok: false, code: 'navigation-error', message: 'Browser host returned an unexpected reply.' }
        }
        return response.result
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { ok: false, code: 'navigation-error', message: `The source browser could not be opened. ${message}` }
      }
    },
    async signIn(source, request) {
      try {
        const response = await send<SignInResultMessage>({ type: 'sign-in', source, ...request }, 200_000)
        if (response.type !== 'sign-in-result') {
          return { signedIn: false, message: 'Browser host returned an unexpected reply.' }
        }
        return { signedIn: response.signedIn, message: response.message }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { signedIn: false, message }
      }
    },
    stop() {
      child.kill()
    },
  }
}

function unavailableHost(message: string): BrowserHost {
  return {
    status: async () => ({
      ready: false,
      chromiumPath: null,
      detail: `Browser host failed to start. ${message}`,
    }),
    retrieve: async () => ({
      ok: false,
      code: 'navigation-error',
      message: `Browser host failed to start. ${message}`,
    }),
    signIn: async () => ({ signedIn: false, message: `Browser host failed to start. ${message}` }),
    stop() {},
  }
}

export function browserHostPath(dirname: string): string {
  return path.join(dirname, 'playwright-host.js')
}

function childEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env }
  env.PLAYWRIGHT_BROWSERS_PATH = playwrightBrowsersDir()
  return env
}

export function canShowBrowser(): boolean {
  if (process.platform === 'win32' || process.platform === 'darwin') return true
  return Boolean(process.env.DISPLAY)
}
