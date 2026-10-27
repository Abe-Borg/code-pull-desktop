import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, it } from 'node:test'
import { FileStubSecretStore } from '../secrets/file-stub'
import { validateClaudeKey } from '../secrets/validate'

describe('file stub secret store', () => {
  it('writes the key with mode 0600 and reads it back', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'code-pull-secrets-'))
    const store = new FileStubSecretStore(directory)
    assert.equal(await store.get(), null)
    await store.set('sk-ant-test-key-123456')
    const mode = fs.statSync(store.location()).mode & 0o777
    assert.equal(mode, 0o600)
    assert.equal(await store.get(), 'sk-ant-test-key-123456')
    await store.delete()
    assert.equal(await store.get(), null)
  })
})

describe('validateClaudeKey', () => {
  it('accepts a trimmed Claude key', () => {
    assert.equal(validateClaudeKey('  sk-ant-api03-examplekey  '), 'sk-ant-api03-examplekey')
  })

  it('rejects a key from another vendor shape', () => {
    assert.throws(() => validateClaudeKey('sk-live-not-claude'), /sk-ant-/)
  })
})
