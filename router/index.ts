import { buildEchoAnswer } from '../adapters/echo'
import type { SourceRetrieval } from '../adapters/types'
import { isClearNfpaSectionAsk } from '../adapters/nfpa-link/target'
import { isClearUpcodesAsk } from '../adapters/upcodes/target'
import type { AskResult } from '../shared/contracts'
import { classifyAsk, redact, type Classification } from './claude'

export async function routeAsk(options: {
  ask: string
  apiKey: string | null
  fetchImpl?: typeof fetch
  retrieveLink?: (ask: string) => Promise<SourceRetrieval>
  retrieveUpcodes?: (ask: string) => Promise<SourceRetrieval>
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

  if (isClearNfpaSectionAsk(ask) || (classification.intent === 'nfpa-link' && !isClearUpcodesAsk(ask))) {
    return pullFromSource(ask, classification, 'nfpa-link', 'NFPA LiNK adapter is not connected.', options.retrieveLink)
  }

  if (isClearUpcodesAsk(ask) || classification.intent === 'upcodes') {
    return pullFromSource(ask, classification, 'upcodes', 'UpCodes adapter is not connected.', options.retrieveUpcodes)
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

async function pullFromSource(
  ask: string,
  classification: Classification,
  intent: 'nfpa-link' | 'upcodes',
  disconnected: string,
  retrieve: ((ask: string) => Promise<SourceRetrieval>) | undefined,
): Promise<AskResult> {
  if (!retrieve) {
    return { ask, status: 'failed', intent, message: disconnected }
  }

  try {
    const retrieval = await retrieve(ask)
    if (!retrieval.ok) return { ask, status: 'failed', intent, message: retrieval.message }
    return {
      ask,
      status: 'answered',
      intent,
      routerReason: classification.reason,
      quotedText: retrieval.quotedText,
      citation: retrieval.citation,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ask, status: 'failed', intent, message: redact(message) }
  }
}

export { splitAsks, AskInputError } from './split'
export { ROUTER_MODEL } from './claude'
