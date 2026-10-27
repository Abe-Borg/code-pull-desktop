import type { AskMode } from '../shared/contracts'

const MAX_ASKS = 20
const MAX_ASK_LENGTH = 4_000

export class AskInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AskInputError'
  }
}

export function splitAsks(mode: AskMode, text: string): string[] {
  if (mode === 'single') {
    const ask = text.trim()
    if (!ask) throw new AskInputError('Enter an ask first.')
    assertLength(ask)
    return [ask]
  }

  const asks = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (asks.length === 0) throw new AskInputError('Enter one ask per line.')
  if (asks.length > MAX_ASKS) {
    throw new AskInputError(`Pull up to ${MAX_ASKS} asks at a time.`)
  }
  for (const ask of asks) assertLength(ask)
  return asks
}

function assertLength(ask: string): void {
  if (ask.length > MAX_ASK_LENGTH) {
    throw new AskInputError('One of those asks is too long. Keep each ask under 4,000 characters.')
  }
}
