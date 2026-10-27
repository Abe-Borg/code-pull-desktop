import { buildEchoAnswer } from '../adapters/echo'
import type { SourceRetrieval } from '../adapters/types'
import { isClearNfpaSectionAsk } from '../adapters/nfpa-link/target'
import type { AskResult } from '../shared/contracts'
import { classifyAsk, redact, type Classification } from './claude'

export async function routeAsk(options: {
  ask: string
  apiKey: string | null
  fetchImpl?: typeof fetch
  retrieveLink?: (ask: string) => Promise<SourceRetrieval>
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

  if (shouldUseNfpaLink(ask, classification)) {
    return pullFromLink(ask, classification, options.retrieveLink)
  }

  if (classification.intent === 'unsupported') {
    return {
      ask,
      status: 'failed',
      intent: 'unsupported',
      message: classification.reason
        ? `Unsupported. ${classification.reason}`
        : 'Unsupported. Code Pull routes section lookups only.',
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

function shouldUseNfpaLink(ask: string, classification: Classification): boolean {
  return classification.intent === 'nfpa-link' || isClearNfpaSectionAsk(ask)
}

async function pullFromLink(
  ask: string,
  classification: Classification,
  retrieveLink: ((ask: string) => Promise<SourceRetrieval>) | undefined,
): Promise<AskResult> {
  if (!retrieveLink) {
    return {
      ask,
      status: 'failed',
      intent: 'nfpa-link',
      message: 'NFPA LiNK adapter is not connected.',
    }
  }

  try {
    const retrieval = await retrieveLink(ask)
    if (!retrieval.ok) {
      return { ask, status: 'failed', intent: 'nfpa-link', message: retrieval.message }
    }
    return {
      ask,
      status: 'answered',
      intent: 'nfpa-link',
      routerReason: classification.reason,
      quotedText: retrieval.quotedText,
      citation: retrieval.citation,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ask, status: 'failed', intent: 'nfpa-link', message: redact(message) }
  }
}

export { splitAsks, AskInputError } from './split'
export { ROUTER_MODEL } from './claude'
