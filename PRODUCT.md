# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Players of modern-era grand strategy games, especially players of Hearts of Iron IV and its modern-day mods such as Millennium Dawn. They play long single-player sessions on a desktop computer with mouse and keyboard, and they spend hours reading dense panels: politics, research, production and diplomacy. The developer is also a primary user while the game is being built.

## Product Purpose

New Millennium is a grand strategy game set from 1 January 2000 onward, with no fixed end date. The player leads any country in the world. The political simulation is the heart of the game: real leaders, parties, opposition figures and institutions for every country, with elections, coalitions, interest groups and coups deciding who holds power. Success means a player can run a country for decades and feel that its politics behave like the real thing.

## Positioning

The game models every country's real political system, parties and people as of 2000, sourced and verifiable. The player or the AI decides who actually takes power, which goes beyond the scripted politics of Hearts of Iron IV and its mods.

## Operating Context

- Desktop browser on 1366×768 up to 4K, mouse and keyboard; HOI4-style keyboard shortcuts (Space pauses, 1–5 sets speed, letter keys open panels).
- The map fills the screen and every panel overlays it.
- Sessions are long, so information density and scanability matter more than first impressions.

## Capabilities and Constraints

- **Stack:** TypeScript, Three.js map, Vite, and Preact (with signals) for UI panels over the canvas.
- **Content is data:** all content lives in `data/` JSON and is validated by `npm run validate-data`.
- **Layout:** the UI must follow Hearts of Iron IV's layout and interaction model closely:
  - top bar: flag, resources and stats, date and speed widget
  - left vertical tab bar opening sliding side panels
  - outliner on the right
  - event popups
  - map-mode controls at the bottom right
  - tooltips everywhere
- **Art:** all art must be original. No Paradox-owned textures, icons, frames or fonts may ship.
- **Tabs for later systems:** every HOI4 tab appears now. Tabs for systems not yet built (Research, Diplomacy, Trade, Construction, Production, Recruitment, Logistics, Intelligence) open honest placeholder panels naming the build phase that adds them.
- **Screens:** desktop only; no phone layout is required.

## Brand Commitments

- Name: New Millennium.
- Binding reference: Hearts of Iron IV's interface structure and feel, rebuilt with original art.
- Content tone: neutral and factual about real people and parties. No satire, and no loaded political symbols used as decoration.

## Evidence on Hand

- Real politics data for verified countries in `data/countries/`.
- Map assets in `public/map/`.
- No flags or portraits exist yet. Flags are placeholders and portraits are silhouettes until the user supplies real images; do not fabricate them.

## Product Principles

1. The map is the stage; panels serve it and never permanently hide it.
2. Information density over whitespace: experienced players read numbers at a glance.
3. Every value shown is real simulation state; unbuilt systems say so honestly rather than faking numbers.
4. Familiar to HOI4 players: the same positions, verbs and shortcuts, so no relearning is needed.
