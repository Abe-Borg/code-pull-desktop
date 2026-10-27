import type { PageSnapshot } from '../nfpa-link/interpret'
import { mapLaunchError, type LinkDriver, type LinkSession } from '../nfpa-link/session'
import type { SourceRetrieval } from '../types'
import { readUpcodesPage, upcodesRetrieval } from './interpret'
import { parseUpcodesTarget, UPCODES_HOME, upcodesUrls, type UpcodesTarget } from './target'

const SIGN_IN_POLL_MS = 2_000
const SIGN_IN_BUDGET_MS = 180_000

export async function retrieveUpcodesSection(options: {
  ask: string
  profileDir: string
  username: string | null
  password: string | null
  allowHeaded: boolean
  driver: LinkDriver
}): Promise<SourceRetrieval> {
  const parsed = parseUpcodesTarget(options.ask)
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
    return (await readCandidates(session, parsed.target, null, null)).retrieval
  } catch (error) {
    return mapLaunchError(error, options.password)
  } finally {
    await session?.close().catch(() => undefined)
  }
}

export async function signInToUpcodes(options: {
  profileDir: string
  username: string | null
  password: string | null
  allowHeaded: boolean
  driver: LinkDriver
}): Promise<{ signedIn: boolean; message: string }> {
  if (!options.allowHeaded) {
    return {
      signedIn: false,
      message: 'UpCodes sign-in needs a visible desktop. On Windows, use Settings in the Code Pull window.',
    }
  }
  let session: LinkSession | null = null
  try {
    session = await options.driver.open(options.profileDir, false)
    const result = await waitUntilSignedIn(session, options.username, options.password)
    return result.ok
      ? { signedIn: true, message: 'UpCodes session is stored in the browser profile on this computer.' }
      : { signedIn: false, message: result.message }
  } catch (error) {
    const retrieval = mapLaunchError(error, options.password)
    return { signedIn: false, message: retrieval.ok ? 'UpCodes sign-in failed.' : retrieval.message }
  } finally {
    await session?.close().catch(() => undefined)
  }
}

async function readCandidates(
  session: LinkSession,
  target: UpcodesTarget,
  username: string | null,
  password: string | null,
): Promise<{ done: boolean; retrieval: SourceRetrieval }> {
  let last = upcodesRetrieval(target, emptySnapshot(), { kind: 'missing' })
  let filled = false
  for (const url of upcodesUrls(target)) {
    await session.goto(url)
    let snapshot = await session.snapshot()
    let read = readUpcodesPage(target.section, snapshot)
    if ((read.kind === 'login' || read.kind === 'loading') && !filled && username && password) {
      filled = true
      if (await session.tryFillLogin(username, password)) {
        snapshot = await session.snapshot()
        read = readUpcodesPage(target.section, snapshot)
      }
    }
    if (read.kind === 'section') return { done: true, retrieval: upcodesRetrieval(target, snapshot, read) }
    if (read.kind === 'login' || read.kind === 'loading') {
      return { done: false, retrieval: upcodesRetrieval(target, snapshot, read) }
    }
    last = upcodesRetrieval(target, snapshot, read)
  }
  return { done: true, retrieval: last }
}

async function waitUntilSignedIn(
  session: LinkSession,
  username: string | null,
  password: string | null,
): Promise<SourceRetrieval> {
  await session.goto(UPCODES_HOME)
  if (username && password) await session.tryFillLogin(username, password)
  const started = Date.now()
  let last = await session.snapshot()
  while (Date.now() - started < SIGN_IN_BUDGET_MS) {
    const read = readUpcodesPage('__code_pull_no_section__', last)
    if (read.kind !== 'login' && read.kind !== 'loading') {
      return { ok: true, quotedText: '', citation: { edition: '', section: '', urlOrPath: last.url } }
    }
    await delay(SIGN_IN_POLL_MS)
    last = await session.snapshot()
  }
  return {
    ok: false,
    code: 'not-signed-in',
    message: 'The sign-in window stayed on the UpCodes login. Finish signing in with your own account, then pull the section again.',
  }
}

function emptySnapshot(): PageSnapshot {
  return { url: UPCODES_HOME, title: '', bodyText: '', status: null }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
