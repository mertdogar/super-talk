/** `@[Display Name](role:name)` — id carries identity, name is presentation. Ids may contain
 * spaces (e.g. `user:Alice Doe`), so the id pattern forbids only parens, not whitespace. */
const MENTION_REGEX = /@\[([^\]]+)\]\(([^()]+)\)/g

export interface ComposerMention {
  id: string
  name: string
  from: number
  to: number
}

export function findMentionTokens(text: string): ComposerMention[] {
  const mentions: ComposerMention[] = []
  MENTION_REGEX.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = MENTION_REGEX.exec(text)) !== null) {
    mentions.push({
      name: match[1] ?? '',
      id: match[2] ?? '',
      from: match.index,
      to: match.index + match[0].length,
    })
  }
  return mentions
}

/** Flatten `@[name](id)` tokens to a plain `@name` (for previews / empty checks). */
export function flattenMentions(text: string): string {
  return text.replace(MENTION_REGEX, (_m, name: string) => `@${name}`)
}

/** `media:42` → `media`; bare ids → `element`. Colors chips per vocabulary via `[data-kind]`. */
export function mentionKind(id: string): string {
  const colon = id.indexOf(':')
  return colon > 0 ? id.slice(0, colon) : 'element'
}
