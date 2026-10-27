import { buildEchoAnswer } from '../adapters/echo'
import type { AskResult } from '../shared/contracts'
import { classifyAsk, redact, type Classification } from './claude'

export async function routeAsk(options: {
  ask: string
  apiKey: string | null
  fetchImpl?: typeof fetch
}): Promise<AskResult> {
  const ask = options.ask.trim()
  if (!options.apiKey) {
    return {
      ask,
      status: 'failed',
      intent: 'error',
      message: 'No Claude API key is stored. Paste one before pulling sections.',
    }
  }

  let classification: Classification
  try {
    classification = await classifyAsk(ask, options.apiKey, options.fetchImpl)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      ask,
      status: 'failed',
      intent: 'error',
      message: redact(message),
    }
  }

  if (classification.intent === 'unsupported') {
    return {
      ask,
      status: 'failed',
      intent: 'unsupported',
      message: classification.reason
        ? `Unsupported. ${classification.reason}`
        : 'Unsupported. Code Pull routes section lookups only. LiNK and UpCodes adapters are not connected.',
    }
  }

  const answer = buildEchoAnswer(ask)
  return {
    ask,
    status: 'answered',
    intent: 'echo',
    routerReason: classification.reason,
    quotedText: answer.quotedText,
    citation: answer.citation,
  }
}

export { splitAsks, AskInputError } from './split'
export { ROUTER_MODEL } from './claude'
