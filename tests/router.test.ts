import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ANTHROPIC_MESSAGES_URL, ROUTER_MODEL, redact } from '../router/claude'
import { routeAsk } from '../router'

const KEY = 'sk-ant-api03-router-test-key'

describe('routeAsk', () => {
  it('fails a missing key without calling Claude', async () => {
    let called = false
    const fetchImpl: typeof fetch = async () => {
      called = true
      return new Response('no')
    }
    const result = await routeAsk({ ask: 'NFPA 101 section 7.2.1', apiKey: null, fetchImpl })
    assert.equal(called, false)
    assert.equal(result.status, 'failed')
    if (result.status === 'failed') assert.match(result.message, /No Claude API key/)
  })

  it('calls the Messages API and returns an echo card', async () => {
    const seen: Array<{ url: string; init?: RequestInit }> = []
    const fetchImpl: typeof fetch = async (input, init) => {
      seen.push({ url: String(input), init })
      return new Response(
        JSON.stringify({
          content: [{ type: 'text', text: '{"intent":"echo","reason":"Section lookup."}' }],
          stop_reason: 'end_turn',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }

    const result = await routeAsk({
      ask: 'NEC 2023 section 210.8',
      apiKey: KEY,
      fetchImpl,
      retrieveLink: async () => {
        throw new Error('LiNK should stay idle for a non-NFPA ask.')
      },
      retrieveUpcodes: async () => {
        throw new Error('UpCodes should stay idle for a non-ICC ask.')
      },
    })

    assert.equal(seen.length, 1)
    assert.equal(seen[0].url, ANTHROPIC_MESSAGES_URL)
    const headers = seen[0].init?.headers as Record<string, string>
    assert.equal(headers['x-api-key'], KEY)
    assert.equal(headers['anthropic-version'], '2023-06-01')
    const body = JSON.parse(String(seen[0].init?.body)) as { model: string; messages: Array<{ content: string }> }
    assert.equal(body.model, ROUTER_MODEL)
    assert.equal(body.messages[0].content, 'NEC 2023 section 210.8')
    assert.equal(result.status, 'answered')
    if (result.status === 'answered') {
      assert.equal(result.intent, 'echo')
      assert.equal(result.citation.edition, 'NEC (2023)')
      assert.equal(result.citation.section, '210.8')
      assert.equal(result.citation.urlOrPath, 'echo://nec/2023/210-8')
      assert.match(result.quotedText, /Synthetic excerpt/)
      assert.equal(result.routerReason, 'Section lookup.')
    }
  })

  it('sends a clear NFPA section to the LiNK adapter even when Claude says echo', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          content: [{ type: 'text', text: '{"intent":"echo","reason":"Section lookup."}' }],
        }),
        { status: 200 },
      )
    let seen = ''
    const result = await routeAsk({
      ask: 'NFPA 101 2021 section 7.2.1',
      apiKey: KEY,
      fetchImpl,
      retrieveLink: async (ask) => {
        seen = ask
        return {
          ok: true,
          quotedText: 'FIXTURE 7.2.1 The means of egress in this fixture is not publisher text.',
          citation: {
            edition: 'NFPA 101 (2021)',
            section: '7.2.1',
            urlOrPath: 'https://link.nfpa.org/publications/101/2021/sections/7.2.1',
          },
        }
      },
    })
    assert.equal(seen, 'NFPA 101 2021 section 7.2.1')
    assert.equal(result.status, 'answered')
    if (result.status === 'answered') {
      assert.equal(result.intent, 'nfpa-link')
      assert.equal(result.citation.urlOrPath, 'https://link.nfpa.org/publications/101/2021/sections/7.2.1')
    }
  })

  it('sends a clear IBC section to UpCodes even when Claude says echo', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          content: [{ type: 'text', text: '{"intent":"echo","reason":"Section lookup."}' }],
        }),
        { status: 200 },
      )
    const result = await routeAsk({
      ask: 'IBC 2021 section 1005.3.1',
      apiKey: KEY,
      fetchImpl,
      retrieveLink: async () => {
        throw new Error('LiNK should stay idle for IBC.')
      },
      retrieveUpcodes: async () => ({
        ok: true,
        quotedText: 'FIXTURE 1005.3.1 This egress width sentence is not publisher text.',
        citation: {
          edition: 'IBC (2021)',
          section: '1005.3.1',
          urlOrPath: 'https://up.codes/viewer/ibc-2021/chapter/10#1005.3.1',
        },
      }),
    })
    assert.equal(result.status, 'answered')
    if (result.status === 'answered') {
      assert.equal(result.intent, 'upcodes')
      assert.equal(result.citation.edition, 'IBC (2021)')
      assert.equal(result.citation.urlOrPath, 'https://up.codes/viewer/ibc-2021/chapter/10#1005.3.1')
    }
  })

  it('shows the LiNK failure when the session is missing', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          content: [{ type: 'text', text: '{"intent":"nfpa-link","reason":"NFPA section lookup."}' }],
        }),
        { status: 200 },
      )
    const result = await routeAsk({
      ask: 'NFPA 13 2019 section 8.1',
      apiKey: KEY,
      fetchImpl,
      retrieveLink: async () => ({
        ok: false,
        code: 'not-signed-in',
        message: 'NFPA LiNK needs your sign-in.',
      }),
    })
    assert.equal(result.status, 'failed')
    if (result.status === 'failed') {
      assert.equal(result.intent, 'nfpa-link')
      assert.match(result.message, /sign-in/)
    }
  })

  it('surfaces an unsupported classification', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          content: [{ type: 'text', text: '{"intent":"unsupported","reason":"Not a section lookup."}' }],
        }),
        { status: 200 },
      )
    const result = await routeAsk({ ask: 'What is the weather?', apiKey: KEY, fetchImpl })
    assert.equal(result.status, 'failed')
    if (result.status === 'failed') {
      assert.equal(result.intent, 'unsupported')
      assert.match(result.message, /Unsupported/)
    }
  })

  it('reports a rejected key and redacts secrets echoed by the API', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({ error: { message: `invalid ${KEY}` } }),
        { status: 401 },
      )
    const result = await routeAsk({ ask: 'NFPA 13 section 8.1', apiKey: KEY, fetchImpl })
    assert.equal(result.status, 'failed')
    if (result.status === 'failed') {
      assert.match(result.message, /401/)
      assert.equal(result.message.includes(KEY), false)
      assert.match(result.message, /sk-ant-…/)
    }
  })

  it('redacts a key buried in a transport error', () => {
    assert.equal(redact(`failed for ${KEY}`).includes(KEY), false)
  })
})
