# Design

Light theme, mobile first (360–430 px), then tablet and desktop. The look is original; it does not
copy the interface, branding or characters of other learning apps.

## Palette (CSS custom properties in `src/styles/tokens.css`)

| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#ffffff` | page background |
| `--color-surface` | `#f6f8f4` | cards, list rows |
| `--color-border` | `#dde3d8` | outlines |
| `--color-text` | `#1d2b1a` | main text |
| `--color-text-muted` | `#5b6b57` | secondary text |
| `--color-primary` | `#58a83c` | brand green, progress |
| `--color-primary-dark` | `#3f8a2a` | fills only (progress fill, mascot outline): 4.3:1 on white |
| `--color-primary-text` | `#327021` | green TEXT on light backgrounds: 6.0:1 on white |
| `--color-ink` | `#1f2a1d` | dark button face |
| `--color-ink-edge` | `#0d140c` | dark button bottom edge |
| `--color-correct` | `#2e7d32` | correct (always with icon + text) |
| `--color-wrong` | `#c62828` | wrong (always with icon + text) |
| `--color-almost` | `#b26a00` | "almost" (always with icon + text) |

## Rules

- Never rely on colour alone: feedback uses an icon and a text label as well.
- Contrast of text on its background is at least 4.5:1.
- Primary button: dark face with a thicker bottom edge (a 4 px solid darker shadow) that shrinks on press.
- Choice cards: large, rounded (16 px radius), whole card is the tap target, min height 64 px.
- Deck lists: compact rows, 56 px high.
- Learning screens: a progress bar fixed at the top.
- Buttons with only an icon always have an `aria-label`. Visible keyboard focus ring everywhere.
- Mascot "Sprout": a simple green sprout with a "page" on its head, drawn in SVG, states: normal, happy, encouraging.
- Motion is short (≤ 200 ms) and disabled under `prefers-reduced-motion`.

## Measured contrast (WCAG ratios, computed from the hex values)

text on background 14.9 · muted text 6.3 · green text `#327021` on white 6.0, on soft green 5.3 ·
white on dark button 14.9 · wrong red 5.6 · correct green 5.1 · "almost" amber 6.1.
White text on the brand green `#58a83c` is only 3.0, so the brand green is never used behind text.
