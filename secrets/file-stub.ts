import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { SECRET_ACCOUNT, type SecretStore } from './types'

/**
 * Development stand-in for Windows Credential Manager.
 * The file is mode 0600 under the app user-data directory.
 * Production Windows builds use KeytarSecretStore instead.
 */
export class FileStubSecretStore implements SecretStore {
  readonly backend = 'file-stub' as const

  constructor(private readonly directory: string) {}

  location(account: string = SECRET_ACCOUNT): string {
    return path.join(this.directory, account)
  }

  async get(account: string = SECRET_ACCOUNT): Promise<string | null> {
    try {
      const value = (await fs.readFile(this.location(account), 'utf8')).trim()
      return value || null
    } catch (error) {
      if (isMissing(error)) return null
      throw error
    }
  }

  async set(secret: string, account: string = SECRET_ACCOUNT): Promise<void> {
    await fs.mkdir(this.directory, { recursive: true, mode: 0o700 })
    await fs.chmod(this.directory, 0o700)
    const file = this.location(account)
    await fs.writeFile(file, `${secret}\n`, { mode: 0o600 })
    await fs.chmod(file, 0o600)
  }

  async delete(account: string = SECRET_ACCOUNT): Promise<void> {
    try {
      await fs.unlink(this.location(account))
    } catch (error) {
      if (isMissing(error)) return
      throw error
    }
  }
}

function isMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}
