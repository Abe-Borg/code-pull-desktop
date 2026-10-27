import { excerptAround, type PageRead, type PageSnapshot } from '../nfpa-link/interpret'
import type { SourceRetrieval } from '../types'
import type { UpcodesTarget } from './target'

const CAPTCHA = /captcha|verify you are human|are you a robot|i'm not a robot/i
const LOGIN_TEXT = /sign in|log in|sign up|create an account|create a free account|start your free|upgrade to view|subscribe/i
const PAYWALL = /sign in to (?:read|view|continue)|upgrade to view|subscribe to read|create a free account to view/i
const LOADING = /loading/i

export function readUpcodesPage(section: string, snapshot: PageSnapshot): PageRead {
  const body = snapshot.bodyText.replace(/\r/g, '').trim()
  if (snapshot.status === 404 || snapshot.status === 410) return { kind: 'missing' }
  if (CAPTCHA.test(body) || CAPTCHA.test(snapshot.title)) return { kind: 'login', captcha: true }

  const quoted = excerptAround(body, section)
  if (quoted && quoted.length >= 80 && !PAYWALL.test(quoted)) return { kind: 'section', quotedText: quoted }

  if (isLoginUrl(snapshot.url) || LOGIN_TEXT.test(body) || LOGIN_TEXT.test(snapshot.title)) {
    return { kind: 'login', captcha: false }
  }
  if (!body || (LOADING.test(body) && body.length < 80)) return { kind: 'loading' }
  return { kind: 'missing' }
}

export function upcodesRetrieval(target: UpcodesTarget, snapshot: PageSnapshot, read: PageRead): SourceRetrieval {
  if (read.kind === 'section') {
    return {
      ok: true,
      quotedText: read.quotedText,
      citation: {
        edition: target.edition,
        section: target.section,
        urlOrPath: snapshot.url.startsWith('http') ? snapshot.url : upcodesFallback(target),
      },
    }
  }
  if (read.kind === 'login') {
    return {
      ok: false,
      code: 'not-signed-in',
      message: read.captcha
        ? 'UpCodes asked for a CAPTCHA. Open the sign-in window, finish it with your own UpCodes account, then pull the section again.'
        : 'UpCodes needs your sign-in. Open Settings, choose Open UpCodes sign-in, and use your own UpCodes account. The session stays in the browser profile on this computer.',
    }
  }
  if (read.kind === 'loading') {
    return {
      ok: false,
      code: 'not-signed-in',
      message: 'UpCodes did not finish loading. Sign in with your UpCodes account, then pull the section again.',
    }
  }
  return {
    ok: false,
    code: 'not-found',
    message: `UpCodes did not show ${target.edition} section ${target.section}. Check the number, the edition year, and that your account includes this code.`,
  }
}

function isLoginUrl(url: string): boolean {
  return /\/(?:login|signin|sign-in|sign_up|signup|auth|accounts)(?:\/|$|\?)/i.test(url)
}

function upcodesFallback(target: UpcodesTarget): string {
  return `https://up.codes/viewer/${target.code.slug}-${target.year}#${encodeURIComponent(target.section)}`
}
