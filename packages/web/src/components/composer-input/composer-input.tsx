import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, placeholder as placeholderExt } from '@codemirror/view'
import { autocompletion, completionKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, insertNewlineAndIndent } from '@codemirror/commands'
import { cn } from '@/lib/utils'
import { buildMentionCompletion } from './completion'
import { mentionChips } from './decorations'
import { composerTheme } from './theme'
import type { ComposerInputHandle, ComposerInputProps } from './types'

export const ComposerInput = forwardRef<ComposerInputHandle, ComposerInputProps>(
  function ComposerInput(
    { value, onChange, mentions, submitOnEnter, placeholder, className, ariaLabel, readOnly, maxHeight },
    ref,
  ) {
    const hostRef = useRef<HTMLDivElement>(null)
    const viewRef = useRef<EditorView | null>(null)
    const onChangeRef = useRef(onChange)
    onChangeRef.current = onChange
    // Read vocabularies through a ref so live roster changes never recreate the editor.
    const mentionsRef = useRef(mentions)
    mentionsRef.current = mentions

    useImperativeHandle(
      ref,
      () => ({
        focus: () => viewRef.current?.focus(),
        insertAtCursor: (text: string) => {
          const view = viewRef.current
          if (!view) return
          const sel = view.state.selection.main
          view.dispatch({
            changes: { from: sel.from, to: sel.to, insert: text },
            selection: { anchor: sel.from + text.length },
            userEvent: 'input.type',
          })
          view.focus()
        },
      }),
      [],
    )

    useEffect(() => {
      const host = hostRef.current
      if (!host) return

      const heightTheme = maxHeight
        ? EditorView.theme({ '.cm-scroller': { maxHeight: `${maxHeight}px` } })
        : []

      // Completion's own Enter (accept) binds at higher precedence inside autocompletion(), so
      // submit only fires with the menu closed.
      const submitKeys = submitOnEnter
        ? [
            {
              key: 'Enter',
              run: () => {
                host.closest('form')?.requestSubmit()
                return true
              },
            },
            { key: 'Shift-Enter', run: insertNewlineAndIndent },
          ]
        : []

      const state = EditorState.create({
        doc: value,
        extensions: [
          history(),
          mentionChips,
          autocompletion({
            override: [buildMentionCompletion(() => mentionsRef.current ?? [])],
            activateOnTyping: true,
            icons: false,
          }),
          composerTheme,
          heightTheme,
          placeholder ? placeholderExt(placeholder) : [],
          EditorView.editable.of(!readOnly),
          EditorState.readOnly.of(Boolean(readOnly)),
          EditorView.lineWrapping,
          keymap.of([...submitKeys, ...defaultKeymap, ...historyKeymap, ...completionKeymap]),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return
            onChangeRef.current(update.state.doc.toString())
          }),
        ],
      })

      const view = new EditorView({ state, parent: host })
      viewRef.current = view
      return () => {
        view.destroy()
        viewRef.current = null
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [submitOnEnter, placeholder, readOnly, maxHeight])

    useEffect(() => {
      const view = viewRef.current
      if (!view) return
      const current = view.state.doc.toString()
      if (current === value) return
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
    }, [value])

    return (
      <div className={cn('min-w-0 flex-1', className)} aria-label={ariaLabel}>
        <div ref={hostRef} />
      </div>
    )
  },
)
