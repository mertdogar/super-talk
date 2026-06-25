---
name: super-talk Docs
description: Bold, opinionated documentation for an agent-native communication hub — VitePress neutrals with a single disciplined teal signal.
colors:
  brand-teal: "#0e7490"
  brand-teal-hover: "#155e75"
  brand-teal-dark: "#22d3ee"
  brand-teal-dark-hover: "#67e8f9"
  brand-soft: "#0e74901a"
  glow-teal: "#0891b2"
  glow-cyan: "#06b6d4"
  accent-amber: "#f59e0b"
  accent-amber-ink: "#7c2d12"
  ink: "#3c3c43"
  muted: "#67676c"
  bg: "#ffffff"
  surface: "#f6f6f7"
  divider: "#e2e2e3"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 6vw, 3.5rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.84rem"
    fontWeight: 400
    lineHeight: 1.75
rounded:
  sm: "4px"
  md: "12px"
  pill: "20px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.brand-teal}"
    textColor: "{colors.bg}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.brand-teal-hover}"
    textColor: "{colors.bg}"
  feature-card-featured:
    backgroundColor: "{colors.brand-soft}"
    textColor: "{colors.brand-teal-hover}"
    rounded: "{rounded.md}"
    padding: "24px"
  pill-live:
    backgroundColor: "{colors.brand-soft}"
    textColor: "{colors.brand-teal}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  hero-code:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "18px 20px"
---

# Design System: super-talk Docs

## 1. Overview

**Creative North Star: "The Control Room"**

The docs site reads like the console of a well-run system: a calm, neutral
surface with one teal signal that means *something*. The page is mostly
ink-on-white VitePress chrome — generous line height, clear hierarchy,
nothing decorative competing for attention. Against that quiet, teal is
the status light: it marks links, the live channel pill, and the single
keyword in a terminal block. Because it is rare, it carries weight. The
centerpiece is a hand-built terminal showpiece (`HeroCode`) — three
commands from zero to a running room of agents and humans — framed like an
instrument on a panel rather than a marketing screenshot.

This system is **bold through clarity, not gloss**. Its confidence comes
from stating the thesis plainly and getting the reader to a running hub
fast, not from gradients, hype copy, or stock card grids. It explicitly
rejects neutral default-template docs (it has a point of view),
marketing-hype landings (no "revolutionary platform" language), and the
generic SaaS-purple-gradient aesthetic. The brand is the product's brand:
Signal Teal is the single super-talk color, shared with the web app, so
moving between docs and product feels like one system.

**Key Characteristics:**
- One teal signal over a neutral page; rarity is the point.
- A signature terminal showpiece as the hero, not a hero image.
- Deliberate hierarchy (2-featured + 4-supporting features), never a
  uniform card grid.
- AA-verified in both light and dark; the dark theme lifts teal to
  cyan-400 so it still reads as a signal.
- Density with calm: tight, technical, legible — never cramped or cold.

## 2. Colors

A neutral VitePress canvas carrying a single teal brand voice, with a
warm amber reserved for rare badges and a teal-to-cyan glow under the hero.

### Primary
- **Signal Teal** (`#0e7490`, cyan-700): The one brand color. Links, brand
  text, primary button fill, and the single highlighted keyword in code.
  AA-clean on white (5.36:1). On dark it lifts to **Signal Teal (Lifted)**
  (`#22d3ee`, cyan-400) so it stays legible as a signal, not decoration.
- **Signal Teal Hover** (`#155e75`, cyan-800): Hover/active state for links
  and buttons. *Darker* than the base so it keeps AA on white — never a
  lighter tint (dark: `#67e8f9`, cyan-300).
- **Hero Glow** (`#0891b2` → `#06b6d4`, cyan-600 → cyan-500, at ~33%
  alpha, blurred 44px): The soft same-family gradient behind the hero
  terminal. Background atmosphere only — never used as text or a fill.

