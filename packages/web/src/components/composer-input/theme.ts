import { EditorView } from '@codemirror/view'

// CodeMirror styling for the composer, themed against the app's shadcn CSS vars so the editor,
// mention chips, and completion popup match the rest of the UI.
const baseTheme = EditorView.theme({
  '&': {
    color: 'var(--foreground)',
    backgroundColor: 'transparent',
    fontSize: '15px',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.55' },
  '.cm-content': { padding: '8px 0', caretColor: 'var(--foreground)' },
  '.cm-line': { padding: '0 4px' },
  '.cm-placeholder': { color: 'var(--muted-foreground)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--foreground)' },

  // Atomic mention chip (widget replacing the raw `@[name](id)` token).
  '.st-composer__mention': {
    borderRadius: '4px',
    padding: '0 4px',
    fontWeight: '500',
    whiteSpace: 'nowrap',
    background: 'color-mix(in oklch, var(--primary) 16%, transparent)',
    color: 'var(--primary)',
  },
  '.st-composer__mention[data-kind="agent"]': {
    background: 'color-mix(in oklch, var(--sidebar-active) 20%, transparent)',
    color: 'var(--sidebar-active)',
  },

  // Completion popup — match the shadcn popover surface.
  '.cm-tooltip': {
    background: 'var(--popover)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    boxShadow: '0 8px 24px -8px rgb(0 0 0 / 0.25)',
    color: 'var(--popover-foreground)',
    fontSize: '13px',
    zIndex: '9999',
    overflow: 'hidden',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul': {
    maxHeight: '320px',
    padding: '6px',
    fontFamily: 'inherit',
    minWidth: '220px',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
    display: 'flex',
    alignItems: 'center',
    minHeight: '30px',
    padding: '6px 10px',
    borderRadius: '6px',
    color: 'var(--popover-foreground)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    background: 'var(--accent)',
    color: 'var(--accent-foreground)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > completion-section': {
    display: 'block',
    padding: '10px 10px 4px',
    fontSize: '10px',
    fontWeight: '600',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: 'var(--muted-foreground)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > completion-section:first-child': {
    paddingTop: '4px',
  },
  '.cm-tooltip.cm-tooltip-autocomplete .cm-completionMatchedText': {
    color: 'var(--primary)',
    textDecoration: 'none',
    fontWeight: '600',
  },
  '.cm-tooltip.cm-tooltip-autocomplete .cm-completionDetail': {
    marginLeft: 'auto',
    paddingLeft: '16px',
    fontStyle: 'normal',
    fontSize: '12px',
    color: 'var(--muted-foreground)',
  },
})

export const composerTheme = [baseTheme]
