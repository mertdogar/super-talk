import type {
  Completion,
  CompletionContext,
  CompletionResult,
  CompletionSection,
  CompletionSource,
} from '@codemirror/autocomplete'
import type { MentionGroup, MentionItem } from './types'

/** `@partial` at a word boundary, cursor right after it. */
const MENTION_QUERY = /(?:^|\s)@([^\s@]*)$/

function lineTextBefore(context: CompletionContext): string {
  const line = context.state.doc.lineAt(context.pos)
  return context.state.sliceDoc(line.from, context.pos)
}

/** `]` would terminate the token early; display names are arbitrary user text. */
function safeName(name: string): string {
  return name.replaceAll(']', ')')
}

function toMentionCompletion(item: MentionItem, section: CompletionSection): Completion {
  return {
    label: item.name,
    type: 'variable',
    detail: item.detail,
    section,
    apply: (view, _completion, from, to) => {
      // `from` sits after the `@` trigger; swallow it with the token.
      const start = from - 1
      const insert = `@[${safeName(item.name)}](${item.id}) `
      view.dispatch({
        changes: { from: start, to, insert },
        selection: { anchor: start + insert.length },
        userEvent: 'input.complete',
      })
    },
  }
}

function matchesQuery(name: string, query: string): boolean {
  return name.toLowerCase().includes(query.toLowerCase())
}

export function buildMentionCompletion(getGroups: () => readonly MentionGroup[]): CompletionSource {
  return (context: CompletionContext): CompletionResult | null => {
    const groups = getGroups()
    if (groups.length === 0) return null
    const match = MENTION_QUERY.exec(lineTextBefore(context))
    if (!match) return null
    const query = match[1] ?? ''

    const options = groups.flatMap((group, rank) => {
      const section: CompletionSection = { name: group.label, rank }
      return (group.items ?? [])
        .filter((item) => matchesQuery(item.name, query))
        .map((item) => toMentionCompletion(item, section))
    })

    if (options.length === 0 && !context.explicit && !query) return null
    return { from: context.pos - query.length, options }
  }
}
