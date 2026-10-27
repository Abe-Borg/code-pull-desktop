import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type {
  AskProgress,
  HostStatus,
  LinkSignInResult,
  LinkStatus,
  RunAsksRequest,
  RunAsksResponse,
  SecretStatus,
} from '../../shared/contracts'

const api = {
  getSecretStatus(): Promise<SecretStatus> {
    return ipcRenderer.invoke('secrets:status')
  },
  saveKey(key: string): Promise<SecretStatus> {
    return ipcRenderer.invoke('secrets:set', key)
  },
  clearKey(): Promise<SecretStatus> {
    return ipcRenderer.invoke('secrets:clear')
  },
  getHostStatus(): Promise<HostStatus> {
    return ipcRenderer.invoke('host:status')
  },
  getLinkStatus(): Promise<LinkStatus> {
    return ipcRenderer.invoke('link:status')
  },
  saveLinkLogin(input: { username: string; password: string }): Promise<LinkStatus> {
    return ipcRenderer.invoke('link:save', input)
  },
  clearLinkLogin(): Promise<LinkStatus> {
    return ipcRenderer.invoke('link:clear')
  },
  signInToLink(): Promise<LinkSignInResult> {
    return ipcRenderer.invoke('link:signIn')
  },
  copyText(text: string): Promise<void> {
    return ipcRenderer.invoke('clipboard:write', text)
  },
  runAsks(request: RunAsksRequest): Promise<RunAsksResponse> {
    return ipcRenderer.invoke('asks:run', request)
  },
  onAskProgress(listener: (event: AskProgress) => void): () => void {
    const wrapped = (_event: IpcRendererEvent, payload: AskProgress) => listener(payload)
    ipcRenderer.on('asks:progress', wrapped)
    return () => ipcRenderer.off('asks:progress', wrapped)
  },
}

export type CodePullApi = typeof api

contextBridge.exposeInMainWorld('codePull', api)
