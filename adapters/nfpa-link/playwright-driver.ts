import * as fs from 'node:fs/promises'
import type { PageSnapshot } from './interpret'
import type { LinkDriver, LinkSession } from './session'

interface PlaywrightPage {
  goto(url: string, options: { waitUntil: 'domcontentloaded'; timeout: number }): Promise<{ status(): number } | null>
  url(): string
  title(): Promise<string>
  locator(selector: string): {
    innerText(options?: { timeout: number }): Promise<string>
    count(): Promise<number>
    first(): { fill(value: string): Promise<void>; click(): Promise<void> }
  }
  waitForFunction(pageFunction: () => boolean, options: { timeout: number }): Promise<unknown>
}

interface PlaywrightContext {
  pages(): PlaywrightPage[]
  newPage(): Promise<PlaywrightPage>
  close(): Promise<void>
}

interface PlaywrightModule {
  chromium: {
    launchPersistentContext(userDataDir: string, options: Record<string, unknown>): Promise<PlaywrightContext>
  }
}

export function createPlaywrightDriver(): LinkDriver {
  return {
    async open(profileDir: string, headless: boolean): Promise<LinkSession> {
      await fs.mkdir(profileDir, { recursive: true, mode: 0o700 })
      const playwright = await loadPlaywright()
      const context = await playwright.chromium.launchPersistentContext(profileDir, {
        headless,
        viewport: { width: 1280, height: 900 },
        locale: 'en-US',
        args: process.platform === 'linux' ? ['--disable-dev-shm-usage', '--no-sandbox'] : [],
      })
      const page = context.pages()[0] ?? (await context.newPage())
      return new PlaywrightLinkSession(context, page)
    },
  }
}

class PlaywrightLinkSession implements LinkSession {
  private lastStatus: number | null = null

  constructor(
    private readonly context: PlaywrightContext,
    private readonly page: PlaywrightPage,
  ) {}

  async goto(url: string): Promise<void> {
    const response = await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    this.lastStatus = response?.status() ?? null
    await this.page
      .waitForFunction(
        () => {
          const text = document.body?.innerText ?? ''
          return !/loading session/i.test(text) || text.length > 400
        },
        { timeout: 20_000 },
      )
      .catch(() => undefined)
  }

  async snapshot(): Promise<PageSnapshot> {
    const bodyText = await this.page
      .locator('body')
      .innerText({ timeout: 10_000 })
      .catch(() => '')
    return {
      url: this.page.url(),
      title: await this.page.title().catch(() => ''),
      bodyText,
      status: this.lastStatus,
    }
  }

  async tryFillLogin(username: string, password: string): Promise<boolean> {
    const user = await firstLocator(this.page, [
      'input[type="email"]',
      'input[name="username"]',
      'input[name="email"]',
      'input[autocomplete="username"]',
    ])
    const pass = await firstLocator(this.page, ['input[type="password"]'])
    if (!user || !pass) return false
    await user.fill(username)
    await pass.fill(password)
    const submit = await firstLocator(this.page, ['button[type="submit"]', 'input[type="submit"]'])
    if (submit) await submit.click()
    await delay(1500)
    return true
  }

  async close(): Promise<void> {
    await this.context.close()
  }
}

async function firstLocator(page: PlaywrightPage, selectors: string[]) {
  for (const selector of selectors) {
    const locator = page.locator(selector)
    if ((await locator.count().catch(() => 0)) > 0) return locator.first()
  }
  return null
}

async function loadPlaywright(): Promise<PlaywrightModule> {
  const importer = new Function('specifier', 'return import(specifier)') as (
    specifier: string,
  ) => Promise<PlaywrightModule>
  return importer('playwright')
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
