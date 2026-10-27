import * as path from 'node:path'
import { FileStubSecretStore } from './file-stub'
import { KeytarSecretStore, loadKeytar } from './keytar-store'
import type { SecretStore } from './types'

export async function openSecretStore(userDataPath: string): Promise<SecretStore> {
  if (process.platform === 'win32') {
    const keytar = await loadKeytar()
    if (!keytar) {
      throw new Error(
        'Windows Credential Manager is unavailable. Install keytar and rebuild it for Electron with npm run rebuild-keytar.',
      )
    }
    return new KeytarSecretStore(keytar)
  }

  return new FileStubSecretStore(path.join(userDataPath, 'secrets'))
}

export { validateClaudeKey, hintForKey } from './validate'
export { LINK_PASSWORD_ACCOUNT, LINK_USERNAME_ACCOUNT, SECRET_ACCOUNT, SECRET_SERVICE } from './types'
export type { SecretStore } from './types'
