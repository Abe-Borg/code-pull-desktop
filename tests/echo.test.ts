import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildEchoAnswer, citationForAsk } from '../adapters/echo'

describe('echo adapter', () => {
  it('fills edition, section, and an echo path from a section ask', () => {
    const citation = citationForAsk('NFPA 101 2021 section 7.2.1 means of egress')
    assert.equal(citation.edition, 'NFPA 101 (2021)')
    assert.equal(citation.section, '7.2.1')
    assert.equal(citation.urlOrPath, 'echo://nfpa-101/2021/7-2-1')
  })

  it('reads IBC section numbers without treating the year as a section', () => {
    const citation = citationForAsk('IBC 2021 section 1005.3.1')
    assert.equal(citation.edition, 'IBC (2021)')
    assert.equal(citation.section, '1005.3.1')
    assert.equal(citation.urlOrPath, 'echo://ibc/2021/1005-3-1')
  })

  it('still returns a citation when the ask names nothing', () => {
    const answer = buildEchoAnswer('hello there')
    assert.equal(answer.citation.edition, 'Unspecified edition')
    assert.equal(answer.citation.section, 'Unspecified section')
    assert.equal(answer.citation.urlOrPath, 'echo://unspecified/unspecified/unspecified')
    assert.match(answer.quotedText, /Synthetic excerpt/)
    assert.equal(answer.quotedText.includes('http'), false)
  })
})
