export interface UpcodesCode {
  slug: string
  name: string
  longSlug: string
}

export interface UpcodesTarget {
  code: UpcodesCode
  year: string
  section: string
  edition: string
}

export type ParsedUpcodes = { ok: true; target: UpcodesTarget } | { ok: false; message: string }

const CODES: Record<string, UpcodesCode> = {
  ibc: { slug: 'ibc', name: 'IBC', longSlug: 'international-building-code-ibc' },
  irc: { slug: 'irc', name: 'IRC', longSlug: 'international-residential-code-irc' },
  ifc: { slug: 'ifc', name: 'IFC', longSlug: 'international-fire-code-ifc' },
  imc: { slug: 'imc', name: 'IMC', longSlug: 'international-mechanical-code-imc' },
}

const DETAIL_MESSAGE =
  'Name the code, edition year, and section. For example: IBC 2021 section 1005.3.1.'

export function isClearUpcodesAsk(ask: string): boolean {
  const hasCode = /\b(ibc|irc|ifc|imc)\b/i.test(ask)
  const explicit = /\bupcodes\b/i.test(ask)
  const hasSection = /(?:section|sec\.?|§)\s*\d/i.test(ask) || /\b\d+\.\d+/.test(ask)
  if (hasCode && hasSection) return true
  return explicit && (hasSection || hasCode)
}

export function parseUpcodesTarget(ask: string): ParsedUpcodes {
  const codeKey = ask.match(/\b(ibc|irc|ifc|imc)\b/i)?.[1]?.toLowerCase()
  if (!codeKey || !CODES[codeKey]) return { ok: false, message: DETAIL_MESSAGE }
  const year = ask.match(/\b((?:19|20)\d{2})\b/)?.[1]
  const section =
    ask.match(/(?:section|sec\.?|§)\s*([0-9]+(?:\.[0-9]+)*)/i)?.[1] ??
    ask.match(/\b(\d+\.\d+(?:\.\d+)*)\b/)?.[1]
  if (!year || !section) return { ok: false, message: DETAIL_MESSAGE }
  const code = CODES[codeKey]
  return {
    ok: true,
    target: {
      code,
      year,
      section,
      edition: `${code.name} (${year})`,
    },
  }
}

export function upcodesUrls(target: UpcodesTarget): string[] {
  const chapter = iccChapter(target.section)
  const viewer = `https://up.codes/viewer/${target.code.slug}-${target.year}`
  const section = encodeURIComponent(target.section)
  return [
    `${viewer}/chapter/${encodeURIComponent(chapter)}#${section}`,
    `https://up.codes/s/${target.code.slug}-${target.year}/${section}`,
    `${viewer}#${section}`,
    `https://up.codes/code/${target.code.longSlug}-${target.year}`,
  ]
}

export const UPCODES_HOME = 'https://up.codes/'

function iccChapter(section: string): string {
  const head = Number(section.split('.')[0])
  if (!Number.isFinite(head)) return section.split('.')[0] || section
  const chapter = Math.floor(head / 100)
  return String(chapter > 0 ? chapter : head)
}
