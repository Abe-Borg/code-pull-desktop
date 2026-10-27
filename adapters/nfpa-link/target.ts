export interface NfpaTarget {
  code: string
  year: string
  section: string
  edition: string
}

export type ParsedTarget = { ok: true; target: NfpaTarget } | { ok: false; message: string }

const DETAIL_MESSAGE =
  'Name the NFPA publication, edition year, and section. For example: NFPA 101 2021 section 7.2.1.'

export function isClearNfpaSectionAsk(ask: string): boolean {
  return (
    /\bnfpa\s+\d+[a-z]?\b/i.test(ask) &&
    (/(?:section|sec\.?|§)\s*\d/i.test(ask) || /\b\d+\.\d+/.test(ask))
  )
}

export function parseNfpaTarget(ask: string): ParsedTarget {
  const codeMatch = ask.match(/\bnfpa\s+(\d+[a-z]?)\b/i)
  if (!codeMatch) return { ok: false, message: DETAIL_MESSAGE }

  const year = ask.match(/\b((?:19|20)\d{2})\b/)?.[1]
  const section =
    ask.match(/(?:section|sec\.?|§)\s*([0-9]+(?:\.[0-9]+)*)/i)?.[1] ??
    ask.match(/\b(\d+\.\d+(?:\.\d+)*)\b/)?.[1]

  if (!year || !section) return { ok: false, message: DETAIL_MESSAGE }

  const code = codeMatch[1].toUpperCase()
  return {
    ok: true,
    target: {
      code,
      year,
      section,
      edition: `NFPA ${code} (${year})`,
    },
  }
}

export function linkUrls(target: NfpaTarget): string[] {
  const root = `https://link.nfpa.org/publications/${encodeURIComponent(target.code)}/${encodeURIComponent(target.year)}`
  const chapter = target.section.split('.')[0] || target.section
  const section = encodeURIComponent(target.section)
  return [`${root}/sections/${section}`, `${root}/chapters/${encodeURIComponent(chapter)}`, root]
}

export const LINK_HOME = 'https://link.nfpa.org/'
