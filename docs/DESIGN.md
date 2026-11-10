# Design

Light theme, mobile first (360–430 px), then tablet and desktop. The look is original; it does not
copy the interface, branding or characters of other learning apps.

The style in one line: soft green page, white surfaces with soft shadows instead of grey outlines, chunky
buttons with a thicker bottom edge, the rounded font Nunito, springy motion, and a garden: the idea that sets the
app apart. Every word is a plant that grows from a seed to a bloom.

Light and dark themes (Settings: as on device, light, dark). All colours are tokens with one value for each theme,
so a screen is written once. The dark theme turns the dark button light (mint face, dark text).

## The word garden

- **Stages:** seed (not studied), sprout (studied), leaf (2 right in a row), bloom (3 right in a row: learned). The
  stronger direction of a card decides. Drawn in `Plant.tsx`, shown next to every card, as a growth bar on decks
  and as a legend on the deck and Progress screens.
- **Home scene** (`GardenScene.tsx`): the sky follows the time of day (morning, afternoon, evening, night with
  moon and stars), clouds drift, and up to 9 plots show the user's real words in proportion. The sky is a separate
  layer so a wide screen crops only the hills.

- **Garden screen:** the big picture (15 plots, earned decorations, rain while watering, droop when wilted), the
  watering card, beds per deck (tap a plant for its word), the flower collection (unknown kinds as silhouettes),
  decorations, and the rules in plain words. On Home the whole picture is a link to it ("Open your garden").
- **Sprout (current, 2026-11-10): the owner's own picture.** The owner generated the character with Nano
  Banana; it is cut into seven WebP layers (feet, page, sprout, two arms, body) that stack in a 120 × 120 square,
  so the page rocks, the sprout sways, the arms swing and the feet tap, while the body breathes. The body is 4 %
  taller than in the picture (it looked squashed); the overall size is the one of the first Sprout (Stage 12).
  The face is part of the picture, so moods show through motion and small SVG extras (sparkles, thought dots, a
  drop, z's), not through a different face. To change the picture: replace `design/mascot/sprout.png` (white
  background) and run `scripts/mascot/cut.mjs`, then `split.mjs` (their first line shows how).
- **Sprout (after Stage 19, replaced the same day by the owner's picture):** a plump, perfectly round glossy green ball
  (soft cel shading: a lighter ball over a darker one, light from the top left; same overall size as the Stage 14 drawing), a tall white page tilted behind the head with a folded corner, three gray lines and rounded corners, a sprout with two mirrored leaves growing
  upright from the page's top, small round arms half behind the body, two little feet below. Default face: closed
  smiling eyes, pink cheeks, an open smile with a tongue. Every part moves on its own: the body breathes with a squash,
  the page rocks, each leaf rustles in its own rhythm, the arms swing, the feet tap in turn, the cheeks glow, the
  smile hums, the eyes squeeze shut or glance around. Moods (thinking, oops, encouraging, sleepy) keep their own eyes.
- **Sprout (Stage 14, replaced after Stage 19):** the Stage 12 drawing is back at the owner's request (the Stage 13 one was
  rejected), and the eyes no longer follow the pointer. Kept from Stage 13: leaves flap when happy, the sprout spins
  when celebrating, z's float when asleep, a wiggle on hover.
- **Sprout (Stage 13, rejected):** volume from gradients: light from the top left, shade at the bottom right, the page's
  soft shadow on the head, a shine and a rim light, glassy eyes with white around the pupils. Moves: breathing with
  a little squash, blinking, looking around by itself, pupils following the pointer on Home and Garden, leaves
  flapping when happy, the sprout spinning round when celebrating, z's floating up when asleep, a ticklish wiggle
  on hover.
- **Sprout (Stage 12, replaced):** a soft drop-shaped body with a radial gradient and a light from the top left, darker
  outline, resting arms, feet with a highlight, a page with a folded corner, leaves with veins, big eyes with two
  highlights, a light blush always on.

## Layout

