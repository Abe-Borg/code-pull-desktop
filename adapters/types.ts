import type { Citation } from '../shared/contracts'

export interface SectionAnswer {
  quotedText: string
  citation: Citation
}

export type SourceFailureCode =
  | 'not-signed-in'
  | 'not-found'
  | 'needs-detail'
  | 'browser-missing'
  | 'navigation-error'
  | 'not-connected'

export type SourceRetrieval =
  | { ok: true; quotedText: string; citation: Citation }
  | { ok: false; code: SourceFailureCode; message: string }

export interface SectionAdapter {
  id: string
  retrieve(ask: string): SectionAnswer | Promise<SectionAnswer>
}
