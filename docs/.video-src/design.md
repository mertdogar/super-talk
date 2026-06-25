# super-talk — Demo Video Design

"The Control Room": one teal signal over a deep, calm canvas. Light UI surfaces
float on a dark teal-tinted backdrop; the terminal is the instrument. Brand colors
verbatim from the product (web UI `index.css` + docs `brand.css`), used at video scale.

## Palette

Colors are authored as OKLCH (headless Chrome renders them natively) to match the
product exactly. Hex equivalents listed for reference.

| Role | Value (OKLCH) | ~Hex | Use |
|---|---|---|---|
| canvas | `oklch(0.23 0.034 226)` | `#12333c` | video backdrop (deep control-room teal) |
| canvas-deep | `oklch(0.18 0.03 226)` | `#0c272f` | terminal body, vignette floor |
| signal | `oklch(0.52 0.094 223)` | `#0e7490` | the one brand signal — buttons, active, key accent |
| signal-lifted | `oklch(0.78 0.13 207)` | `#22d3ee` | teal on dark surfaces (keywords, key text) |
| glow | `oklch(0.6 0.13 215)` | `#0891b2` | radial atmosphere behind focal objects |
| sidebar | `oklch(0.301 0.039 226)` | `#27424b` | web-UI sidebar |
| sidebar-darker | `oklch(0.254 0.032 224)` | `#1f353d` | sidebar header/footer wells |
| sidebar-fg | `oklch(0.959 0.013 209)` | `#eef4f4` | sidebar text |
| sidebar-muted | `oklch(0.796 0.041 214)` | `#a9c4cb` | sidebar secondary text |
| sidebar-active | `oklch(0.52 0.094 223)` | `#0e7490` | active channel row |
| online | `oklch(0.76 0.16 152)` | `#3ecf7e` | presence dot (green — never the brand color) |
| surface | `oklch(1 0 0)` | `#ffffff` | web-UI content + cards |
| surface-alt | `oklch(0.97 0.001 286)` | `#f6f6f7` | wells, chrome bars |
| ink | `oklch(0.21 0.006 285)` | `#27272f` | primary text on light |
| muted-ink | `oklch(0.55 0.014 286)` | `#7c7c84` | secondary text on light |
| term-fg | `oklch(0.93 0.01 210)` | `#e6edf0` | terminal text |
| term-muted | `oklch(0.62 0.03 214)` | `#7b969e` | terminal comments |
| border | `oklch(0.92 0.004 286)` | `#e6e6e8` | hairline on light |
| amber | `#f59e0b` | `#f59e0b` | rare warm beat (reserved; used once max) |

**The One Signal Rule.** Teal ≤ ~10% of any frame. It marks the active channel,
buttons, the owner key, and one keyword color in the terminal — nothing else. Green
is presence only; it is never the brand. No second accent hue except a single
optional amber beat.

## Typography

| Role | Family | Use |
|---|---|---|
| UI / display | Lato (web-UI face), fallback ui-sans-serif | headings, web-UI text, captions |
| mono | ui-monospace / SFMono / Menlo | terminal, the owner key, channel + code chips |

One sans doing the work, differentiated by weight/size. Monospace means
"command / terminal / key you type." No second display face. Letter-spacing on
display ≥ -0.02em.

## Motion

Ease-out exponential (power3/power4/expo.out), no bounce/elastic. Terminal text
types in; UI elements rise + fade; scene swaps are crossfades or a soft teal wipe.
Caption strip rises from the lower third per scene. Reduced-motion handled at the
embed (static poster), not in the comp.

## Depth

Flat surfaces. The only glow is a soft teal radial behind the focal object
(terminal / browser window) — the "instrument glow" from the product. Light UI
cards get a single soft shadow to lift off the dark canvas; no other shadows.

## Do / Don't

- **Do** keep teal rare and meaningful; deep teal canvas, light UI floating on it.
- **Do** recreate the real UI faithfully (sidebar, enroll card, admin approve, chat).
- **Don't** rainbow-tokenize the terminal; teal = keywords/key only, comments recede.
- **Don't** use gradient text, drop shadows on flat panels, or a second accent hue.
- **Don't** let green read as brand or teal read as success/error.
