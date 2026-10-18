---
version: 1
slug: "src-ui"
primary_target: "src/ui"
related_targets: ["src/main.tsx"]
---

## Scope
In-game shell and start screen of New Millennium: top bar, left tab bar and slide-out panels, right outliner, map-mode cluster, tooltips, state (province) view, game menu, country selection, the full views (focus tree, research, war, peace), event windows, and the map overlays (unit counters, fronts, battle markers). Visitor mode: Operate. Desktop only, mouse and keyboard. Code-led.

## Audience and job
HOI4 and Millennium Dawn players running a country for long evening sessions. They read dense numbers at a glance and open the same panels hundreds of times. The user asked for a complete redesign in blue ("it looks trash and vibecoded", "i want a blue design").

## Direction contract
THESIS: The HOI4 shell set in the world of the UN Security Council, the room every conflict of 2000 to 2026 passes through: the map is the table, the HUD is the chamber's deep council blue, and every country that acts sits behind a delegate's placard. It refuses the bronze-and-leather WWII cabinet that strategy UIs default to, and the neon-cyan sci-fi command HUD that "blue game UI" usually means.

OWN-WORLD: Council navy panels (ground #0B1B38, raised #10244A, wells #061127) edged with 1px blue hairlines (#213F6D). Resolution blue (#4E97EC) marks selection, progress, the active tab and focus. Placard white (#EEF3FA) with navy ink marks a country holding the floor, completed work and the primary action. Vote-board green, red and amber appear only where a value is good, bad or at risk. Type is Archivo on its width axis (wide caps for placards and titles, semi-condensed tabular numerals for data) with Source Serif 4 for narrative text (events, descriptions). No grain, bevels, gradients, glows or corner ticks. Corners are square.

STORY: The player reads their country, leader, date and six national readouts at a glance, opens any system from the tab row or its hotkey, and always sees who is acting: their own placard turned up, everyone else seated.

FIRST VIEWPORT: The map fills the screen, its countries in an atlas tone on a chart-blue sea.
- **Top bar**, 48px, council navy: the flag inside the bar at the left (it opens the country menu), then the focus tile and ten tab tiles, then six readouts split by hairlines; at the right, the date with five speed pips, and the menu. Nothing hangs below the bar. (The user cut the nameplate and leader strip under the bar: "the leader should be in the country menu when u click the flag like in hoi4".)
- **Country menu** (Politics, opened by the flag): the player's nameplate turned up, then the leader.
- **Left panel**, 500px, below the bar.
- **Outliner**, 290px, at the right, with wars shown as pairs of placards.
- **Map modes** at the bottom right; **army cards** at the bottom centre.

Signature move: placards. A country in an actor role is set on a nameplate with its flag, in one of three states:
- **Seated:** navy plate, white wide caps.
- **Turned up:** white plate, navy caps, for the player, the selection or the winner.
- **Absent:** outlined only, for annexed or inactive countries.

The plate fits a long name by narrowing the width axis instead of truncating it.

Raises (from the declined challengers):
- From the variable-font specimen: no ornament; hierarchy comes from size, weight and width alone.
- From the Crouwel grid specimen: one 4px module with 24px rows, and panels share column edges.
- From the streaming title wall: one thing leads; a full view (focus tree, research, war, peace) veils the map behind it.
- From the Emigre bitmap specimen: one type scale with six steps (11, 12, 13, 15, 20, 28).
- From the acetate manual: three plies (map, panel, floating) and one state vocabulary (selected, disabled, pending, error) across every system.

Competitive alternate, not built: a boarding pass and gate board world (tabular rows, and a change that holds its alert colour until it is seen).

FORM: Candidate 4 of 7 on the grounded list (UN Security Council documents and chamber). Seed 2b682d0d; operate mode; code-led. The direction round was not shown, because the session resumed with no questions allowed, so the assigned direction was built unattended under the user's pinned blue palette.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