### Secondary
- **Beacon Amber** (`#f59e0b`, amber-500): The one warm accent, reserved
  for rare badges or callouts that must stand apart from the teal signal.
  Used as a *pale fill with dark ink* (`#7c2d12` on amber) — never white
  text on amber, which fails contrast.

### Tertiary
- **Deep Teal** (`#155e75`, cyan-800): Body text *on* the teal-tinted
  featured card (7.27:1). The tinted surface gets text in its own hue, not
  washed gray (dark: `#67e8f9`, cyan-300).
- **Brand Soft** (`#0e7490` at 10% alpha, `--vp-c-brand-soft`): The only
  brand fill — featured-card background and the live pill. 16% on dark.

### Neutral
- **Ink** (`#3c3c43`, VitePress `--vp-c-text-1`): Primary body and heading
  text.
- **Muted** (`#67676c`, `--vp-c-text-2`): Secondary text, captions,
  inactive states.
- **Background** (`#ffffff`, `--vp-c-bg`): Page surface.
- **Surface** (`#f6f6f7`, `--vp-c-bg-alt`): Code panels, soft fills, the
  terminal showpiece body.
- **Divider** (`#e2e2e3`, `--vp-c-divider`): Hairline borders and rules.

### Named Rules
**The One Signal Rule.** Teal appears on no more than ~10% of any screen.
In code blocks it marks keywords and types *only* — never a rainbow of
token colors. Comments recede to muted italic; strings and names stay ink.
If a second accent hue shows up anywhere outside the hero glow and the rare
amber badge, it's a bug.

**The Own-Hue Text Rule.** Text on a tinted surface uses a deep step of
that surface's own hue (Deep Teal `#155e75`), never neutral gray. Gray on
a colored background reads as washed-out.

**The Semantic-Reserve Rule.** Teal is the brand; it is never an error or
success state. Red stays reserved for destructive/error, green for
presence/online. The brand signal must never collide with status meaning.

## 3. Typography

**Display / Body Font:** Inter (with `ui-sans-serif, system-ui` fallback) —
VitePress's default base, one family across the whole site in multiple
weights.
**Code Font:** System monospace stack (`ui-monospace, SFMono-Regular,
Menlo, Monaco, Consolas`).

**Character:** One humanist sans doing all the work, differentiated by
weight and size rather than a second face. Monospace is reserved for
commands, the terminal showpiece, and the channel pills — it signals
"this is a thing you type or run."

### Hierarchy
- **Display** (700, `clamp(2.5rem, 6vw, 3.5rem)`, line-height 1.1): The
  hero name, in *solid* Signal Teal (no gradient text). Tight tracking
  (-0.02em). Capped well under the 6rem ceiling.
- **Headline** (600, 1.75rem, 1.25): Page `h1` and section leads.
- **Title** (600, 1.25rem, 1.4): `h2`/`h3`, feature-card titles (featured
  pair steps up to 18px to earn their space).
- **Body** (400, 1rem, 1.7): Prose. Comfortable measure; cap reading
  columns around 65–75ch.
- **Label** (500, 0.75rem, 1.4): Pills, file chips, captions.
- **Code** (400, 0.84rem, 1.75): Terminal showpiece and inline code; loose
  line-height for scan-ability, ligatures off.

### Named Rules
**The One Voice Rule.** No second display face. Hierarchy is weight and
size within Inter; reach for monospace only to mean "command / terminal,"
never for flavor.

## 4. Elevation

Flat by default. The page is built from hairline dividers and tonal fills,
not shadows — VitePress's quiet, document-like depth. There is exactly one
shadow in the system, and it is brand-tinted.

### Shadow Vocabulary
- **Instrument Glow** (`box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 12px 32px
  rgba(14,116,144,0.1)`): Reserved for the `HeroCode` terminal showpiece.
  A near-black contact shadow plus a soft *teal* ambient lift, so the one
  elevated object on the page glows in the brand hue.

