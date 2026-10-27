export const ROUTER_MODEL = 'claude-haiku-5-5'
export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages'

const SYSTEM_PROMPT = [
  'You route asks inside Code Pull, a desktop app that retrieves building-code and standards sections.',
  'Classify the user ask.',
  'Use intent "nfpa-link" when they want the text of an NFPA code or standard section (NFPA 101, NFPA 13, NFPA 70, and similar).',
  'Use intent "upcodes" when they want an IBC, IRC, IFC, or IMC section, or they name UpCodes.',
  'Use intent "echo" when they want another code section (NEC, ASME, ASTM, or a named section that is not NFPA and not IBC/IRC/IFC/IMC).',
  'Use intent "unsupported" for chat, drafting, calculation, or anything that is not a section retrieval.',
  'Reply with JSON only: {"intent":"nfpa-link"|"upcodes"|"echo"|"unsupported","reason":"one short sentence"}',
].join(' ')

export class RouterFailure extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RouterFailure'
  }
}

export interface Classification {
  intent: 'echo' | 'nfpa-link' | 'upcodes' | 'unsupported'
  reason: string
}

export async function classifyAsk(
  ask: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Classification> {
  let response: Response
  try {
    response = await fetchImpl(ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ROUTER_MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        output_config: {
          effort: 'low',
          format: {
            type: 'json_schema',
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                intent: { type: 'string', enum: ['echo', 'nfpa-link', 'upcodes', 'unsupported'] },
                reason: { type: 'string' },
              },
              required: ['intent', 'reason'],
            },
          },
        },
        messages: [{ role: 'user', content: ask }],
      }),
      signal: AbortSignal.timeout(60_000),
    })
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new RouterFailure('The Claude API did not respond within 60 seconds.')
    }
    const message = error instanceof Error ? error.message : String(error)
    throw new RouterFailure(`Could not reach the Claude API. ${redact(message)}`)
  }

  const raw = await response.text()
  let body: unknown = null
  if (raw) {
    try {
      body = JSON.parse(raw) as unknown
    } catch {
      throw new RouterFailure(`Claude returned a non-JSON response (${response.status}).`)
    }
  }

  if (!response.ok) {
    throw new RouterFailure(redact(messageForStatus(response.status, body)))
  }

  const text = textFromContent(body)
  if (!text) {
    const stop = readStopReason(body)
    throw new RouterFailure(`Claude did not return a classification (stop: ${stop}).`)
  }

  return parseClassification(text)
}

export function redact(text: string): string {
  return text.replace(/sk-ant-[A-Za-z0-9_-]+/g, 'sk-ant-…')
}

function messageForStatus(status: number, body: unknown): string {
  const detail = errorMessage(body)
  if (status === 401) {
    return detail
      ? `Claude rejected this API key (401). ${detail}`
      : 'Claude rejected this API key (401). Save a current key in Settings.'
  }
  if (status === 403) {
    return detail
      ? `Claude refused this API key (403). ${detail}`
      : 'Claude refused this API key (403).'
  }
  if (status === 429) {
    return 'Claude rate-limited this key (429). Wait a moment and pull again.'
  }
  if (detail) return `Claude request failed (${status}). ${detail}`
  return `Claude request failed (${status}).`
}

function errorMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const record = body as { error?: { message?: unknown }; message?: unknown }
  if (typeof record.error?.message === 'string') return record.error.message
  if (typeof record.message === 'string') return record.message
  return null
}

function textFromContent(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const content = (body as { content?: unknown }).content
  if (!Array.isArray(content)) return ''
  return content
    .filter(
      (block): block is { type: 'text'; text: string } =>
        Boolean(block) &&
        typeof block === 'object' &&
        (block as { type?: unknown }).type === 'text' &&
        typeof (block as { text?: unknown }).text === 'string',
    )
    .map((block) => block.text)
    .join('\n')
    .trim()
}

function readStopReason(body: unknown): string {
  if (!body || typeof body !== 'object' || !('stop_reason' in body)) return 'unknown'
  const stop = (body as { stop_reason?: unknown }).stop_reason
  return typeof stop === 'string' ? stop : 'unknown'
}

export function parseClassification(text: string): Classification {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) {
    throw new RouterFailure('Claude did not return a classification.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1)) as unknown
  } catch {
    throw new RouterFailure('Claude returned a classification that was not valid JSON.')
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new RouterFailure('Claude returned a classification that was not an object.')
  }

  const intent = (parsed as { intent?: unknown }).intent
  const reason = (parsed as { reason?: unknown }).reason
  const normalized = intent === 'link' ? 'nfpa-link' : intent
  if (normalized !== 'echo' && normalized !== 'nfpa-link' && normalized !== 'upcodes' && normalized !== 'unsupported') {
    throw new RouterFailure('Claude returned an unknown intent.')
  }

  return {
    intent: normalized,
    reason: typeof reason === 'string' ? reason.trim() : '',
  }
}
