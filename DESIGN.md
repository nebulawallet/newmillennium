---
name: New Millennium
description: Grand strategy shell in the Hearts of Iron IV layout, set in the deep blue of the UN Security Council chamber.
colors:
  s0: "#061127"
  s1: "#0b1b38"
  s2: "#10244a"
  s3: "#16305e"
  s4: "#1d3c72"
  line: "#213f6d"
  line-2: "#2e5288"
  line-3: "#4069a6"
  accent: "#4e97ec"
  accent-deep: "#2d6fc4"
  accent-ink: "#9cc7ff"
  plate: "#eef3fa"
  plate-2: "#d5e0ef"
  plate-ink: "#0a1a36"
  plate-dim: "#3c5276"
  ink: "#e9eff8"
  ink-dim: "#a3b5d0"
  ink-faint: "#839ac1"
  ink-mute: "#4e6690"
  good: "#5dcb8e"
  bad: "#f2645c"
  bad-ink: "#ffb8b2"
  warn: "#f4b942"
  sea: "#173a5e"
typography:
  display:
    fontFamily: "Archivo Variable, Archivo, Segoe UI, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.05
  headline:
    fontFamily: "Archivo Variable, Archivo, Segoe UI, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.15
  title:
    fontFamily: "Archivo Variable, Archivo, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    letterSpacing: "0.08em"
    fontVariation: "'wdth' 118"
  label:
    fontFamily: "Archivo Variable, Archivo, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.12em"
    fontVariation: "'wdth' 118"
  numeral:
    fontFamily: "Archivo Variable, Archivo, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    fontFeature: "tnum"
    fontVariation: "'wdth' 92"
  body:
    fontFamily: "Archivo Variable, Archivo, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
  document:
    fontFamily: "Source Serif 4 Variable, Source Serif 4, Georgia, serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  none: "0px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  panel:
    backgroundColor: "{colors.s1}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
  panel-header:
    backgroundColor: "{colors.s2}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    height: "40px"
  tile:
    backgroundColor: "{colors.s1}"
    textColor: "{colors.ink-dim}"
    rounded: "{rounded.none}"
    size: "36px"
  tile-active:
    backgroundColor: "{colors.s3}"
    textColor: "{colors.plate}"
  button:
    backgroundColor: "{colors.s2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "28px"
  button-primary:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.plate-ink}"
    rounded: "{rounded.none}"
  button-selected:
    backgroundColor: "{colors.accent-deep}"
    textColor: "#ffffff"
  placard:
    backgroundColor: "{colors.s3}"
    textColor: "{colors.plate}"
    typography: "{typography.title}"
    height: "22px"
  placard-up:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.plate-ink}"
  tooltip:
    backgroundColor: "{colors.s2}"
    textColor: "{colors.ink}"
    padding: "8px 12px"
  input:
    backgroundColor: "{colors.s0}"
    textColor: "{colors.ink}"
    height: "28px"
    padding: "5px 8px"
---

# Design System: New Millennium

## Overview

**Creative North Star: "The Council Chamber"**

Every conflict of 2000 to 2026 passes through one room: the UN Security Council. The shell borrows that room's world and nothing of its branding. The map is the table. The HUD is the chamber's deep council blue. Every country that acts in the game sits behind a delegate's nameplate, its placard.

The topology is Hearts of Iron IV's, exactly, because the players already know it:
- **Top bar:** the flag inside a 48px bar at the far left (it opens the country menu), then the focus tile, the tab row, the readouts and the date.
- **Left:** slide-out panels. The focus tree and the research tree open as large views over the map.
- **Right:** the outliner.
- **Bottom centre:** army cards and the battle-plan tools.
- **Bottom right:** map modes.

The world supplies type, palette, density and one signature move, the placard, and never the layout. Hierarchy comes from size, weight and the font's width axis alone. There is no grain, bevel, gradient, glow or corner tick anywhere. The map is printed in an atlas tone (country colours slightly desaturated and settled toward navy) on a chart-blue sea, so the white placards and the resolution blue stay the brightest things on screen during long evening sessions.

**Key Characteristics:**
- Opaque council-navy panels on 1px blue hairlines; square corners everywhere.
- Resolution blue marks selection, progress, the active tab and focus. Placard white marks a country holding the floor, finished work and the primary action.
- Wide capitals for titles and placards; condensed tabular figures for numbers; a serif document voice for narrative text.
- Green, red and amber appear only on values that are good, bad or at risk.
- A rich tooltip on every number, tile and row.

## Colors

The strategy is committed: one deep navy family carries the whole HUD, one clear blue does the work of selection and progress, and a white plate is the signature.

### Primary
- **Resolution Blue** (accent): the active tab's 2px underline, progress fills, meters, the selected toggle (accent-deep ground, white text), focus rings, the available focus or technology's edge, stat icons. Its light step (accent-ink) is for links and blue text on navy.

