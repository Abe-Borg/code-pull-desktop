import { useState } from 'react'
import type { AskResult } from '../../../../shared/contracts'
import { Button } from './ui/button'

export function AnswerCard({ result }: { result: AskResult }) {
  if (result.status === 'failed') {
    return (
      <article data-testid="answer-card" className="rounded-lg border border-destructive/30 bg-card px-5 py-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p data-testid="answer-source" className="font-mono text-[11px] tracking-[0.18em] text-destructive uppercase">
            {failureLabel(result.intent)}
          </p>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{result.ask}</p>
        <p data-testid="answer-failure" className="mt-3 text-sm leading-relaxed text-foreground" role="alert">
          {result.message}
        </p>
      </article>
    )
  }

  return (
    <article data-testid="answer-card" className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-border bg-[#f7f3ea] px-5 py-3">
        <div>
          <p data-testid="answer-source" className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">
            {sourceLabel(result.intent)}
          </p>
          <p data-testid="answer-edition" className="mt-1 font-serif text-xl text-foreground">
            {result.citation.edition}
          </p>
        </div>
        <p className="text-right">
          <span className="block font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">Section</span>
          <span data-testid="answer-section" className="font-serif text-2xl text-foreground">
            {result.citation.section}
          </span>
        </p>
      </div>
      <blockquote
        data-testid="answer-quote"
        className="border-l-4 border-primary px-5 py-4 font-serif text-lg leading-relaxed whitespace-pre-wrap text-foreground"
      >
        “{result.quotedText}”
      </blockquote>
      <div className="flex flex-col gap-3 border-t border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <code data-testid="answer-path" className="font-mono text-xs break-all text-muted-foreground">
          {result.citation.urlOrPath}
        </code>
        <CopyPath value={result.citation.urlOrPath} />
      </div>
      {result.routerReason ? (
        <p className="px-5 pb-4 text-xs text-muted-foreground">Router: {result.routerReason}</p>
      ) : null}
      <p className="sr-only">{result.ask}</p>
    </article>
  )
}

function sourceLabel(intent: 'echo' | 'nfpa-link'): string {
  return intent === 'nfpa-link' ? 'NFPA LiNK' : 'Echo adapter · synthetic'
}

function failureLabel(intent: 'unsupported' | 'error' | 'nfpa-link'): string {
  if (intent === 'unsupported') return 'Unsupported'
  if (intent === 'nfpa-link') return 'NFPA LiNK'
  return 'Claude error'
}

function CopyPath({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        void window.codePull.copyText(value).then(() => {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1200)
        })
      }}
    >
      {copied ? 'Copied' : 'Copy path'}
    </Button>
  )
}
