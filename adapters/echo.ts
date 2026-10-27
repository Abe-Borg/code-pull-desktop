import type { Citation } from '../shared/contracts'
import type { SectionAdapter, SectionAnswer } from './types'

interface NamedStandard {
  pattern: RegExp
  label: (match: RegExpMatchArray) => string
}

const STANDARDS: NamedStandard[] = [
  {
    pattern: /\bNFPA\s+(\d+[A-Z]?)\b/i,
    label: (match) => `NFPA ${match[1].toUpperCase()}`,
  },
  {
    pattern: /\b(IBC|IRC|IFC|IMC|NEC)\b/i,
    label: (match) => match[1].toUpperCase(),
  },
  {
    pattern: /\bASME\s+([A-Z]?\d+(?:\.\d+)?)\b/i,
    label: (match) => `ASME ${match[1].toUpperCase()}`,
  },
]

export function citationForAsk(ask: string): Citation {
  const standard = STANDARDS.map((entry) => {
    const match = ask.match(entry.pattern)
    return match ? entry.label(match) : null
  }).find((label): label is string => Boolean(label))

  const year = ask.match(/\b((?:19|20)\d{2})\b/)?.[1] ?? null
  const section =
    ask.match(/(?:section|sec\.?|§)\s*([0-9]+(?:\.[0-9]+)*)/i)?.[1] ??
    ask.match(/\b(\d+\.\d+(?:\.\d+)*)\b/)?.[1] ??
    null

  const edition = standard
    ? year
      ? `${standard} (${year})`
      : standard
    : 'Unspecified edition'
  const sectionLabel = section ?? 'Unspecified section'
  const urlOrPath = `echo://${slug(standard ?? 'unspecified')}/${slug(year ?? 'unspecified')}/${slug(
    sectionLabel === 'Unspecified section' ? 'unspecified' : sectionLabel,
  )}`

  return {
    edition,
    section: sectionLabel,
    urlOrPath,
  }
}

export function buildEchoAnswer(ask: string): SectionAnswer {
  const citation = citationForAsk(ask)
  const recorded = ask.trim().replace(/\s+/g, ' ')
  return {
    quotedText:
      `Synthetic excerpt. ${citation.edition}, section ${citation.section}. ` +
      `The echo adapter is holding this card until a source adapter supplies publisher text. ` +
      `Recorded ask: ${recorded}`,
    citation,
  }
}

export const echoAdapter: SectionAdapter = {
  id: 'echo',
  retrieve(ask: string) {
    return buildEchoAnswer(ask)
  },
}

function slug(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return cleaned || 'unspecified'
}
