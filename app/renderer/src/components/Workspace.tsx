import { useEffect, useState } from 'react'
import type { AskMode, AskResult, HostStatus, SecretStatus } from '../../../../shared/contracts'
import { AnswerCard } from './AnswerCard'
import { LinkAccess } from './LinkAccess'
import { SettingsPanel } from './SettingsPanel'
import { Button } from './ui/button'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'

export function Workspace({
  status,
  onStatus,
}: {
  status: SecretStatus
  onStatus: (status: SecretStatus) => void
}) {
  const [mode, setMode] = useState<AskMode>('single')
  const [text, setText] = useState('')
  const [results, setResults] = useState<AskResult[]>([])
  const [running, setRunning] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [host, setHost] = useState<HostStatus | null>(null)

  useEffect(() => {
    return window.codePull.onAskProgress((event) => {
      setResults((current) => {
        const next = current.slice()
        next[event.index] = event.result
        return next
      })
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    void window.codePull.getHostStatus().then((next) => {
      if (!cancelled) setHost(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function pull() {
    setRunning(true)
    setFormError(null)
    setResults([])
    try {
      const response = await window.codePull.runAsks({ mode, text })
      if (!response.ok) {
        setFormError(response.message)
        setResults([])
        return
      }
      setResults(response.results)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-[#f7f3ea]">
        <div className="mx-auto flex w-full max-w-3xl items-start justify-between gap-4 px-5 py-5">
          <div>
            <p className="font-mono text-xs tracking-[0.22em] text-primary uppercase">Code Pull</p>
            <h1 className="mt-1 font-serif text-3xl">Section desk</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Your Claude key routes the ask. NFPA sections come from your LiNK session. Other
              section asks stay on the echo adapter. Key on file: {status.hint}.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => setSettingsOpen((open) => !open)}>
            {settingsOpen ? 'Close settings' : 'Settings'}
          </Button>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-6">
        {settingsOpen ? (
          <>
            <SettingsPanel status={status} onStatus={onStatus} />
            <LinkAccess />
          </>
        ) : null}
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            void pull()
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Label htmlFor="ask">Ask</Label>
            <div className="flex rounded-md border border-border bg-card p-1">
              <ModeButton active={mode === 'single'} testId="mode-single" onClick={() => setMode('single')}>
                Single ask
              </ModeButton>
              <ModeButton active={mode === 'list'} testId="mode-list" onClick={() => setMode('list')}>
                One per line
              </ModeButton>
            </div>
          </div>
          <Textarea
            id="ask"
            data-testid="ask-input"
            value={text}
            disabled={running}
            placeholder={
              mode === 'single'
                ? 'NFPA 101 2021 section 7.2.1 means of egress'
                : 'NFPA 101 2021 section 7.2.1\nIBC 2021 section 1005.3.1'
            }
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault()
                void pull()
              }
            }}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" data-testid="pull" disabled={running || text.trim().length === 0}>
              {running ? 'Asking Claude…' : 'Pull sections'}
            </Button>
            <p className="text-xs text-muted-foreground">Ctrl+Enter pulls. Up to 20 asks in a list.</p>
          </div>
          {formError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {formError}
            </p>
          ) : null}
        </form>
        <section aria-live="polite" className="space-y-3">
          <h2 className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Answers</h2>
          {results.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-5 py-8 text-sm leading-relaxed text-muted-foreground">
              {running
                ? 'Routing each ask with your Claude key.'
                : 'Pulled sections land here as cards: quoted text, edition, section, and a URL or path.'}
            </div>
          ) : (
            results.filter(Boolean).map((result, index) => <AnswerCard key={`${index}-${result.ask}`} result={result} />)
          )}
        </section>
        <footer className="border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
          <p>
            Secrets: {backendLabel(status.backend)}. {status.location}
          </p>
          <p data-testid="host-status" className="mt-1">
            Source browser: {host ? host.detail : 'Checking the Playwright host…'}
          </p>
        </footer>
      </main>
    </div>
  )
}

function ModeButton({
  active,
  testId,
  onClick,
  children,
}: {
  active: boolean
  testId: string
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={active}
      className={
        active
          ? 'rounded px-3 py-1 text-xs font-medium bg-primary text-primary-foreground'
          : 'rounded px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground'
      }
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function backendLabel(backend: SecretStatus['backend']): string {
  if (backend === 'credential-manager') return 'Windows Credential Manager'
  if (backend === 'file-stub') return 'local file stub'
  return 'unavailable'
}
