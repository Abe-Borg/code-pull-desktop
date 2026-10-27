import type { SourceRetrieval } from '../types'
import { parseUpcodesTarget, upcodesUrls } from './target'

export function fixtureUpcodesResult(ask: string): SourceRetrieval {
  const parsed = parseUpcodesTarget(ask)
  if (!parsed.ok) return { ok: false, code: 'needs-detail', message: parsed.message }
  return {
    ok: true,
    quotedText:
      `FIXTURE excerpt for ${parsed.target.edition} section ${parsed.target.section}. ` +
      'Smoke mode does not open UpCodes. A signed-in browser profile supplies the publisher text.',
    citation: {
      edition: parsed.target.edition,
      section: parsed.target.section,
      urlOrPath: upcodesUrls(parsed.target)[0],
    },
  }
}
