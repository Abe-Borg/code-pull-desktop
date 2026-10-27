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

export interface LinkStatus {
  username: string | null
  hasPassword: boolean
  profilePath: string
  detail: string | null
}

export interface LinkSignInResult {
  signedIn: boolean
  message: string
}

export type AskResult =
  | {
      ask: string
      status: 'answered'
      intent: 'echo' | 'nfpa-link'
      routerReason: string
      quotedText: string
      citation: Citation
    }
  | {
      ask: string
      status: 'failed'
      intent: 'unsupported' | 'error' | 'nfpa-link'
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
