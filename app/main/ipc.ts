import { clipboard, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { browserProfileDir, upcodesProfileDir } from '../../adapters/nfpa-link/profile'
import {
  hintForKey,
  LINK_PASSWORD_ACCOUNT,
  LINK_USERNAME_ACCOUNT,
  UPCODES_PASSWORD_ACCOUNT,
  UPCODES_USERNAME_ACCOUNT,
  validateClaudeKey,
  type SecretStore,
} from '../../secrets'
import type { SourceId } from './browser-host'
import { AskInputError, routeAsk, splitAsks } from '../../router'
import { canShowBrowser, type BrowserHost } from './browser-host'
import { installChromium } from './chromium-install'
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

  ipcMain.handle('chromium:install', async (event) => {
    const send = (phase: 'installing' | 'ready' | 'error', detail: string) => {
      if (!event.sender.isDestroyed()) event.sender.send('chromium:progress', { phase, detail })
    }
    try {
      send('installing', 'Downloading Chromium.')
      await installChromium((line) => send('installing', line))
      send('ready', 'Chromium is ready.')
      return { ok: true as const }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      send('error', message)
      return { ok: false as const, message }
    }
  })

  registerSiteLogin(options, {
    channel: 'link',
    usernameAccount: LINK_USERNAME_ACCOUNT,
    passwordAccount: LINK_PASSWORD_ACCOUNT,
    profileDir: browserProfileDir,
    source: 'nfpa-link',
    usernamePrompt: 'Enter the NFPA LiNK username.',
  })
  registerSiteLogin(options, {
    channel: 'upcodes',
    usernameAccount: UPCODES_USERNAME_ACCOUNT,
    passwordAccount: UPCODES_PASSWORD_ACCOUNT,
    profileDir: upcodesProfileDir,
    source: 'upcodes',
    usernamePrompt: 'Enter the UpCodes username.',
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
        retrieveLink: (ask) => retrieveSource(options, 'nfpa-link', ask),
        retrieveUpcodes: (ask) => retrieveSource(options, 'upcodes', ask),
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

async function retrieveSource(
  options: { getStore: () => Promise<SecretStore>; host: BrowserHost },
  source: SourceId,
  ask: string,
) {
  const store = await options.getStore()
  const usernameAccount = source === 'upcodes' ? UPCODES_USERNAME_ACCOUNT : LINK_USERNAME_ACCOUNT
  const passwordAccount = source === 'upcodes' ? UPCODES_PASSWORD_ACCOUNT : LINK_PASSWORD_ACCOUNT
  return options.host.retrieve(source, {
    ask,
    profileDir: source === 'upcodes' ? upcodesProfileDir() : browserProfileDir(),
    username: await store.get(usernameAccount),
    password: await store.get(passwordAccount),
    allowHeaded: canShowBrowser() && process.env.CODE_PULL_SMOKE !== '1',
    fixture: process.env.CODE_PULL_SMOKE === '1',
  })
}

function registerSiteLogin(
  options: { getStore: () => Promise<SecretStore>; host: BrowserHost },
  site: {
    channel: 'link' | 'upcodes'
    usernameAccount: string
    passwordAccount: string
    profileDir: () => string
    source: SourceId
    usernamePrompt: string
  },
) {
  ipcMain.handle(`${site.channel}:status`, () => readSiteStatus(options.getStore, site))
  ipcMain.handle(`${site.channel}:save`, async (_event, raw: unknown) => {
    const username = typeof (raw as { username?: unknown } | null)?.username === 'string' ? (raw as { username: string }).username.trim() : ''
    const password = typeof (raw as { password?: unknown } | null)?.password === 'string' ? (raw as { password: string }).password.trim() : ''
    if (!username) {
      return { username: null, hasPassword: false, profilePath: site.profileDir(), detail: site.usernamePrompt }
    }
    try {
      const store = await options.getStore()
      await store.set(username, site.usernameAccount)
      if (password) await store.set(password, site.passwordAccount)
      else await store.delete(site.passwordAccount)
      return readSiteStatus(options.getStore, site)
    } catch (error) {
      return { username: null, hasPassword: false, profilePath: site.profileDir(), detail: error instanceof Error ? error.message : String(error) }
    }
  })
  ipcMain.handle(`${site.channel}:clear`, async () => {
    try {
      const store = await options.getStore()
      await store.delete(site.usernameAccount)
      await store.delete(site.passwordAccount)
      return readSiteStatus(options.getStore, site)
    } catch (error) {
      return { username: null, hasPassword: false, profilePath: site.profileDir(), detail: error instanceof Error ? error.message : String(error) }
    }
  })
  ipcMain.handle(`${site.channel}:signIn`, async () => {
    try {
      const store = await options.getStore()
      return options.host.signIn(site.source, {
        profileDir: site.profileDir(),
        username: await store.get(site.usernameAccount),
        password: await store.get(site.passwordAccount),
        allowHeaded: canShowBrowser() && process.env.CODE_PULL_SMOKE !== '1',
        fixture: process.env.CODE_PULL_SMOKE === '1',
      })
    } catch (error) {
      return { signedIn: false, message: error instanceof Error ? error.message : String(error) }
    }
  })
}

async function readSiteStatus(
  getStore: () => Promise<SecretStore>,
  site: { usernameAccount: string; passwordAccount: string; profileDir: () => string },
): Promise<LinkStatus> {
  try {
    const store = await getStore()
    return {
      username: await store.get(site.usernameAccount),
      hasPassword: Boolean(await store.get(site.passwordAccount)),
      profilePath: site.profileDir(),
      detail: null,
    }
  } catch (error) {
    return {
      username: null,
      hasPassword: false,
      profilePath: site.profileDir(),
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
