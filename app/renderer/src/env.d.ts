/// <reference types="vite/client" />

import type { CodePullApi } from '../../main/preload'

declare global {
  interface Window {
    codePull: CodePullApi
  }
}

export {}
