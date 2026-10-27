import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { AskInputError, splitAsks } from '../router/split'

describe('splitAsks', () => {
  it('keeps a single multi-line paragraph together', () => {
    const asks = splitAsks('single', '  NFPA 101\nsection 7.2.1  ')
    assert.deepEqual(asks, ['NFPA 101\nsection 7.2.1'])
  })

  it('splits a list on lines and drops blanks', () => {
    const asks = splitAsks('list', 'NFPA 101 section 7.2.1\n\nIBC 2021 section 1005.3.1\n')
    assert.deepEqual(asks, ['NFPA 101 section 7.2.1', 'IBC 2021 section 1005.3.1'])
  })

  it('rejects an empty list', () => {
    assert.throws(() => splitAsks('list', '\n  \n'), AskInputError)
  })

  it('caps a list at 20 asks', () => {
    const text = Array.from({ length: 21 }, (_, index) => `section ${index}.1`).join('\n')
    assert.throws(() => splitAsks('list', text), /20/)
  })
})
