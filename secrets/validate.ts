export function validateClaudeKey(raw: string): string {
  const key = raw.trim()
  if (!key.startsWith('sk-ant-')) {
    throw new Error('Paste a Claude API key. It starts with sk-ant-.')
  }
  if (/\s/.test(key)) {
    throw new Error('The Claude API key has to be a single token.')
  }
  if (key.length < 20) {
    throw new Error('That Claude API key is too short.')
  }
  return key
}

export function hintForKey(secret: string | null): string | null {
  if (!secret) return null
  if (secret.length < 8) return 'stored'
  return `••••${secret.slice(-4)}`
}
