import assert from 'node:assert/strict'
import * as path from 'node:path'
import { describe, it } from 'node:test'
import { handleHostRequest } from '../adapters/nfpa-link/handle'
import { excerptAround, readLinkPage } from '../adapters/nfpa-link/interpret'
import { browserProfileDir } from '../adapters/nfpa-link/profile'
import { retrieveNfpaLink, type LinkDriver, type LinkSession } from '../adapters/nfpa-link/session'
import { linkUrls, parseNfpaTarget } from '../adapters/nfpa-link/target'
import type { PageSnapshot } from '../adapters/nfpa-link/interpret'

const SECTION_BODY = [
  '7.2.1 Fixture egress.',
  'FIXTURE The means of egress in this adapter test is sample text for the card and is not publisher language from any NFPA document.',
  '7.2.2 Next fixture.',
].join('\n')

describe('NFPA target', () => {
  it('builds LiNK urls from a publication, year, and section', () => {
    const parsed = parseNfpaTarget('NFPA 101 2021 section 7.2.1 means of egress')
    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    assert.equal(parsed.target.edition, 'NFPA 101 (2021)')
    assert.deepEqual(linkUrls(parsed.target), [
      'https://link.nfpa.org/publications/101/2021/sections/7.2.1',
      'https://link.nfpa.org/publications/101/2021/chapters/7',
      'https://link.nfpa.org/publications/101/2021',
    ])
  })

  it('asks for the edition year and section when either is missing', () => {
    const parsed = parseNfpaTarget('NFPA 101 means of egress')
    assert.equal(parsed.ok, false)
    if (parsed.ok) return
    assert.match(parsed.message, /edition year/)
  })
})

describe('browser profile path', () => {
  it('uses LOCALAPPDATA on Windows', () => {
    const dir = browserProfileDir({
      platform: 'win32',
      env: { LOCALAPPDATA: 'C:\\Users\\ada\\AppData\\Local' },
      homedir: 'C:\\Users\\ada',
    })
    assert.equal(
      dir,
      path.win32.join('C:\\Users\\ada\\AppData\\Local', 'CodePullDesktop', 'browser-profile'),
    )
  })

  it('uses the XDG data home on Linux', () => {
    const dir = browserProfileDir({
      platform: 'linux',
      env: {},
      homedir: '/home/ada',
    })
    assert.equal(dir, '/home/ada/.local/share/CodePullDesktop/browser-profile')
  })
})

describe('LiNK page reader', () => {
  it('quotes the named section and stops before the next one', () => {
    const quote = excerptAround(SECTION_BODY, '7.2.1')
    assert.ok(quote)
    assert.match(quote ?? '', /FIXTURE/)
    assert.equal((quote ?? '').includes('7.2.2'), false)
  })

  it('reads a signed-out page as a sign-in failure', () => {
    const read = readLinkPage('7.2.1', {
      url: 'https://link.nfpa.org/login',
      title: 'Sign in',
      bodyText: 'Sign in to NFPA LiNK to continue.',
      status: 200,
    })
    assert.deepEqual(read, { kind: 'login', captcha: false })
  })

  it('reads a CAPTCHA page separately from a normal login', () => {
    const read = readLinkPage('7.2.1', {
      url: 'https://link.nfpa.org/challenge',
      title: 'Verify',
      bodyText: 'Verify you are human before continuing.',
      status: 200,
    })
    assert.deepEqual(read, { kind: 'login', captcha: true })
  })

  it('reads a publication page without the section as missing', () => {
    const read = readLinkPage('7.2.1', {
      url: 'https://link.nfpa.org/publications/101/2021',
      title: 'NFPA 101',
      bodyText: 'NFPA 101 table of contents. Chapter 1 Administration. Chapter 2 Referenced publications.',
      status: 200,
    })
    assert.equal(read.kind, 'missing')
  })
})

