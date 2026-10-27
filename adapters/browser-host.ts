import type { SourceRetrieval } from './types'

export interface BrowserHostPong {
  id: string
  type: 'pong'
  ready: boolean
  chromiumPath: string | null
  detail: string
}

export interface LinkRetrieveRequest {
  ask: string
  profileDir: string
  username: string | null
  password: string | null
  allowHeaded: boolean
  fixture: boolean
}

export interface LinkSignInRequest {
  profileDir: string
  username: string | null
  password: string | null
  allowHeaded: boolean
  fixture: boolean
}

export interface RetrieveResultMessage {
  id: string
  type: 'retrieve-result'
  result: SourceRetrieval
}

export interface SignInResultMessage {
  id: string
  type: 'sign-in-result'
  signedIn: boolean
  message: string
}
