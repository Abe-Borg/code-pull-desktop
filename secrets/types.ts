export const SECRET_SERVICE = 'Code Pull Desktop'
export const SECRET_ACCOUNT = 'claude-api-key'

export interface KeytarModule {
  getPassword(service: string, account: string): Promise<string | null>
  setPassword(service: string, account: string, password: string): Promise<void>
  deletePassword(service: string, account: string): Promise<boolean>
}

export interface SecretStore {
  backend: 'credential-manager' | 'file-stub'
  get(): Promise<string | null>
  set(secret: string): Promise<void>
  delete(): Promise<void>
  location(): string
}
