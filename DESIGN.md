---
name: New Millennium
description: Grand strategy shell in the Hearts of Iron IV layout, rebuilt with original steel-and-bronze art.
colors:
  steel-0: "#0b0f0e"
  steel-1: "#141a18"
  steel-2: "#1b2320"
  steel-3: "#232d29"
  steel-4: "#2e3a35"
  steel-5: "#3c4a44"
  bronze-dk: "#4a3b26"
  bronze: "#8a6d43"
  bronze-lt: "#c9a56a"
  bronze-hi: "#e8cf98"
  ink: "#ece4cf"
  ink-dim: "#b3ab95"
  ink-faint: "#7f7a69"
  ink-mute: "#5b5a50"
  good: "#8fcf6f"
  bad: "#e5604f"
  warn: "#e8b84d"
  ocean: "#1a3038"
typography:
  headline:
    fontFamily: "Barlow Semi Condensed, Barlow, Segoe UI, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.05
  title:
    fontFamily: "Barlow Semi Condensed, Barlow, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    letterSpacing: "0.1em"
  label:
    fontFamily: "Barlow Semi Condensed, Barlow, Segoe UI, sans-serif"
    fontSize: "11.5px"
    fontWeight: 700
    letterSpacing: "0.12em"
  numeral:
    fontFamily: "Barlow Semi Condensed, Barlow, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    fontFeature: "tnum"
  body:
    fontFamily: "Barlow, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  none: "0px"
spacing:
  xs: "3px"
  sm: "6px"
  md: "10px"
  lg: "14px"
components:
  tile:
    backgroundColor: "{colors.steel-4}"
    textColor: "{colors.ink-dim}"
    rounded: "{rounded.none}"
    size: "36px"
  tile-active:
    backgroundColor: "{colors.bronze-dk}"
    textColor: "{colors.bronze-hi}"
  button:
    backgroundColor: "{colors.steel-5}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 14px"
    height: "30px"
  button-primary:
    backgroundColor: "{colors.bronze-lt}"
    textColor: "{colors.steel-0}"
    rounded: "{rounded.none}"
  panel-header:
    backgroundColor: "{colors.bronze-dk}"
    textColor: "{colors.bronze-hi}"
    typography: "{typography.title}"
---

# Design System: New Millennium

## Overview

**Creative North Star: "The Steel Cabinet"**

The interface is a cabinet of dark, slightly olive steel slabs trimmed with thin bronze, laid over a full-screen map. It follows Hearts of Iron IV's topology exactly, because the players already know it:
- **Top bar:** the national flag hanging below a slim bar at the far left, then the focus tile, the tab row, stat readouts and the date plaque.
- **Left:** slide-out panels; the focus tree and the research screen open as large views over the map.
- **Right:** the outliner.
- **Bottom centre:** army cards with the battle-plan tools.
- **Bottom right:** map modes.

**The modern twist.** It reads as a 2000s–2020s command centre, not WW2 paper: sharper condensed type with tighter tracking, slim panel heads, a faint 12px data grid on every slab, bronze corner ticks, and NATO-style unit symbols.

All art is original. Density is high: numbers are read at a glance, so values are bright cream condensed numerals and every element explains itself through a rich tooltip.

Depth comes from inset bevels and grain on the steel, never from rounded cards or glass. The map is the stage. Panels sit on its edges and leave the middle free.

**Key Characteristics:**
- Square corners everywhere; no radius.
- Bronze hairline borders, with brighter bronze for active state.
- Condensed caps for headers and labels, condensed tabular numerals for values.
- Cream ink on steel; green, red and amber only where they carry meaning.
- Rich tooltips (title band plus rows) on every readout, tile and table row.
- Real national flags (flag-icons, MIT) wherever a country is named in a list or header.

## Colors

The palette is steel neutrals with one bronze accent family; state colours are reserved for meaning.

### Primary
- **Bronze trim** (bronze, bronze-lt, bronze-hi): hairline borders, panel header text, active tiles, primary button fill, selected rows. The brightest step marks only the active or focused element.

### Neutral
- **Steel slabs** (steel-0 to steel-5): panel bodies use a vertical gradient from steel-3 to steel-1 under the grain; tiles and buttons use steel-4 to steel-2; wells are translucent black over steel.
- **Cream ink** (ink, ink-dim, ink-faint, ink-mute): values and names in ink; labels in ink-dim; keys and metadata in ink-faint; unavailable systems in ink-mute.
- **Deep teal sea** (ocean): the map's water and the page ground behind it.

### Named Rules
**The Meaningful Colour Rule.** Green (good), red (bad) and amber (warn) appear only on values that are actually improving, worsening or in a warning state, such as stat flashes and interest group approval. Never use them as decoration.

**The Data Colour Rule.** Party, ideology and country colours come from the game data. The shell never recolours them; it frames them in black hairlines so they read on steel.

## Typography

**Display/Label Font:** Barlow Semi Condensed (self-hosted, with Barlow and Segoe UI as fallbacks)
**Body Font:** Barlow

**Character:** A sturdy, slightly technical condensed grotesque for headers and numbers, paired with its regular-width sibling for reading.

### Hierarchy
- **Headline** (700, 24px, 1.05): leader names, nation names on the start screen.
- **Title** (700, 15px, 0.1em, uppercase): panel headers in the bronze band.
- **Label** (700, 11.5px, 0.12em, uppercase): section bands inside panels, outliner headers, legend headers.
- **Numeral** (600, 16px, tabular): top-bar stat values, the date (700, 16px).
- **Body** (500, 13px, 1.4): table cells, descriptions, tooltips (12.5px).

