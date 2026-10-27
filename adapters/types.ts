import type { Citation } from '../shared/contracts'

export interface SectionAnswer {
  quotedText: string
  citation: Citation
}

export interface SectionAdapter {
  id: string
  retrieve(ask: string): SectionAnswer | Promise<SectionAnswer>
}
