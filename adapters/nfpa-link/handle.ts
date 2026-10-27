import type { BrowserHostPong } from '../browser-host'
import { fixtureUpcodesResult } from '../upcodes/fixture'
import { retrieveUpcodesSection, signInToUpcodes } from '../upcodes/session'
import { fixtureLinkResult } from './fixture'
import { createPlaywrightDriver } from './playwright-driver'
import { retrieveNfpaLink, signInToNfpaLink, type LinkDriver } from './session'
import type { SourceRetrieval } from '../types'

export interface PingRequest {
  id: string
  type: 'ping'
}

export type SourceId = 'nfpa-link' | 'upcodes'

export interface RetrieveRequest {
  id: string
  type: 'retrieve'
  source?: SourceId
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
  source?: SourceId
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
  const source = request.source === 'upcodes' ? 'upcodes' : 'nfpa-link'
  const driver = deps.driver ?? sharedDriver()
  if (request.type === 'sign-in') {
    if (fixture) {
      return {
        id: request.id,
        type: 'sign-in-result',
        signedIn: false,
        message: source === 'upcodes' ? 'Smoke mode does not open UpCodes.' : 'Smoke mode does not open NFPA LiNK.',
      }
    }
    const result =
      source === 'upcodes'
        ? await signInToUpcodes({ ...request, driver })
        : await signInToNfpaLink({ ...request, driver })
    return { id: request.id, type: 'sign-in-result', ...result }
  }

  if (fixture) {
    const result = source === 'upcodes' ? fixtureUpcodesResult(request.ask) : fixtureLinkResult(request.ask)
    return { id: request.id, type: 'retrieve-result', result }
  }

  const result =
    source === 'upcodes'
      ? await retrieveUpcodesSection({ ...request, driver })
      : await retrieveNfpaLink({ ...request, driver })
  return { id: request.id, type: 'retrieve-result', result }
}