### Named Rules
**The Heading-First Rule.** A name or heading leads, and its role or date follows beneath it. No small label sits above a heading.

## Layout

The map fills the viewport.
- **Top bar:** 48px, full width; the flag (108×72 in a bronze frame) hangs below it at the left.
- **Left panels:** 500px wide, from 90px (below the flag) to 8px above the bottom edge.
- **Large views** (focus tree, research): from 90px, between the left edge and the outliner.
- **Outliner:** 290px wide, on the right, up to 52% of the viewport height.
- **Army bar:** centred at the bottom, between the left panel and the map modes.
- **Map-mode cluster:** a 7-column grid of 36px tiles at the bottom right.
- **Start screen:** a 340px nation list on the left, a centred bookmark plaque at the top, and a nation card at the bottom centre.
- **Spacing rhythm:** 3, 6, 10 and 14px, on a desktop-only, high-density layout.

## Elevation & Depth

Depth is material, not ambient. Slabs carry an inset top highlight and a bottom shadow (`inset 0 1px 0 rgba(255,236,196,.07), inset 0 -1px 0 rgba(0,0,0,.55)`), a soft drop shadow (`0 6px 18px rgba(0,0,0,.55)`), an SVG grain layer and the faint data grid (`--grid`, 12px). Bronze corner ticks (9px) mark each slab's corners. Wells (stat readouts, the clock, chart frames) are recessed: translucent black with an inner shadow. Pressed tiles invert to an inner shadow.

### Named Rules
**The Bevel-Not-Card Rule.** Containers are bevelled steel slabs with hairline edges, never rounded cards with soft shadows, and never nested cards.

## Shapes

Every corner is square (0px). Edges are 1px: bronze-dk at rest and bronze on hover, with a black outline outside slabs. Flags and portraits sit in a bronze gradient frame with a 3px mat.

## Components

### Tiles (tab row, map modes)
- **Shape:** 40px square, 0px radius.
- **Rest:** steel gradient with a bronze-dk border and an inner highlight; the icon in ink-dim.
- **Hover:** icon and border brighten to bronze.
- **Active:** bronze-lt border, a warm dark fill and a soft bronze glow.
- **Unavailable:** the icon in ink-faint. For map modes the tile is also disabled, and the tooltip names the phase that adds it.
- **Hotkey:** shown as a 9px condensed character in the tile's corner.

### Buttons
- **Standard:** 30px tall, condensed uppercase, steel gradient, bronze border.
- **Primary:** bronze gradient fill with near-black text.
- **Pressed:** inner shadow.

### Panel header
A dark umber band with a bronze bottom rule, holding an uppercase bronze-hi title and a square close button.

### Stat readout (signature)
An icon plus a condensed numeral in a recessed well. When the value moves, the well flashes green or red for 650ms. Hovering opens a tooltip with the breakdown (base gain, factors, target).

### Tooltip
A steel slab with a bronze border, an uppercase title band, then key/value rows (key in ink-dim, value in bold tabular numerals), and an optional faint note.

### Canvas views (focus tree, research)
- Drag with the left button to pan; the wheel zooms toward the cursor; no scrollbars. The view opens centred on the current or next focus, or on the research frontier of the open category.
- Connector lines run from the bottom of a prerequisite to the top of what it unlocks, as elbows: bronze-dk when not yet met, bronze-lt when met, dashed when any one of several is enough.
- Mutually exclusive items are joined by a red dotted line with a boxed double arrow.
- **Focus node:** a 52px steel square with the icon, a name plate, a progress bar, and a corner badge (lock, red cross for excluded, check for completed).
- **Research card:** 184×58: the icon block, the name (two lines), year and cost in days, an amber "+Ny" marker when ahead of time, a production icon when it unlocks equipment or a building, and a bar while researching. One row per year with the current year highlighted; slots along the top; one tab per category.

### Unit counters
Small counters (about 30×19): the APP-6 symbol in the country colour (infantry X, armour oval, motorised X with wheels, mechanised X and oval, drawn as our own SVG), the division count, and two 2px bars (strength, organisation). One counter per country per province.

### Fronts and battle plans
- Frontline: red along every border with an enemy at war (traced on the real border segments); the selected army's stretch in bronze-hi.
- Offensive line: dashed red through its target provinces. Spearhead: a solid red arrow. The line or arrow being drawn: dashed bronze-hi.
- **Army card:** commander slot (dashed, empty: commanders are not modelled), name, symbols with counts, strength and organisation bars, plan status, and a play/stop button. The selected army gets a tool row above the bar.

### Construction
Building cards in a 4-column grid (icon, name, count, lock when unavailable). Picking one switches the map to Building slots (green by free slots, red where it cannot go) until Esc. Queue rows show the icon, name and province, a progress bar, factories assigned, the estimated finish date, and move and cancel buttons.

### Advisor slot
A 34×44 silhouette portrait plus the office and holder name, in a 2-column grid. It stands in for HOI4's advisor slots.

## Do's and Don'ts

### Do:
- **Do** put every new system in its HOI4 position: its tab in the top row, its panel on the left, lists in the outliner, map overlays in the map-mode cluster.
- **Do** give every number a tooltip that explains where it comes from.
- **Do** show unbuilt systems honestly, with the phase that adds them.
- **Do** use the authored icon set (24px grid, 1.6 stroke) for any new icon.
- **Do** make child components that read live game state subscribe to the clock (`version.value`).

### Don't:
- **Don't** round corners or use glass, gradients on text, or soft floating cards.
- **Don't** place small labels or eyebrows above headings, or coloured side stripes on list items.
- **Don't** use Paradox-owned art, icons, fonts or textures.
- **Don't** decorate with loaded political or military symbols.
