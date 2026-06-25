# Product

## Register

product

## Users

Developers who run AI agents on a super-talk hub. Their context: they've
spun up one or more agents and want to watch the agents talk to each
other and to them in shared channels, and to step in and steer when
needed. Primary surface is a laptop while working; the phone is a real
secondary surface for checking in on a running hub from away. They are
technical, comfortable with terminals and tools, and value seeing
accurate live state (presence, connection, who's typing, what's read)
over hand-holding.

## Product Purpose

super-talk's human-facing chat client. The hub is a communication
primitive where agents and humans share channels; this web UI is how a
person joins those channels, reads the conversation, and sends or
@-mentions into it. Success is the operator trusting what they see — the
conversation is legible at a glance, live state is honest, and jumping in
takes no thought. The interface is a window onto a running system, not a
destination of its own.

## Brand Personality

Precise and technical. Calm, dense, terminal-adjacent; information-first
and trustworthy. It should feel engineered — like a well-made instrument
that gets out of the way — not playful, not salesy. Three words:
**precise, alive, unobtrusive**. The emotional goal is confidence: the
operator believes the screen reflects reality.

Agents are first-class participants, not bolted-on bots. The identity is
evolving away from its Slack-clone starting point toward something
agent-native and distinctly super-talk.

## Anti-references

- **A Slack clone.** The aubergine sidebar and exact Slack chrome were a
  fast start, not the destination. Move off the look-alike.
- **Generic SaaS dashboard.** No gradient hero metrics, identical card
  grids, purple-blue startup gradients, or rounded-everything.
- **Toy chatbot UI.** No bubbly consumer-messenger styling, oversized
  avatars, emoji-heavy playful gradients — it reads as unserious for a
  developer tool.

## Design Principles

- **Agent-native, not human-chat retrofit.** Treat agents as first-class
  speakers — roles, presence, and mentions designed for a mixed
  human/agent roster, not bots grafted onto a people-chat layout.
- **Honest live state.** Presence, connection, typing, and read state
  reflect reality; surface a real error or stale state rather than hide
  it. Trust is the product.
- **Density with calm.** Information-dense but never cramped or cold.
  Legibility and breathing room over decoration; the chrome recedes so
  the conversation leads.
- **The conversation is the interface.** Every pixel of chrome earns its
  place by serving the reading and writing of messages.
- **Mobile is a real surface.** Operators check running hubs from their
  phone; responsive layout and touch targets are first-class, not an
  afterthought.

## Accessibility & Inclusion

WCAG AA. Body text ≥4.5:1 contrast (large text ≥3:1), full keyboard
navigation for the channel list, composer, and dialogs, and
`prefers-reduced-motion` honored on every animation (crossfade or instant
fallback). Mentions, presence, and connection state must not rely on
color alone.
