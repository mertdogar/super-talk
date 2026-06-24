import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { findMentionTokens, mentionKind } from '@/components/composer-input/parse'

const KIND_CLASS: Record<string, string> = {
  agent: 'bg-sidebar-active/15 text-sidebar-active',
  user: 'bg-primary/15 text-primary',
}

/** Renders a stored message, turning canonical `@[name](id)` mention tokens into highlighted chips
 * (read-only). Plain text otherwise — no markdown. */
export function MessageText({ text }: { text: string }): React.JSX.Element {
  const tokens = findMentionTokens(text)
  if (tokens.length === 0) return <>{text}</>

  const parts: ReactNode[] = []
  let cursor = 0
  for (const token of tokens) {
    if (token.from > cursor) parts.push(text.slice(cursor, token.from))
    parts.push(
      <span
        key={token.from}
        title={token.id}
        className={cn(
          'mx-px rounded px-1 font-medium',
          KIND_CLASS[mentionKind(token.id)] ?? 'bg-muted text-foreground',
        )}
      >
        @{token.name}
      </span>,
    )
    cursor = token.to
  }
  if (cursor < text.length) parts.push(text.slice(cursor))
  return <>{parts}</>
}