### Secondary
- **Placard White** (plate, plate-2, with plate-ink text): a placard turned up (the player's country in its own menus and wars, the selected nation, the winning side), a selected unit counter, a completed focus, a researched technology (plate-2, one step softer), the primary button, the scenario nameplate on the start screen.

### Neutral
- **Council Navy** (s0 to s4): s1 is every panel's ground; s2 is raised (panel headers, cards, tooltips, hover); s3 is selected; s0 is wells, inputs, meter tracks and canvas views.
- **Hairline Blue** (line, line-2, line-3): line separates rows and frames panels; line-2 edges controls; line-3 is the hover edge.
- **Ink on Navy** (ink, ink-dim, ink-faint, ink-mute): values and names in ink; labels in ink-dim; keys and notes in ink-faint (at least 4.5:1 on s1 to s3); disabled in ink-mute only.
- **Chart Sea** (sea): the map's water and the page ground.

### Named Rules
**The Vote Board Rule.** Green (good), red (bad) and amber (warn) appear only on values that are actually improving, worsening or at risk, such as stat flashes, approval, and Security Council votes. Never as decoration.

**The Data Colour Rule.** Party, ideology and country colours come from the game data. Swatches, flags, war-score bars and unit symbols show them as they are. The map alone renders them through the uniform atlas tone, a presentation step that never changes the data.

**The One Accent Rule.** Blue means "selected or in progress" and white means "holding the floor or done". Do not use either for emphasis that carries neither meaning.

## Typography

**Display, label and data font:** Archivo (variable: weight 100 to 900, width 62% to 125%), self-hosted, with Segoe UI as the fallback.
**Document font:** Source Serif 4 (variable, optical size), self-hosted.

**Character:** Archivo's width axis gives one family three voices: wide capitals for titles and placards (118%), normal width for reading, condensed tabular figures for data (88 to 92%). The serif brings the voice of a council document to narrative text.

### Hierarchy
The scale has six steps (11, 12, 13, 15, 20, 28px) and nothing in between.
- **Display** (700, 28px, 1.05): the nation name on the start screen. The scenario nameplate uses 800 weight at 125% width with 0.14em tracking.
- **Headline** (700, 20px, 1.15): leader names, event titles, law picker titles, the large figures in panel summary strips.
- **Title** (700, 13px, 0.08em, uppercase, 118% width): panel headers and medium placards.
- **Label** (700, 11px, 0.12em, uppercase, 118% width): section heads inside panels (followed by a hairline rule), outliner and legend headers, table headers, small placards.
- **Numeral** (600, 15px, tabular, 92% width): top-bar values, the date (700), war score (20px), research year marks.
- **Body** (400, 13px, 1.4): table cells, lists, tooltips; 12px for secondary lines.
- **Document** (400, 15px, 1.6, Source Serif 4): event text (62ch), placeholder text for unbuilt tabs, the description that leads a tooltip (13px).

### Named Rules
**The Heading-First Rule.** A name or heading leads, and its role, office or date follows beneath it. No small label sits above a heading.

**The Fit Rule.** A long country name narrows on the width axis to fit its plate (from 118% down to 75%) instead of being cut.

## Layout

The map fills the viewport; the HUD sits on its edges and leaves the middle free.
- **Top bar:** 48px, full width. The flag (51×34) sits inside it at the left.
- **Left panels:** 500px wide, 58px from the top, 8px from the bottom.
- **Large views** (focus tree, research tree): from 58px, between the left edge (research: right of the slots panel) and the outliner.
- **Outliner:** 300px wide, on the right, up to 56% of the viewport height.
- **Army bar:** centred at the bottom, between the left panel and the map modes.
- **Map modes:** a 7-column grid of 36px tiles at the bottom right, with the legend above it.
- **Start screen:** a 340px nation list on the left; the scenario nameplate and the nation card are centred on the remaining width.

The spacing module is 4px (4, 8, 12, 16, 24); rows run 24 to 30px, separated by hairlines rather than boxes. Panel bodies have 16px side padding, and section heads have 24px above and 8px below.

The HUD scales as one piece with CSS zoom (1 at 1400px wide and below, 1.1, 1.2 from 1700px, 1.35 from 2200px, 1.6 from 2900px). Map overlays and tooltips stay at screen pixels. The top bar must fit from 1280px up.

## Elevation & Depth

Depth is three plies, each with exactly one ground:
- **Map:** the ground ply.
- **Panels:** opaque s1 with a hairline.
- **Floating:** tooltips, menus and events, on s2 or s1 over a scrim.

Panels and floating layers carry one soft, offset shadow; nothing glows. A full view (focus tree, research tree, war overview) drops a navy veil over the map behind it, so one thing leads.

### Shadow Vocabulary
- **Panel** (`box-shadow: 0 12px 32px rgba(2, 8, 22, 0.55), 0 2px 6px rgba(2, 8, 22, 0.4)`): every panel, dialog and tooltip.
- **Small** (`box-shadow: 0 4px 12px rgba(2, 8, 22, 0.5)`): the start screen's meta strip.
- **Veil** (`background: rgba(4, 10, 24, 0.5)`): behind full views. Scrims behind modal dialogs use 0.6.

### Named Rules
**The No-Ornament Rule.** No grain, bevels, gradients, glows, corner ticks or textures. A surface is flat navy or a flat plate; the only line is a 1px hairline.

## Shapes

Every corner is square (0px). Edges are 1px hairlines. The only thicker marks are the 2px resolution-blue underline under an active tab or tile, and the 2 to 6px strokes of map lines (fronts, plans, orders). Flags sit with a 1px dark hairline; portraits sit in a 1px line-2 frame.

## Components

### Placard (signature)
A country in an actor role sits behind a nameplate: its flag (21×14, 30×20 or 45×30) and short name in wide capitals.
- **Seated:** s3 plate, line-2 edge, plate-white letters. Used for countries in an actor role other than the player's.
- **Turned up:** the white plate with navy letters. Used for the player's country (country menu, wars, war overview) and for the selection.
- **Absent:** an outline only, with a greyed flag. Used for a country that is out of play.

Sizes are small (22px, 11px type), medium (30px, 13px) and large (44px, 20px). Placards appear in the outliner's war rows, the war overview, the peace conference, the diplomacy header and the country menu. The featured nations and the nation list on the start screen use the same plate language.

### Tiles (tab row, map modes)
- **Shape:** 36px square (34px wide in the tab row), 0px radius.
- **Rest:** transparent, with the icon in ink-dim. **Hover:** s2 ground, line-2 edge, icon in ink.
- **Active:** s3 ground, icon in plate white, 2px resolution-blue underline.
- **Unavailable:** the icon in ink-mute. The tooltip names the phase that adds it.
- **Mini (24px):** s2 with a line-2 edge, for steppers and row actions; icons only, never text glyphs.

### Buttons
- **Standard:** 28px, Archivo 600 12px at 112% width, uppercase, s2 ground, line-2 edge. Hover: s3, line-3. Disabled: transparent, ink-mute.
- **Primary:** the white plate with navy letters (Resume, Play, Sign the peace, Return to plan).
- **Selected:** accent-deep ground, white letters, accent edge, for a chosen option or active tool (Hold/Execute, drawing tools, peace terms).
- **Danger:** bad-ink letters on a dark red edge (Disband, Declare war without justification).

### Panel header
A 40px s2 band: the resolution-blue icon, the wide uppercase title, and a square close button.

### Stat readout
The resolution-blue icon and a condensed tabular numeral, split from its neighbours by hairlines. When the value moves, the cell flashes green or red for 650ms. Hovering opens the breakdown tooltip.

### Tooltip
s2 with a line-2 edge and the panel shadow. A wide uppercase title in plate white over a hairline; a leading description in the serif document voice; key and value rows (key in ink-dim, value in tabular ink); a note in ink-faint under a hairline.

### Canvas views (focus tree, research tree)
- An s0 field. Drag to pan; the wheel zooms toward the cursor.
- Connector elbows are line-2 when not yet met and resolution blue when met, dashed when any one of several is enough. Mutually exclusive items are joined by a red dotted line with a boxed double arrow.
- **Focus node:** a 52px square over a name plate and a progress bar. Locked: muted. Available: resolution-blue edge. In progress: accent-deep fill. Completed: the white plate.
- **Research card:** 184×58. Available: a resolution-blue edge. Researching: accent-deep fill with a white bar. Researched: the softer plate (plate-2). One row per year, with the current year tinted. Category tabs show icon and count; the open category widens to carry its name.

### Unit counters and map lines
- **Counter:** about 30×19, navy body. It holds the APP-6 symbol in the country colour (our own SVG), the division count, and 2px strength (green) and organisation (blue) bars. A selected counter is a white plate; the player's counters have a line-3 edge; counters in the selected army have a blue edge; counters in combat have a red outline.
- **Lines:** the selected army's stretch is drawn white. Peacetime fronts are dashed accent-ink. Offensive lines and spearheads are red, brighter when selected. Move orders are dashed green; attack orders are solid red. A line being drawn is dashed white.

### Council vote board
One 8px lamp per Security Council member on each resolution: green in favour, red against, red ringed in white for a veto, each with a tooltip.

### Event window
A centred 640px panel over a scrim. It holds the title, the date line, and the event text in the 15px serif document voice. Options are full-width standard buttons with sentence-case labels.

## Do's and Don'ts

### Do:
- **Do** put every new system in its HOI4 position: its tab in the top row, its panel on the left, lists in the outliner, map overlays in the map-mode cluster.
- **Do** give every number a tooltip that explains where it comes from.
- **Do** show unbuilt systems honestly, with the phase that adds them.
- **Do** use the authored icon set (24px grid, 1.6 stroke) for any new icon, including steppers and arrows.
- **Do** set a country in an actor role on a placard; turn it up only for the player's country, the selection or the winner.
- **Do** keep the top bar fitting from 1280px wide; nothing hangs below it.
- **Do** make child components that read live game state subscribe to the clock (`version.value`).

### Don't:
- **Don't** round corners, or add grain, bevels, gradients, glows, glass, or gradient text.
- **Don't** place small labels or eyebrows above headings, or coloured side stripes on cards and list items.
- **Don't** use Unicode glyphs (▲ ▼ × + −) as icons.
- **Don't** use Paradox-owned art, icons, fonts or textures, or the UN's emblem and name as decoration.
- **Don't** decorate with loaded political or military symbols.
