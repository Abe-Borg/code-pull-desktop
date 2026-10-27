import { useCallback, useEffect, useState } from 'react'
import type { SecretStatus } from '../../../shared/contracts'
import { Onboarding } from './components/Onboarding'
import { Workspace } from './components/Workspace'
import { Button } from './components/ui/button'

export function App() {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'boot-error'>('loading')
  const [status, setStatus] = useState<SecretStatus | null>(null)
  const [bootError, setBootError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const next = await window.codePull.getSecretStatus()
    if (next.backend === 'unavailable') {
      setBootError(next.detail ?? 'The credential store is unavailable.')
      setPhase('boot-error')
      return
    }
    setStatus(next)
    setPhase('ready')
  }, [])

  useEffect(() => {
    if (!window.codePull) {
      setBootError('This page has no Code Pull bridge. Launch the Electron window with npm run dev or npm start.')
      setPhase('boot-error')
      return
    }
    void refresh().catch((error: unknown) => {
      setBootError(error instanceof Error ? error.message : String(error))
      setPhase('boot-error')
    })
  }, [refresh])

  if (phase === 'loading') {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <p className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Checking the credential store…</p>
      </main>
    )
  }

  if (phase === 'boot-error' || !status) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-4 px-6">
        <p className="font-mono text-xs tracking-[0.22em] text-destructive uppercase">Credential store</p>
        <h1 className="font-serif text-3xl">Code Pull cannot store a key yet</h1>
        <p className="text-sm leading-relaxed" role="alert">
          {bootError}
        </p>
        <Button type="button" className="w-fit" onClick={() => void refresh()}>
          Try again
        </Button>
      </main>
    )
  }

  if (!status.configured) {
    return <Onboarding status={status} onSaved={setStatus} />
  }

  return <Workspace status={status} onStatus={setStatus} />
}
