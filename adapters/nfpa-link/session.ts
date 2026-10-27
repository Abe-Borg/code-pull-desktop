import type { SourceRetrieval } from '../types'
import { readLinkPage, retrievalFromRead, type PageSnapshot } from './interpret'
import { LINK_HOME, linkUrls, parseNfpaTarget, type NfpaTarget } from './target'

export interface LinkSession {
  goto(url: string): Promise<void>
  snapshot(): Promise<PageSnapshot>
  tryFillLogin(username: string, password: string): Promise<boolean>
  close(): Promise<void>
}

export interface LinkDriver {
  open(profileDir: string, headless: boolean): Promise<LinkSession>
}

const SIGN_IN_POLL_MS = 2_000
const SIGN_IN_BUDGET_MS = 180_000

export async function retrieveNfpaLink(options: {
  ask: string
  profileDir: string
  username: string | null
  password: string | null
  allowHeaded: boolean
  driver: LinkDriver
}): Promise<SourceRetrieval> {
  const parsed = parseNfpaTarget(options.ask)
  if (!parsed.ok) return { ok: false, code: 'needs-detail', message: parsed.message }

  let session: LinkSession | null = null
  try {
    session = await options.driver.open(options.profileDir, true)
    const headless = await readCandidates(session, parsed.target, options.username, options.password)
    if (headless.done || !options.allowHeaded) return headless.retrieval

    await session.close()
    session = await options.driver.open(options.profileDir, false)
    const signedIn = await waitUntilSignedIn(session, options.username, options.password)
    if (!signedIn.ok) return signedIn
    const headed = await readCandidates(session, parsed.target, null, null)
    return headed.retrieval
  } catch (error) {
    return mapLaunchError(error, options.password)
  } finally {
    await session?.close().catch(() => undefined)
  }
}

export async function signInToNfpaLink(options: {
  profileDir: string
  username: string | null
  password: string | null
  allowHeaded: boolean
  driver: LinkDriver
}): Promise<{ signedIn: boolean; message: string }> {
  if (!options.allowHeaded) {
    return {
      signedIn: false,
      message: 'NFPA LiNK sign-in needs a visible desktop. On Windows, use Settings in the Code Pull window.',
    }
  }

  let session: LinkSession | null = null
  try {
    session = await options.driver.open(options.profileDir, false)
    const result = await waitUntilSignedIn(session, options.username, options.password)
    return result.ok
      ? { signedIn: true, message: 'NFPA LiNK session is stored in the browser profile on this computer.' }
      : { signedIn: false, message: result.message }
  } catch (error) {
    const retrieval = mapLaunchError(error, options.password)
    return { signedIn: false, message: retrieval.ok ? 'NFPA LiNK sign-in failed.' : retrieval.message }
  } finally {
    await session?.close().catch(() => undefined)
  }
}

async function readCandidates(
  session: LinkSession,
  target: NfpaTarget,
  username: string | null,
  password: string | null,
): Promise<{ done: boolean; retrieval: SourceRetrieval }> {
  let last: SourceRetrieval = {
    ok: false,
    code: 'not-found',
    message: `NFPA LiNK did not show ${target.edition} section ${target.section}. Check the number, the edition year, and that your subscription includes this publication.`,
  }
  let filled = false

  for (const url of linkUrls(target)) {
    await session.goto(url)
    let snapshot = await session.snapshot()
    let read = readLinkPage(target.section, snapshot)

    if ((read.kind === 'login' || read.kind === 'loading') && !filled && username && password) {
      filled = true
      const submitted = await session.tryFillLogin(username, password)
      if (submitted) {
        snapshot = await session.snapshot()
        read = readLinkPage(target.section, snapshot)
      }
    }

    if (read.kind === 'section') {
      return { done: true, retrieval: retrievalFromRead(target, snapshot, read) }
    }

    if (read.kind === 'login' || read.kind === 'loading') {
      return { done: false, retrieval: retrievalFromRead(target, snapshot, read) }
    }

    last = retrievalFromRead(target, snapshot, read)
  }

  return { done: true, retrieval: last }
}

async function waitUntilSignedIn(
  session: LinkSession,
  username: string | null,
  password: string | null,
): Promise<SourceRetrieval> {
  await session.goto(LINK_HOME)
  if (username && password) await session.tryFillLogin(username, password)

  const started = Date.now()
  let last = await session.snapshot()
  while (Date.now() - started < SIGN_IN_BUDGET_MS) {
    const read = readLinkPage('__code_pull_no_section__', last)
    if (read.kind !== 'login' && read.kind !== 'loading') return { ok: true, quotedText: '', citation: { edition: '', section: '', urlOrPath: last.url } }
    await delay(SIGN_IN_POLL_MS)
    last = await session.snapshot()
  }

  return {
    ok: false,
    code: 'not-signed-in',
    message:
      'The sign-in window stayed on the NFPA LiNK login. Finish signing in with your own account, then pull the section again.',
  }
}

export function mapLaunchError(error: unknown, password: string | null): SourceRetrieval {
  const raw = error instanceof Error ? error.message : String(error)
  const message = redactSecret(raw, password)
  if (/executable doesn't exist|Executable doesn't exist|Failed to launch|browserType\.launchPersistentContext/i.test(message)) {
    return {
      ok: false,
      code: 'browser-missing',
      message: 'Playwright Chromium is not installed. Run npx playwright install chromium, then pull the section again.',
    }
  }
  return { ok: false, code: 'navigation-error', message: `NFPA LiNK could not be opened. ${message}` }
}

function redactSecret(message: string, password: string | null): string {
  if (!password || password.length < 4) return message
  return message.split(password).join('••••')
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
