import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { retrieveUpcodes } from '../adapters/upcodes'

describe('UpCodes stub', () => {
  it('stays unwired and says so', () => {
    const result = retrieveUpcodes()
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.code, 'not-connected')
      assert.match(result.message, /UpCodes is not connected/)
    }
  })
})