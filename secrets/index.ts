import * as path from 'node:path'
import { FileStubSecretStore } from './file-stub'
import { KeytarSecretStore, loadKeytar } from './keytar-store'
import type { SecretStore } from './types'
import { WinCredPowerShellStore } from './wincred-powershell'

export async function openSecretStore(userDataPath: string): Promise<SecretStore> {
  if (process.platform === 'win32') {
    const keytar = await loadKeytar()
    if (keytar) return new KeytarSecretStore(keytar)
    return new WinCredPowerShellStore()
  }

  return new FileStubSecretStore(path.join(userDataPath, 'secrets'))
}

export { validateClaudeKey, hintForKey } from './validate'
export {
  LINK_PASSWORD_ACCOUNT,
  LINK_USERNAME_ACCOUNT,
  SECRET_ACCOUNT,
  SECRET_SERVICE,
  UPCODES_PASSWORD_ACCOUNT,
  UPCODES_USERNAME_ACCOUNT,
} from './types'
export type { SecretStore } from './types'
