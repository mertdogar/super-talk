export interface MentionItem {
  /** Stable identity written into the mention token, e.g. `agent:backend-bot`. */
  id: string
  name: string
  /** Right-aligned secondary label in the completion list. */
  detail?: string
}

export interface MentionGroup {
  /** Section header in the completion list, e.g. "Agents". */
  label: string
  /** Items, filtered against the typed query at completion time. */
  items?: MentionItem[]
}

export interface ComposerInputHandle {
  focus: () => void
  insertAtCursor: (text: string) => void
}

export interface ComposerInputProps {
  value: string
  onChange: (value: string) => void
  /** `@mention` vocabularies, one completion section per group. */
  mentions?: MentionGroup[]
  /** When true, Enter submits the closest `<form>` (Shift+Enter inserts a newline). */
  submitOnEnter?: boolean
  placeholder?: string
  className?: string
  ariaLabel?: string
  readOnly?: boolean
  /** Maximum visible height in pixels before the editor scrolls. */
  maxHeight?: number
}
