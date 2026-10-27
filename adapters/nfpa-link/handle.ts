import type { BrowserHostPong } from '../browser-host'
import { fixtureLinkResult } from './fixture'
import { createPlaywrightDriver } from './playwright-driver'
import { retrieveNfpaLink, signInToNfpaLink, type LinkDriver } from './session'
import type { SourceRetrieval } from '../types'

export interface PingRequest {
  id: string
  type: 'ping'
}

export interface RetrieveRequest {
  id: string
  type: 'retrieve'
  ask: string
  profileDir: string
  username: string | null
  password: string | null
  allowHeaded: boolean
  fixture: boolean
}

export interface SignInRequest {
  id: string
  type: 'sign-in'
  profileDir: string
  username: string | null
  password: string | null
  allowHeaded: boolean
  fixture: boolean
}

export type HostRequest = PingRequest | RetrieveRequest | SignInRequest

export type HostResponse =
  | BrowserHostPong
  | { id: string; type: 'retrieve-result'; result: SourceRetrieval }
  | { id: string; type: 'sign-in-result'; signedIn: boolean; message: string }

let driver: LinkDriver | null = null

function sharedDriver(): LinkDriver {
  driver ??= createPlaywrightDriver()
  return driver
}

export async function handleHostRequest(
  request: HostRequest,
  deps: {
    chromiumStatus: () => Promise<Omit<BrowserHostPong, 'id' | 'type'>>
    driver?: LinkDriver
    fixtureMode?: boolean
  },
): Promise<HostResponse> {
  if (request.type === 'ping') {
    const status = await deps.chromiumStatus()
    return { id: request.id, type: 'pong', ...status }
  }

  const fixture = request.fixture || deps.fixtureMode === true
  if (request.type === 'sign-in') {
    if (fixture) {
      return {
        id: request.id,
        type: 'sign-in-result',
        signedIn: false,
        message: 'Smoke mode does not open NFPA LiNK.',
      }
    }
    const result = await signInToNfpaLink({
      profileDir: request.profileDir,
      username: request.username,
      password: request.password,
      allowHeaded: request.allowHeaded,
      driver: deps.driver ?? sharedDriver(),
    })
    return { id: request.id, type: 'sign-in-result', ...result }
  }

  if (fixture) {
    return { id: request.id, type: 'retrieve-result', result: fixtureLinkResult(request.ask) }
  }

  const result = await retrieveNfpaLink({
    ask: request.ask,
    profileDir: request.profileDir,
    username: request.username,
    password: request.password,
    allowHeaded: request.allowHeaded,
    driver: deps.driver ?? sharedDriver(),
  })
  return { id: request.id, type: 'retrieve-result', result }
}
