# Design

Light theme, mobile first (360–430 px), then tablet and desktop. The look is original; it does not
copy the interface, branding or characters of other learning apps.

The style in one line: soft green page, white "chunky" surfaces with a thicker bottom edge (like the dark
button), rounded corners, short springy motion, and Sprout reacting to what you do.

## Palette (CSS custom properties in `src/styles/tokens.css`)

| Token | Value | Use |
|---|---|---|
| `--color-page` | `#f4f8ef` | page background (behind the white surfaces) |
| `--color-bg` / `--color-surface` | `#ffffff` | faces of buttons, inputs, cards, list rows |
| `--color-surface-strong` | `#eaf0e5` | tracks (progress, segmented control), hover |
| `--color-border` | `#dde5d6` | outlines |
| `--color-edge` | `#d3dccb` | the "3D" bottom edge of light surfaces |
| `--color-text` | `#1d2b1a` | main text |
| `--color-text-muted` | `#55654f` | secondary text |
| `--color-primary` | `#58a83c` | brand green, progress (fills only) |
| `--color-primary-dark` | `#3f8a2a` | fills only (progress fill, mascot outline): 4.3:1 on white |
| `--color-primary-text` | `#327021` | green TEXT on light backgrounds: 6.0:1 on white |
| `--color-primary-soft` | `#e6f3df` | selected option, active tab pill |
| `--color-ink` | `#1f2a1d` | dark button face, the main study mode tile |
| `--color-ink-edge` | `#0d140c` | dark button bottom edge |
| `--color-correct` / `-soft` | `#2e7d32` / `#e6f3e7` | correct (always with icon + text) |
| `--color-wrong` / `-soft` | `#c62828` / `#fbe9e9` | wrong (always with icon + text) |
| `--color-almost` / `-soft` | `#8f5500` / `#fdf0d8` | "almost" (always with icon + text) |

Icon chips (stat tiles, study modes) use soft pastel backgrounds (blue `#e3effc`, orange `#ffeadb`, violet
`#f3e8fd`, green). The icons are decoration: the text next to them says the same.

## Rules

- Never rely on colour alone: feedback uses an icon and a text label as well. The active tab has a pill shape
  behind the icon, the chosen segment is a raised white pill, a matched tile is dashed.
- Contrast of text on its background is at least 4.5:1.
- Primary button: dark face with a thicker bottom edge (a 4 px solid darker shadow) that shrinks on press.
  Secondary buttons, choice cards, tiles, mode tiles and the question card share the same "edge" idea in light
  colours.
- Choice cards: large, rounded (20 px radius), whole card is the tap target, min height 64 px. A right answer
  "pops", a wrong one shakes; ✓ / ✗ sit in a coloured circle.
- Deck lists: compact rows, 56 px high, with a coloured letter square (the same deck always gets the same colour).
- Deck screen: the four study modes are tiles in a 2 × 2 grid (icon, name, one-line description); Learn is the
  dark main tile. The link's accessible name is just the mode; the description is its accessible description.
- Learning screens: a top bar with the close button, a thick progress bar (gradient with a shine, springy width)
  and Sprout.
- Results: the percentage inside a ring that fills up; confetti for a great result (from 90 %, or a Match game
  with no mistakes or a new best time).
- Buttons with only an icon always have an `aria-label`. Visible keyboard focus ring everywhere.
- Headings, buttons and big numbers use `ui-rounded` where the system has it (Apple devices), the system font
  elsewhere. No web fonts are downloaded.

## Motion

- Micro-interactions (press, hover, focus) take 150 ms. Things that appear (a new screen or question, a message,
  the dialog) slide or pop in within about 300 ms; the result ring and confetti take up to ~2 s and run once.
- Sprout's idle motion loops softly; its reactions run once.
- Under `prefers-reduced-motion` all of it is off: every animation plays at most once in 0.01 ms (base.css),
  Sprout and the speech bubble stand still, the confetti is not drawn.

## Mascot "Sprout"

A simple green sprout with a "page" on its head, drawn in SVG (`src/ui/components/Mascot.tsx`). The moving parts
are separate groups animated in `components.css`:

- **Idle:** the body breathes, the eyes blink, the leaves sway.
- **Moods:** `normal`; `happy` (closed smiling eyes, cheeks, a hop); `encouraging` (brows, a waving arm, a nod);
  `thinking` (eyes up, thought dots, a slow tilt); `oops` (worried brows, a small "o", a drop of sweat, a wobble);
  `celebrate` (both arms up, sparkles, a jump).
- **Reactions:** a new `reaction` number replays the mood's animation (the moving group is drawn anew).
- **Where:** the home greeting card (tap to pat: Sprout jumps and says one of its lines), study top bar
  (reacts to answers, see `core/cheer.ts`), result screens, empty states.
- A low score is met with encouragement, never with a sad face.

## Measured contrast (WCAG ratios, computed from the hex values)

text on background 14.9 (on the page colour 13.8) · muted text 6.2 (on the page colour 5.8, on the soft
red/amber/green message backgrounds 5.3–5.5, on the track colour 5.4) · green text `#327021` on white 6.0, on the
page colour 5.6, on soft green 5.3 · white on dark button 14.9 · wrong red 5.6 · correct green 5.1 · "almost"
amber 6.1 · light mode description `#d5e2cf` on the dark tile 11.
White text on the brand green `#58a83c` is only 3.0, so the brand green is never used behind text.
axe-core found no violations on 13 screens and 8 extra states (answer feedback, combo, test, Match result).

## Icons

The app icon is the same idea as the mascot: a page with a sprout on top, white and dark green on the brand green.
`scripts/make-icons.ts` draws it (no image libraries) into `icon-192.png`, `icon-512.png` (rounded, transparent corners),
`icon-maskable-512.png` (full bleed; everything important is inside the central 80 % "safe zone") and
`apple-touch-icon.png`. `public/favicon.svg` is the same picture as SVG. Interface icons are line icons in
`src/ui/components/Icons.tsx` (24 × 24, `currentColor`).
