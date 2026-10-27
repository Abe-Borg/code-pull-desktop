function intentFor(ask: string): 'nfpa-link' | 'echo' | 'unsupported' {
  if (/\bnfpa\s+\d+/i.test(ask)) return 'nfpa-link'
  if (/\b(ibc|irc|ifc|imc|nec|asme|astm|section|§)\b/i.test(ask)) return 'echo'
  return 'unsupported'
}

export function createSmokeFetch(): typeof fetch {
  return async (_input, init) => {
    const raw = typeof init?.body === 'string' ? init.body : '{}'
    let ask = ''
    try {
      const parsed = JSON.parse(raw) as { messages?: Array<{ content?: string }> }
      ask = parsed.messages?.[0]?.content ?? ''
    } catch {
      ask = ''
    }
    const intent = intentFor(ask)
    const payload = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            intent,
            reason:
              intent === 'unsupported'
                ? 'Not a section lookup.'
                : intent === 'nfpa-link'
                  ? 'NFPA section lookup.'
                  : 'Section lookup.',
          }),
        },
      ],
      stop_reason: 'end_turn',
    }
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
}
