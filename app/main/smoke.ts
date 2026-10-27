import * as fs from 'node:fs'
import * as path from 'node:path'
import type { BrowserWindow } from 'electron'

export async function runSmoke(win: BrowserWindow, artifactDir: string): Promise<void> {
  fs.mkdirSync(artifactDir, { recursive: true })
  await waitForText(win, 'Paste your Claude API key')
  await capture(win, path.join(artifactDir, 'onboarding.png'))

  await win.webContents.executeJavaScript(`
    (() => {
      const input = document.querySelector('[data-testid="key-input"]')
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      setter?.call(input, 'sk-ant-smoke-test-key-1234')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      document.querySelector('[data-testid="save-key"]').click()
    })()
  `)

  await waitForText(win, 'Pull sections')
  assertSecretFile()
  await win.webContents.executeJavaScript(`
    (() => {
      document.querySelector('[data-testid="mode-list"]').click()
      const input = document.querySelector('[data-testid="ask-input"]')
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
      setter?.call(input, 'NFPA 101 2021 section 7.2.1\\nIBC 2021 section 1005.3.1\\nWhat is the weather in Paris?')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      document.querySelector('[data-testid="pull"]').click()
    })()
  `)

  await waitForText(win, 'https://link.nfpa.org/publications/101/2021/sections/7.2.1')
  await waitForText(win, 'https://up.codes/viewer/ibc-2021/chapter/10#1005.3.1')
  await waitForText(win, 'Unsupported')

  const cards = (await win.webContents.executeJavaScript(`
    (() => [...document.querySelectorAll('[data-testid="answer-card"]')].map((el) => ({
      source: el.querySelector('[data-testid="answer-source"]')?.textContent ?? '',
      quote: el.querySelector('[data-testid="answer-quote"]')?.textContent ?? '',
      edition: el.querySelector('[data-testid="answer-edition"]')?.textContent ?? '',
      section: el.querySelector('[data-testid="answer-section"]')?.textContent ?? '',
      path: el.querySelector('[data-testid="answer-path"]')?.textContent ?? '',
      failure: el.querySelector('[data-testid="answer-failure"]')?.textContent ?? '',
    })))()
  `)) as Array<{ source: string; quote: string; edition: string; section: string; path: string; failure: string }>

  const link = cards.find((card) => card.path.includes('https://link.nfpa.org/publications/101/2021/sections/7.2.1'))
  if (!link) throw new Error(`Smoke did not render a LiNK card. ${JSON.stringify(cards)}`)
  if (!link.quote.includes('FIXTURE')) throw new Error('LiNK smoke card is missing the fixture excerpt.')
  if (!link.source.includes('NFPA LiNK')) throw new Error(`Unexpected source label: ${link.source}`)
  if (!link.edition.includes('NFPA 101 (2021)')) throw new Error(`Unexpected edition: ${link.edition}`)
  if (link.section.trim() !== '7.2.1') throw new Error(`Unexpected section: ${link.section}`)

  const upcodes = cards.find((card) => card.path.includes('https://up.codes/viewer/ibc-2021/chapter/10#1005.3.1'))
  if (!upcodes) throw new Error(`Smoke did not render an UpCodes card. ${JSON.stringify(cards)}`)
  if (!upcodes.quote.includes('FIXTURE')) throw new Error('UpCodes smoke card is missing the fixture excerpt.')
  if (!upcodes.source.includes('UpCodes')) throw new Error(`Unexpected UpCodes label: ${upcodes.source}`)
  if (!upcodes.edition.includes('IBC (2021)')) throw new Error(`Unexpected UpCodes edition: ${upcodes.edition}`)
  if (upcodes.section.trim() !== '1005.3.1') throw new Error(`Unexpected UpCodes section: ${upcodes.section}`)

  const unsupported = cards.find((card) => card.failure.includes('Unsupported'))
  if (!unsupported) throw new Error('Smoke did not render an unsupported card.')

  const host = await waitForHost(win)

  await capture(win, path.join(artifactDir, 'answers.png'))
  console.log(`SMOKE_OK host=${JSON.stringify(host)}`)
}

function assertSecretFile(): void {
  const userData = process.env.CODE_PULL_SMOKE_USER_DATA
  if (!userData) throw new Error('Smoke user-data path was not set.')
  const secretPath = path.join(userData, 'secrets', 'claude-api-key')
  const mode = fs.statSync(secretPath).mode & 0o777
  if (mode !== 0o600) throw new Error(`Secret file mode is ${mode.toString(8)}, expected 600.`)
  const stored = fs.readFileSync(secretPath, 'utf8').trim()
  if (!stored.startsWith('sk-ant-')) throw new Error('Secret file did not contain a Claude key.')
}

async function waitForHost(win: BrowserWindow): Promise<string> {
  const started = Date.now()
  let last = ''
  while (Date.now() - started < 20_000) {
    last = await win.webContents.executeJavaScript(
      `document.querySelector('[data-testid="host-status"]')?.textContent ?? ''`,
    )
    if (
      typeof last === 'string' &&
      last.includes('Source browser:') &&
      !last.includes('Checking the Playwright host')
    ) {
      return last.trim()
    }
    await delay(150)
  }
  throw new Error(`Browser host status did not resolve. ${last}`)
}

async function waitForText(win: BrowserWindow, text: string): Promise<void> {
  const started = Date.now()
  let last = ''
  while (Date.now() - started < 20_000) {
    last = await win.webContents.executeJavaScript('document.body ? document.body.innerText : ""')
    if (typeof last === 'string' && last.includes(text)) return
    await delay(150)
  }
  throw new Error(`Timed out waiting for "${text}". Last text:\n${last}`)
}

async function capture(win: BrowserWindow, file: string): Promise<void> {
  const image = await win.webContents.capturePage()
  fs.writeFileSync(file, image.toPNG())
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
