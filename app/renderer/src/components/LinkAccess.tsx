import { useEffect, useState, type FormEvent } from 'react'
import type { LinkSignInResult, LinkStatus } from '../../../../shared/contracts'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

export function SourceAccess({
  title,
  accountName,
  testId,
  load,
  saveLogin,
  clearLogin,
  signIn,
}: {
  title: string
  accountName: string
  testId: string
  load: () => Promise<LinkStatus>
  saveLogin: (input: { username: string; password: string }) => Promise<LinkStatus>
  clearLogin: () => Promise<LinkStatus>
  signIn: () => Promise<LinkSignInResult>
}) {
  const [status, setStatus] = useState<LinkStatus | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void load().then((next) => {
      setStatus(next)
      setUsername(next.username ?? '')
    })
  }, [load])

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      const next = await saveLogin({ username, password })
      setStatus(next)
      setPassword('')
      setMessage(next.detail ?? `${title} login stored on this computer.`)
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
      const next = await clearLogin()
      setStatus(next)
      setUsername('')
      setPassword('')
      setMessage(next.detail ?? `Stored ${title} login removed.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function openSignIn() {
    setBusy(true)
    setMessage(`A browser window opens when ${title} asks you to sign in or solve a CAPTCHA.`)
    try {
      const result = await signIn()
      setMessage(result.message)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <h2 className="font-serif text-2xl">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Sign in once with your own {accountName} account. Code Pull keeps that browser session in{' '}
        <span className="font-mono text-xs text-foreground">{status?.profilePath ?? 'the browser profile'}</span>.
        A saved username and password are optional and only fill the form.
      </p>
      <form className="mt-4 space-y-3" onSubmit={(event) => void save(event)}>
        <div className="space-y-2">
          <Label htmlFor={`${testId}-username`}>{accountName} username</Label>
          <Input
            id={`${testId}-username`}
            data-testid={`${testId}-username`}
            autoComplete="off"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${testId}-password`}>{accountName} password</Label>
          <Input
            id={`${testId}-password`}
            data-testid={`${testId}-password`}
            type="password"
            autoComplete="off"
            value={password}
            placeholder={status?.hasPassword ? 'Password stored. Enter a new one to replace it.' : 'Optional'}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {message ? (
          <p data-testid={`${testId}-message`} className="text-sm leading-relaxed" role="status">
            {message}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy || username.trim().length === 0}>
            Save {accountName} login
          </Button>
          <Button type="button" variant="outline" data-testid={`${testId}-sign-in`} disabled={busy} onClick={() => void openSignIn()}>
            {busy ? `Waiting for ${accountName}…` : `Open ${title} sign-in`}
          </Button>
          <Button type="button" variant="ghost" disabled={busy || !status?.username} onClick={() => void clear()}>
            Clear stored login
          </Button>
        </div>
      </form>
    </section>
  )
}
