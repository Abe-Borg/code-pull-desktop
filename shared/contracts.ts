export type AskMode = 'single' | 'list'

export interface Citation {
  edition: string
  section: string
  urlOrPath: string
}

export interface SecretStatus {
  configured: boolean
  backend: 'credential-manager' | 'file-stub' | 'unavailable'
  hint: string | null
  location: string
  detail: string | null
}

export interface HostStatus {
  ready: boolean
  chromiumPath: string | null
  detail: string
}

export interface RunAsksRequest {
  mode: AskMode
  text: string
}

export type AskResult =
  | {
      ask: string
      status: 'answered'
      intent: 'echo'
      routerReason: string
      quotedText: string
      citation: Citation
    }
  | {
      ask: string
      status: 'failed'
      intent: 'unsupported' | 'error'
      message: string
    }

export interface AskProgress {
  index: number
  total: number
  result: AskResult
}

export type RunAsksResponse =
  | { ok: true; results: AskResult[] }
  | { ok: false; message: string }
