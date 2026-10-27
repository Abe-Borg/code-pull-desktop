import type { SourceRetrieval } from '../types'
import { linkUrls, parseNfpaTarget } from './target'

export function fixtureLinkResult(ask: string): SourceRetrieval {
  const parsed = parseNfpaTarget(ask)
  if (!parsed.ok) return { ok: false, code: 'needs-detail', message: parsed.message }
  const url = linkUrls(parsed.target)[0]
  return {
    ok: true,
    quotedText:
      `FIXTURE excerpt for ${parsed.target.edition} section ${parsed.target.section}. ` +
      'Smoke mode does not open NFPA LiNK. A signed-in browser profile supplies the publisher text.',
    citation: {
      edition: parsed.target.edition,
      section: parsed.target.section,
      urlOrPath: url,
    },
  }
}
