export interface BrowserHostPing {
  type: 'ping'
}

export interface BrowserHostPong {
  type: 'pong'
  ready: boolean
  chromiumPath: string | null
  detail: string
}
