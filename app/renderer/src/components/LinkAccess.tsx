import { useEffect, useState } from 'react'
import type { LinkStatus } from '../../../../shared/contracts'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

export function LinkAccess() {
  const [status, setStatus] = useState<LinkStatus | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void window.codePull.getLinkStatus().then((next) => {
      setStatus(next)
      setUsername(next.username ?? '')
    })
  }, [])

  async function save() {
    setBusy(true)
    setMessage(null)
    try {
      const next = await window.codePull.saveLinkLogin({ username, password })
      setStatus(next)
      setPassword('')
      setMessage(next.detail ?? 'LiNK login stored on this computer.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function clear() {
    setBusy(true)
    setMessage(null)
    try {
      const next = await window.codePull.clearLinkLogin()
      setStatus(next)
      setUsername('')
      setPassword('')
      setMessage(next.detail ?? 'Stored LiNK login removed.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function signIn() {
    setBusy(true)
    setMessage('A browser window opens when LiNK asks you to sign in or solve a CAPTCHA.')
    try {
      const result = await window.codePull.signInToLink()
      setMessage(result.message)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <h2 className="font-serif text-2xl">NFPA LiNK</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Sign in once with your own LiNK account. Code Pull keeps that browser session in{' '}
        <span className="font-mono text-xs text-foreground">{status?.profilePath ?? 'the browser profile'}</span>.
        A saved username and password are optional and only fill the form.
      </p>
      <form
        className="mt-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="link-username">LiNK username</Label>
          <Input
            id="link-username"
            data-testid="link-username"
            autoComplete="off"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="link-password">LiNK password</Label>
          <Input
            id="link-password"
            data-testid="link-password"
            type="password"
            autoComplete="off"
            value={password}
            placeholder={status?.hasPassword ? 'Password stored. Enter a new one to replace it.' : 'Optional'}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {message ? (
          <p data-testid="link-message" className="text-sm leading-relaxed" role="status">
            {message}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy || username.trim().length === 0}>
            Save LiNK login
          </Button>
          <Button type="button" variant="outline" data-testid="link-sign-in" disabled={busy} onClick={() => void signIn()}>
            {busy ? 'Waiting for LiNK…' : 'Open NFPA LiNK sign-in'}
          </Button>
          <Button type="button" variant="ghost" disabled={busy || !status?.username} onClick={() => void clear()}>
            Clear stored login
          </Button>
        </div>
      </form>
    </section>
  )
}