- Phones: a floating tab bar with five tabs (Home, Decks, Garden, Progress, Settings); a tab's width follows its label. From 960 px a side panel with the
  logo, and wider content: on Home the garden and decks on the left, today's goal and the word of the day on the
  right; deck lists in two columns; study modes in one row; forms stay at a readable width.
- Study screens: no navigation; top bar with close, thick progress bar and Sprout.

## Palette

All values are in `src/styles/tokens.css`, with the dark values under `:root[data-theme='dark']`. Main light
values: page `#f5f8f1`, surfaces white, text `#14261a`, muted text `#51624f`, brand green `#58a83c` (fills only),
green text `#2f6b20`, dark button `#17291c`, correct `#1f7a3a`, wrong `#c62828`, "almost" `#8a5200`, sun `#ffc83d`.
Pastel chips (blue, orange, violet, yellow, teal) sit behind icons and deck letters.

## Rules

- Never rely on colour alone: feedback uses an icon and a text label as well. The active tab has a pill shape
  behind the icon, the chosen segment is a raised white pill, a matched tile is dashed.
- Contrast of text on its background is at least 4.5:1.
- Primary button: dark face with a thicker bottom edge (a 4 px solid darker shadow) that shrinks on press.
  On hover every button (dark or light) lifts by a pixel and its edge grows.
  Secondary buttons, choice cards, tiles, mode tiles and the question card share the same "edge" idea in light
  colours.
- Choice cards: large, rounded (20 px radius), whole card is the tap target, min height 64 px. A right answer
  "pops", a wrong one shakes; ✓ / ✗ sit in a coloured circle.
- Decks are cards: a coloured letter square (the same deck always gets the same colour), the growth bar, what is due.
- Deck screen: the four study modes are tiles in a 2 × 2 grid (icon, name, one-line description); Learn is the
  dark main tile. The link's accessible name is just the mode; the description is its accessible description.
- After an answer in Learn a sheet rises from the bottom, tinted by the result, with the Continue button.
- Flashcards: a real card that turns in 3D, with the cards to come stacked behind it. Once turned it can be swiped
  (right: know, left: learning) with a stamp that fades in; the buttons do the same. A vertical move scrolls.
- Results: the percentage inside a ring that fills up; confetti for a great result (from 90 %, or a Match game
  with no mistakes or a new best time).
- Buttons with only an icon always have an `aria-label`. Visible keyboard focus ring everywhere.
- Font: Nunito, stored inside the app (Latin, Latin Extended and Cyrillic, about 100 KB); no request to any font
  service. A rarer script falls back to the system font.

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
- **Moods:** `sleepy` (at night when nothing is due); `normal`; `happy` (closed smiling eyes, cheeks, a hop); `encouraging` (brows, a waving arm, a nod);
  `thinking` (eyes up, thought dots, a slow tilt); `oops` (worried brows, a small "o", a drop of sweat, a wobble);
  `celebrate` (both arms up, sparkles, a jump).
- **Reactions:** a new `reaction` number replays the mood's animation (the moving group is drawn anew).
- **Where:** the home greeting card (tap to pat: Sprout jumps and says one of its lines), study top bar
  (reacts to answers, see `core/cheer.ts`), result screens, empty states.
- A low score is met with encouragement, never with a sad face.

## Contrast

Checked by axe-core in real Chrome, not by hand: 13 screens plus the answer, flashcard back and result states, on a
phone in the light and dark themes and on a wide screen: no violations. White text on the brand green is only 3.0:1,
so the brand green is never used behind text.

## Icons

The app icon is the same idea as the mascot: a page with a sprout on top, white and dark green on the brand green.
`scripts/make-icons.ts` draws it (no image libraries) into `icon-192.png`, `icon-512.png` (rounded, transparent corners),
`icon-maskable-512.png` (full bleed; everything important is inside the central 80 % "safe zone") and
`apple-touch-icon.png`. `public/favicon.svg` is the same picture as SVG. Interface icons are line icons in
`src/ui/components/Icons.tsx` (24 × 24, `currentColor`).
