import { useState } from 'react'
import type { SecretStatus } from '../../../../shared/contracts'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

export function Onboarding({
  status,
  onSaved,
}: {
  status: SecretStatus
  onSaved: (status: SecretStatus) => void
}) {
  const [key, setKey] = useState('')
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const next = await window.codePull.saveKey(key)
      if (!next.configured) {
        setError(next.detail ?? 'The key was not stored.')
        return
      }
      onSaved(next)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6 py-16">
      <p className="font-mono text-xs tracking-[0.22em] text-primary uppercase">Code Pull</p>
      <h1 className="mt-3 font-serif text-4xl leading-tight text-foreground">Paste your Claude API key</h1>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">
        Each ask is sent to the Claude Messages API with the key stored on this computer. Publisher
        logins for later source adapters stay on this computer too.
      </p>
      <StoreNote status={status} />
      <form
        className="mt-8 space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="claude-key">Claude API key</Label>
          <div className="flex gap-2">
            <Input
              id="claude-key"
              data-testid="key-input"
              type={visible ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              value={key}
              placeholder="sk-ant-..."
              onChange={(event) => setKey(event.target.value)}
            />
            <Button type="button" variant="outline" onClick={() => setVisible((value) => !value)}>
              {visible ? 'Hide' : 'Show'}
            </Button>
          </div>
        </div>
        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" data-testid="save-key" disabled={saving || key.trim().length === 0}>
          {saving ? 'Saving key…' : 'Save key and continue'}
        </Button>
      </form>
    </main>
  )
}

function StoreNote({ status }: { status: SecretStatus }) {
  if (status.backend === 'credential-manager') {
    return (
      <p className="mt-4 rounded-md border border-border bg-card px-3 py-3 text-sm leading-relaxed">
        Windows Credential Manager stores the key at {status.location}.
      </p>
    )
  }
  if (status.backend === 'file-stub') {
    return (
      <p className="mt-4 rounded-md border border-border bg-card px-3 py-3 text-sm leading-relaxed">
        This session stores the key in a private file at <span className="font-mono text-xs">{status.location}</span>.
        On Windows the same setting goes to Credential Manager.
      </p>
    )
  }
  return null
}
