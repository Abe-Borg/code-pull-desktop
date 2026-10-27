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
    const intent = /\b(nfpa|ibc|irc|ifc|imc|nec|asme|astm|section|§)\b/i.test(ask) ? 'echo' : 'unsupported'
    const payload = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            intent,
            reason: intent === 'echo' ? 'Section lookup.' : 'Not a section lookup.',
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