### Named Rules
**The Single-Shadow Rule.** Surfaces are flat. The only box-shadow in the
system is the teal Instrument Glow under the hero terminal. Cards, buttons,
and panels get borders and tonal fills, never drop shadows. If a shadow
appears on anything but the hero instrument, remove it.

## 5. Components

### Buttons
- **Shape:** Pill (20px radius — VitePress default).
- **Primary:** Signal Teal fill (`#0e7490`), white text (5.36:1). On
  mobile, minimum 44px tall to clear the touch-target floor.
- **Hover / Focus:** Fill darkens to cyan-800 (`#155e75`); visible
  focus-visible ring required for keyboard users.

### Chips / Pills
- **Style:** Pill (20px), monospace label. Default pill is neutral
  (`--vp-c-gray-soft` fill, muted text).
- **Live variant:** Brand Soft fill with Signal Teal text — the one
  "active/agents" status marker (humans ↔ agents in the hero foot).

### Cards / Containers
- **Corner Style:** 12px radius.
- **Feature grid:** A deliberate 12-column composition — two featured cards
  span 6 each and lead; four supporting cards drop to span-3 (four-up) on
  desktop. Never the uniform 6-up VitePress default grid.
- **Featured card:** Brand Soft background, Deep Teal body text, no border.
  Carries the one brand tint in the composition.
- **Border / Shadow:** Hairline divider border; no shadow (see Elevation).
- **Internal Padding:** 24px.

### Inputs / Fields
- VitePress defaults (search, etc.): surface fill, hairline border, brand
  focus ring. No custom field styling beyond the inherited theme.

### Navigation
- Top nav and sidebar are VitePress chrome. Active and hover states use
  Signal Teal; links are teal, body stays ink. Mobile collapses to the
  VitePress hamburger; CTA buttons keep the 44px floor.

### HeroCode (signature component)
The centerpiece terminal: a 480px-max panel with a chrome bar (three dots +
"terminal" file label), a monospace body showing three commands to a
running hub, and a foot row of pills (`humans ↔ agents · one hub`). Surface
fill, 12px radius, Instrument Glow shadow. Tokenization is restrained: teal
for keywords/types, muted for strings, ink for names, muted-italic for
comments. On tablet/mobile it flows below the hero copy (order 2) at full
width and the background glow is dropped.

## 6. Do's and Don'ts

### Do:
- **Do** keep teal to ≤10% of any screen — links, the live pill, one
  keyword color in code. Rarity is the signal (**The One Signal Rule**).
- **Do** put text on tinted surfaces in the surface's own deep hue
  (`#155e75`), never neutral gray (**The Own-Hue Text Rule**).
- **Do** keep teal as brand only — never as an error/success state; red
  stays error, green stays presence (**The Semantic-Reserve Rule**).
- **Do** lead the landing with the thesis and a copyable path to a running
  hub; momentum over feature tours.
- **Do** keep the page flat — borders and tonal fills for structure; the
  one teal Instrument Glow is reserved for the hero terminal.
- **Do** hold AA contrast in both themes and honor
  `prefers-reduced-motion` on every transition.
- **Do** differentiate hierarchy with Inter weight and size; use monospace
  only to mean "command / terminal."

### Don't:
- **Don't** ship neutral default-template docs with no point of view — the
  site must be unmistakably super-talk.
- **Don't** use marketing-hype copy, gradient hero *metrics*, or
  "revolutionary platform" language. Boldness is a clear thesis, not
  adjectives.
- **Don't** drift toward a Slack-clone look or a generic SaaS-purple
  gradient aesthetic (carried from the product's anti-references).
- **Don't** reintroduce `background-clip: text` gradient text. The hero
  name is solid Signal Teal; emphasis comes from weight and size.
- **Don't** add drop shadows to cards, buttons, or panels (**The
  Single-Shadow Rule**).
- **Don't** introduce a second accent hue outside the hero glow and the
  rare amber badge, or rainbow-tokenize code blocks.
