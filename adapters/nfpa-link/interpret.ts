import type { SourceRetrieval } from '../types'
import type { NfpaTarget } from './target'

export interface PageSnapshot {
  url: string
  title: string
  bodyText: string
  status: number | null
}

export type PageRead =
  | { kind: 'section'; quotedText: string }
  | { kind: 'login'; captcha: boolean }
  | { kind: 'missing' }
  | { kind: 'loading' }

const CAPTCHA = /captcha|verify you are human|are you a robot|i'm not a robot/i
const LOGIN_TEXT = /sign in|log in|create account|subscribe to nfpa|start your (?:free )?trial|purchase access/i
const PAYWALL = /sign in to (?:read|view|continue)|subscribe to read|purchase access|subscription required/i
const LOADING = /loading session/i

export function readLinkPage(section: string, snapshot: PageSnapshot): PageRead {
  const body = snapshot.bodyText.replace(/\r/g, '').trim()
  if (snapshot.status === 404 || snapshot.status === 410) return { kind: 'missing' }
  if (CAPTCHA.test(body) || CAPTCHA.test(snapshot.title)) return { kind: 'login', captcha: true }

  const quoted = excerptAround(body, section)
  if (quoted && quoted.length >= 80 && !PAYWALL.test(quoted)) return { kind: 'section', quotedText: quoted }

  if (isLoginUrl(snapshot.url) || LOGIN_TEXT.test(body) || LOGIN_TEXT.test(snapshot.title)) {
    return { kind: 'login', captcha: false }
  }

  if (!body || (LOADING.test(body) && body.length < 400)) return { kind: 'loading' }
  return { kind: 'missing' }
}

export function retrievalFromRead(target: NfpaTarget, snapshot: PageSnapshot, read: PageRead): SourceRetrieval {
  if (read.kind === 'section') {
    return {
      ok: true,
      quotedText: read.quotedText,
      citation: {
        edition: target.edition,
        section: target.section,
        urlOrPath: snapshot.url.startsWith('http') ? snapshot.url : linkFallback(target),
      },
    }
  }

  if (read.kind === 'login') {
    return {
      ok: false,
      code: 'not-signed-in',
      message: read.captcha
        ? 'NFPA LiNK asked for a CAPTCHA. Open the sign-in window, finish it with your own LiNK account, then pull the section again.'
        : 'NFPA LiNK needs your sign-in. Open Settings, choose Open NFPA LiNK sign-in, and use your own LiNK account. The session stays in the browser profile on this computer.',
    }
  }

  if (read.kind === 'loading') {
    return {
      ok: false,
      code: 'not-signed-in',
      message:
        'NFPA LiNK stayed on the session loader. Sign in with your LiNK account, then pull the section again.',
    }
  }

  return {
    ok: false,
    code: 'not-found',
    message: `NFPA LiNK did not show ${target.edition} section ${target.section}. Check the number, the edition year, and that your subscription includes this publication.`,
  }
}

export function excerptAround(body: string, section: string): string | null {
  const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const heading = new RegExp(`(?:^|\\n)\\s*${escaped}\\b[^\\n]*`, 'i')
  const match = heading.exec(body)
  if (!match) {
    const index = body.toLowerCase().indexOf(section.toLowerCase())
    if (index < 0) return null
    return clip(body.slice(index, index + 900))
  }

  const start = match.index === 0 ? 0 : match.index + 1
  const rest = body.slice(start + match[0].trimStart().length)
  const next = rest.search(/\n\s*\d+(?:\.\d+)+\b/)
  const end = next >= 0 ? start + match[0].trimStart().length + next : start + 1200
  return clip(body.slice(start, end))
}

function clip(value: string): string {
  return value.replace(/[ \t]+\n/g, '\n').trim().slice(0, 1500)
}

function isLoginUrl(url: string): boolean {
  return /\/(?:login|signin|sign-in|auth)(?:\/|$|\?)/i.test(url) || /accounts\.nfpa\.org/i.test(url)
}

function linkFallback(target: NfpaTarget): string {
  return `https://link.nfpa.org/publications/${target.code}/${target.year}/sections/${target.section}`
}
