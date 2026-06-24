import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { findMentionTokens, mentionKind } from './parse'

class MentionChipWidget extends WidgetType {
  constructor(
    readonly name: string,
    readonly id: string,
  ) {
    super()
  }

  override eq(other: MentionChipWidget): boolean {
    return other.name === this.name && other.id === this.id
  }

  override toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'st-composer__mention'
    span.dataset.kind = mentionKind(this.id)
    span.textContent = `@${this.name}`
    return span
  }
}

function buildMentionChips(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  for (const mention of findMentionTokens(view.state.doc.toString())) {
    builder.add(
      mention.from,
      mention.to,
      Decoration.replace({ widget: new MentionChipWidget(mention.name, mention.id) }),
    )
  }
  return builder.finish()
}

/** Replaces raw `@[name](id)` tokens with atomic chips — the cursor steps over a chip as one unit
 * and backspace removes the whole token. */
export const mentionChips = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = buildMentionChips(view)
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildMentionChips(update.view)
      }
    }
  },
  {
    decorations: (v) => v.decorations,
    provide: (plugin) =>
      EditorView.atomicRanges.of((view) => view.plugin(plugin)?.decorations ?? Decoration.none),
  },
)
