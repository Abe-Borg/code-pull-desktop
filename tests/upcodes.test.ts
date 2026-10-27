import assert from 'node:assert/strict'
import * as path from 'node:path'
import { describe, it } from 'node:test'
import type { PageSnapshot } from '../adapters/nfpa-link/interpret'
import type { LinkDriver, LinkSession } from '../adapters/nfpa-link/session'
import { upcodesProfileDir } from '../adapters/nfpa-link/profile'
import { readUpcodesPage } from '../adapters/upcodes/interpret'
import { retrieveUpcodesSection } from '../adapters/upcodes/session'
import { parseUpcodesTarget, upcodesUrls } from '../adapters/upcodes/target'

const SECTION_BODY = [
  '1005.3.1 Fixture egress width.',
  'FIXTURE The required capacity of this means of egress in the adapter test is sample text and is not publisher language.',
  '1005.3.2 Next fixture.',
].join('\n')

describe('UpCodes target', () => {
  it('builds viewer urls for an IBC section', () => {
    const parsed = parseUpcodesTarget('IBC 2021 section 1005.3.1 means of egress')
    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    assert.equal(parsed.target.edition, 'IBC (2021)')
    assert.equal(upcodesUrls(parsed.target)[0], 'https://up.codes/viewer/ibc-2021/chapter/10#1005.3.1')
  })

  it('asks for a year and section when the ask is only a code name', () => {
    const parsed = parseUpcodesTarget('look up the IRC')
    assert.equal(parsed.ok, false)
  })
})

describe('UpCodes profile', () => {
  it('keeps a separate profile next to LiNK', () => {
    const dir = upcodesProfileDir({
      platform: 'win32',
      env: { LOCALAPPDATA: 'C:\\Users\\ada\\AppData\\Local' },
      homedir: 'C:\\Users\\ada',
    })
    assert.equal(dir, path.win32.join('C:\\Users\\ada\\AppData\\Local', 'CodePullDesktop', 'browser-profile-upcodes'))
  })
})

describe('UpCodes page reader', () => {
  it('treats a sign-in wall as a failure', () => {
    const read = readUpcodesPage('1005.3.1', {
      url: 'https://up.codes/login',
      title: 'Sign in',
      bodyText: 'Sign in to UpCodes to continue.',
      status: 200,
    })
    assert.deepEqual(read, { kind: 'login', captcha: false })
  })

  it('quotes the section when the page contains it', () => {
    const read = readUpcodesPage('1005.3.1', {
      url: 'https://up.codes/viewer/ibc-2021/chapter/10#1005.3.1',
      title: '1005.3.1',
      bodyText: SECTION_BODY,
      status: 200,
    })
    assert.equal(read.kind, 'section')
    if (read.kind === 'section') {
      assert.match(read.quotedText, /FIXTURE/)
      assert.equal(read.quotedText.includes('1005.3.2'), false)
    }
  })
})

describe('UpCodes session', () => {
  it('returns a sign-in failure without opening a visible window', async () => {
    const log: string[] = []
    const result = await retrieveUpcodesSection({
      ask: 'IBC 2021 section 1005.3.1',
      profileDir: '/tmp/code-pull-upcodes',
      username: null,
      password: null,
      allowHeaded: false,
      driver: scripted({ true: [loginPage()], false: [] }, log),
    })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.code, 'not-signed-in')
      assert.match(result.message, /sign-in/)
    }
    assert.equal(log.some((entry) => entry.startsWith('headed:')), false)
  })

  it('reports a missing section', async () => {
    const missing = publicationPage()
    const result = await retrieveUpcodesSection({
      ask: 'IFC 2021 section 903.2',
      profileDir: '/tmp/code-pull-upcodes',
      username: null,
      password: null,
      allowHeaded: false,
      driver: scripted({ true: [missing, { ...missing }, { ...missing }, { ...missing }], false: [] }, []),
    })
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.code, 'not-found')
  })
})

function scripted(plan: { true: PageSnapshot[]; false: PageSnapshot[] }, log: string[]): LinkDriver {
  return {
    async open(_profileDir: string, headless: boolean): Promise<LinkSession> {
      const queue = plan[headless ? 'true' : 'false']
      return {
        async goto(url: string) {
          log.push(`${headless ? 'headless' : 'headed'}:${url}`)
        },
        async snapshot() {
          const next = queue.shift()
          if (!next) throw new Error('scripted session ran out of snapshots')
          return next
        },
        async tryFillLogin() {
          return false
        },
        async close() {
          log.push('close')
        },
      }
    },
  }
}

function loginPage(): PageSnapshot {
  return { url: 'https://up.codes/login', title: 'Sign in', bodyText: 'Sign in to UpCodes to continue.', status: 200 }
}

function publicationPage(): PageSnapshot {
  return {
    url: 'https://up.codes/viewer/ifc-2021',
    title: 'IFC 2021',
    bodyText: 'International Fire Code table of contents. Chapter 1 Scope. Chapter 2 Definitions.',
    status: 200,
  }
}
