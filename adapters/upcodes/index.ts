import type { SourceRetrieval } from '../types'

/**
 * UpCodes is the next source adapter. The router does not call it yet.
 * IBC, IRC, and similar asks still use the echo adapter.
 */
export function retrieveUpcodes(): SourceRetrieval {
  return {
    ok: false,
    code: 'not-connected',
    message:
      'UpCodes is not connected. Section pulls for IBC, IRC, and similar codes still use the echo adapter.',
  }
}
