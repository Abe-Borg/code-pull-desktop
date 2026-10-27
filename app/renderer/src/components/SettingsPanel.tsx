import { useState } from 'react'
import type { SecretStatus } from '../../../../shared/contracts'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

export function SettingsPanel({
  status,
  onStatus,
}: {
  status: SecretStatus
  onStatus: (status: SecretStatus) => void
}) {
  const [key, setKey] = useState('')
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const next = await window.codePull.saveKey(key)
      if (!next.configured || next.backend === 'unavailable') {
        setError(next.detail ?? 'The key was not stored.')
        return
      }
      setKey('')
      onStatus(next)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setSaving(false)
    }
  }

  async function clear() {
    if (!confirmRemove) {
      setConfirmRemove(true)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const next = await window.codePull.clearKey()
      if (next.backend === 'unavailable') {
        setError(next.detail ?? 'The key is still stored.')
        setConfirmRemove(false)
        return
      }
      onStatus(next)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-2xl">Key</h2>
        <p className="font-mono text-xs text-muted-foreground">{status.hint ?? 'No key stored'}</p>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Stored at <span className="font-mono text-xs text-foreground">{status.location}</span>
      </p>
      <form
        className="mt-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="replace-key">Replace Claude API key</Label>
          <div className="flex gap-2">
            <Input
              id="replace-key"
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
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={saving || key.trim().length === 0}>
            {saving ? 'Saving…' : 'Save replacement'}
          </Button>
          <Button type="button" variant="destructive" disabled={saving} onClick={() => void clear()}>
            {confirmRemove ? 'Confirm remove' : 'Remove key'}
          </Button>
        </div>
      </form>
    </section>
  )
}
