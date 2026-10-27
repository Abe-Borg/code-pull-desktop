import { SECRET_ACCOUNT, SECRET_SERVICE, type KeytarModule, type SecretStore } from './types'

export class KeytarSecretStore implements SecretStore {
  readonly backend = 'credential-manager' as const

  constructor(private readonly keytar: KeytarModule) {}

  location(account: string = SECRET_ACCOUNT): string {
    return `Windows Credential Manager (${SECRET_SERVICE} / ${account})`
  }

  get(account: string = SECRET_ACCOUNT): Promise<string | null> {
    return this.keytar.getPassword(SECRET_SERVICE, account)
  }

  async set(secret: string, account: string = SECRET_ACCOUNT): Promise<void> {
    await this.keytar.setPassword(SECRET_SERVICE, account, secret)
  }

  async delete(account: string = SECRET_ACCOUNT): Promise<void> {
    await this.keytar.deletePassword(SECRET_SERVICE, account)
  }
}

export async function loadKeytar(): Promise<KeytarModule | null> {
  try {
    const importer = new Function('specifier', 'return import(specifier)') as (
      specifier: string,
    ) => Promise<KeytarModule & { default?: KeytarModule }>
    const loaded = await importer('keytar')
    if (typeof loaded.getPassword === 'function') return loaded
    if (loaded.default && typeof loaded.default.getPassword === 'function') return loaded.default
    return null
  } catch {
    return null
  }
}