describe('LiNK session', () => {
  it('returns a sign-in failure without opening a visible window when headed mode is off', async () => {
    const log: string[] = []
    const result = await retrieveNfpaLink({
      ask: 'NFPA 101 2021 section 7.2.1',
      profileDir: '/tmp/code-pull-profile',
      username: null,
      password: null,
      allowHeaded: false,
      driver: scriptedDriver({ true: [loginPage()], false: [] }, log),
    })
    assert.equal(result.ok, false)
    if (!result.ok) assert.match(result.message, /sign-in/)
    assert.equal(log.some((entry) => entry.startsWith('headed:')), false)
  })

  it('opens a visible window after a headless login wall and then reads the section', async () => {
    const log: string[] = []
    const result = await retrieveNfpaLink({
      ask: 'NFPA 101 2021 section 7.2.1',
      profileDir: '/tmp/code-pull-profile',
      username: null,
      password: null,
      allowHeaded: true,
      driver: scriptedDriver(
        {
          true: [loginPage()],
          false: [signedInHome(), sectionPage()],
        },
        log,
      ),
    })
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.match(result.quotedText, /FIXTURE/)
      assert.equal(result.citation.section, '7.2.1')
      assert.equal(result.citation.urlOrPath, 'https://link.nfpa.org/publications/101/2021/sections/7.2.1')
    }
    assert.equal(log.some((entry) => entry.startsWith('headed:')), true)
  })

  it('reports a missing section after the candidate pages do not contain it', async () => {
    const missing = publicationPage()
    const result = await retrieveNfpaLink({
      ask: 'NFPA 101 2021 section 7.2.1',
      profileDir: '/tmp/code-pull-profile',
      username: null,
      password: null,
      allowHeaded: false,
      driver: scriptedDriver({ true: [missing, { ...missing }, { ...missing }], false: [] }, []),
    })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.code, 'not-found')
      assert.match(result.message, /7\.2\.1/)
    }
  })

  it('reports a missing Chromium install without pretending the section was read', async () => {
    const result = await retrieveNfpaLink({
      ask: 'NFPA 101 2021 section 7.2.1',
      profileDir: '/tmp/code-pull-profile',
      username: null,
      password: null,
      allowHeaded: false,
      driver: {
        async open() {
          throw new Error("browserType.launchPersistentContext: Executable doesn't exist at /ms-playwright/chromium")
        },
      },
    })
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.code, 'browser-missing')
  })
})

describe('host fixture', () => {
  it('answers a LiNK ask without launching Chromium', async () => {
    let opened = false
    const response = await handleHostRequest(
      {
        id: 'req-1',
        type: 'retrieve',
        ask: 'NFPA 101 2021 section 7.2.1',
        profileDir: '/tmp/unused',
        username: null,
        password: null,
        allowHeaded: false,
        fixture: true,
      },
      {
        chromiumStatus: async () => ({ ready: true, chromiumPath: null, detail: 'idle' }),
        driver: {
          async open() {
            opened = true
            throw new Error('opened')
          },
        },
      },
    )
    assert.equal(opened, false)
    assert.equal(response.type, 'retrieve-result')
    if (response.type === 'retrieve-result' && response.result.ok) {
      assert.match(response.result.quotedText, /FIXTURE/)
      assert.equal(response.result.citation.urlOrPath, 'https://link.nfpa.org/publications/101/2021/sections/7.2.1')
    } else {
      assert.fail('fixture did not return a section')
    }
  })
})

function scriptedDriver(plan: { true: PageSnapshot[]; false: PageSnapshot[] }, log: string[]): LinkDriver {
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
          log.push('fill')
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
  return {
    url: 'https://link.nfpa.org/login',
    title: 'Sign in',
    bodyText: 'Sign in to NFPA LiNK to continue.',
    status: 200,
  }
}

function signedInHome(): PageSnapshot {
  return {
    url: 'https://link.nfpa.org/',
    title: 'NFPA LiNK',
    bodyText: 'Your publications are ready.',
    status: 200,
  }
}

function sectionPage(): PageSnapshot {
  return {
    url: 'https://link.nfpa.org/publications/101/2021/sections/7.2.1',
    title: '7.2.1',
    bodyText: SECTION_BODY,
    status: 200,
  }
}

function publicationPage(): PageSnapshot {
  return {
    url: 'https://link.nfpa.org/publications/101/2021',
    title: 'NFPA 101',
    bodyText: 'NFPA 101 table of contents. Chapter 1 Administration. Chapter 2 Referenced publications.',
    status: 200,
  }
}
