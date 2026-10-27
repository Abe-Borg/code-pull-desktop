export const SECRET_SERVICE = 'Code Pull Desktop'
export const SECRET_ACCOUNT = 'claude-api-key'
export const LINK_USERNAME_ACCOUNT = 'nfpa-link-username'
export const LINK_PASSWORD_ACCOUNT = 'nfpa-link-password'
export const UPCODES_USERNAME_ACCOUNT = 'upcodes-username'
export const UPCODES_PASSWORD_ACCOUNT = 'upcodes-password'

export interface KeytarModule {
  getPassword(service: string, account: string): Promise<string | null>
  setPassword(service: string, account: string, password: string): Promise<void>
  deletePassword(service: string, account: string): Promise<boolean>
}

export interface SecretStore {
  backend: 'credential-manager' | 'file-stub'
  get(account?: string): Promise<string | null>
  set(secret: string, account?: string): Promise<void>
  delete(account?: string): Promise<void>
  location(account?: string): string
}
