import { clipboard, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { browserProfileDir } from '../../adapters/nfpa-link/profile'
import { hintForKey, LINK_PASSWORD_ACCOUNT, LINK_USERNAME_ACCOUNT, validateClaudeKey, type SecretStore } from '../../secrets'
import { AskInputError, routeAsk, splitAsks } from '../../router'
import { canShowBrowser, type BrowserHost } from './browser-host'
import type { AskMode, LinkStatus, RunAsksRequest, SecretStatus } from '../../shared/contracts'

export function registerIpc(options: {
  getStore: () => Promise<SecretStore>
  host: BrowserHost
  fetchImpl?: typeof fetch
}): void {
  ipcMain.handle('secrets:status', async (): Promise<SecretStatus> => {
    try {
      const store = await options.getStore()
      const secret = await store.get()
      return {
        configured: Boolean(secret),
        backend: store.backend,
        hint: hintForKey(secret),
        location: store.location(),
        detail: null,
      }
    } catch (error) {
      return unavailable(error)
    }
  })

  ipcMain.handle('secrets:set', async (_event, raw: unknown): Promise<SecretStatus> => {
    if (typeof raw !== 'string') {
      return {
        configured: false,
        backend: 'unavailable',
        hint: null,
        location: 'Claude API key',
        detail: 'Paste the Claude API key as text.',
      }
    }

    let key: string
    try {
      key = validateClaudeKey(raw)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        configured: false,
        backend: 'unavailable',
        hint: null,
        location: 'Claude API key',
        detail: message,
      }
    }

    try {
      const store = await options.getStore()
      await store.set(key)
      return {
        configured: true,
        backend: store.backend,
        hint: hintForKey(key),
        location: store.location(),
        detail: null,
      }
    } catch (error) {
      return unavailable(error)
    }
  })

  ipcMain.handle('secrets:clear', async (): Promise<SecretStatus> => {
    try {
      const store = await options.getStore()
      await store.delete()
      return {
        configured: false,
        backend: store.backend,
        hint: null,
        location: store.location(),
        detail: null,
      }
    } catch (error) {
      return unavailable(error)
    }
  })

  ipcMain.handle('host:status', async () => options.host.status())

  ipcMain.handle('link:status', async (): Promise<LinkStatus> => readLinkStatus(options.getStore))

  ipcMain.handle('link:save', async (_event, raw: unknown): Promise<LinkStatus> => {
    const username = typeof (raw as { username?: unknown } | null)?.username === 'string' ? (raw as { username: string }).username.trim() : ''
    const password = typeof (raw as { password?: unknown } | null)?.password === 'string' ? (raw as { password: string }).password.trim() : ''
    if (!username) {
      return { username: null, hasPassword: false, profilePath: browserProfileDir(), detail: 'Enter the NFPA LiNK username.' }
    }
    try {
      const store = await options.getStore()
      await store.set(username, LINK_USERNAME_ACCOUNT)
      if (password) await store.set(password, LINK_PASSWORD_ACCOUNT)
      else await store.delete(LINK_PASSWORD_ACCOUNT)
      return readLinkStatus(options.getStore)
    } catch (error) {
      return { username: null, hasPassword: false, profilePath: browserProfileDir(), detail: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('link:clear', async (): Promise<LinkStatus> => {
    try {
      const store = await options.getStore()
      await store.delete(LINK_USERNAME_ACCOUNT)
      await store.delete(LINK_PASSWORD_ACCOUNT)
      return readLinkStatus(options.getStore)
    } catch (error) {
      return { username: null, hasPassword: false, profilePath: browserProfileDir(), detail: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('link:signIn', async () => {
    try {
      const store = await options.getStore()
      return options.host.signIn({
        profileDir: browserProfileDir(),
        username: await store.get(LINK_USERNAME_ACCOUNT),
        password: await store.get(LINK_PASSWORD_ACCOUNT),
        allowHeaded: canShowBrowser() && process.env.CODE_PULL_SMOKE !== '1',
        fixture: process.env.CODE_PULL_SMOKE === '1',
      })
    } catch (error) {
      return { signedIn: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('clipboard:write', async (_event, text: unknown) => {
    if (typeof text !== 'string' || text.length === 0 || text.length > 2_000) return
    clipboard.writeText(text)
  })

  ipcMain.handle('asks:run', async (event, payload: unknown) => {
    const request = parseRequest(payload)
    if (!request.ok) return { ok: false as const, message: request.message }

    let asks: string[]
    try {
      asks = splitAsks(request.request.mode, request.request.text)
    } catch (error) {
      const message = error instanceof AskInputError ? error.message : 'Those asks could not be read.'
      return { ok: false as const, message }
    }

    let apiKey: string | null = null
    try {
      const store = await options.getStore()
      apiKey = await store.get()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { ok: false as const, message }
    }

    const results = []
    for (let index = 0; index < asks.length; index += 1) {
      const result = await routeAsk({
        ask: asks[index],
        apiKey,
        fetchImpl: options.fetchImpl,
        retrieveLink: (ask) => retrieveLink(options, ask),
      })
      results.push(result)
      if (!event.sender.isDestroyed()) {
        event.sender.send('asks:progress', { index, total: asks.length, result })
      }
    }

    return { ok: true as const, results }
  })
}

function parseRequest(
  payload: unknown,
): { ok: true; request: RunAsksRequest } | { ok: false; message: string } {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, message: 'The ask payload was empty.' }
  }
  const mode = (payload as { mode?: unknown }).mode
  const text = (payload as { text?: unknown }).text
  if (!isMode(mode) || typeof text !== 'string') {
    return { ok: false, message: 'Choose a single ask or a list, then enter the text.' }
  }
  return { ok: true, request: { mode, text } }
}

function isMode(value: unknown): value is AskMode {
  return value === 'single' || value === 'list'
}

async function retrieveLink(
  options: { getStore: () => Promise<SecretStore>; host: BrowserHost },
  ask: string,
) {
  const store = await options.getStore()
  return options.host.retrieveLink({
    ask,
    profileDir: browserProfileDir(),
    username: await store.get(LINK_USERNAME_ACCOUNT),
    password: await store.get(LINK_PASSWORD_ACCOUNT),
    allowHeaded: canShowBrowser() && process.env.CODE_PULL_SMOKE !== '1',
    fixture: process.env.CODE_PULL_SMOKE === '1',
  })
}

async function readLinkStatus(getStore: () => Promise<SecretStore>): Promise<LinkStatus> {
  try {
    const store = await getStore()
    return {
      username: await store.get(LINK_USERNAME_ACCOUNT),
      hasPassword: Boolean(await store.get(LINK_PASSWORD_ACCOUNT)),
      profilePath: browserProfileDir(),
      detail: null,
    }
  } catch (error) {
    return {
      username: null,
      hasPassword: false,
      profilePath: browserProfileDir(),
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

function unavailable(error: unknown): SecretStatus {
  const message = error instanceof Error ? error.message : String(error)
  return {
    configured: false,
    backend: 'unavailable',
    hint: null,
    location: 'Credential store',
    detail: message,
  }
}

export type IpcEvent = IpcMainInvokeEvent
