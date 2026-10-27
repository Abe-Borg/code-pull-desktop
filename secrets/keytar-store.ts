import { SECRET_ACCOUNT, SECRET_SERVICE, type KeytarModule, type SecretStore } from './types'

export class KeytarSecretStore implements SecretStore {
  readonly backend = 'credential-manager' as const

  constructor(private readonly keytar: KeytarModule) {}

  location(): string {
    return `Windows Credential Manager (${SECRET_SERVICE} / ${SECRET_ACCOUNT})`
  }

  get(): Promise<string | null> {
    return this.keytar.getPassword(SECRET_SERVICE, SECRET_ACCOUNT)
  }

  async set(secret: string): Promise<void> {
    await this.keytar.setPassword(SECRET_SERVICE, SECRET_ACCOUNT, secret)
  }

  async delete(): Promise<void> {
    await this.keytar.deletePassword(SECRET_SERVICE, SECRET_ACCOUNT)
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
