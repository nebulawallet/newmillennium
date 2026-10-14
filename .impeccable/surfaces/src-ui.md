---
version: 1
slug: "src-ui"
primary_target: "src/ui"
related_targets: ["src/main.tsx"]
---

## Scope
In-game shell and start screen of New Millennium: top bar, left tab bar and slide-out panels, right outliner, map-mode cluster, tooltips, state (province) view, game menu, country selection. Visitor mode: Operate. Desktop only, mouse and keyboard. Code-led.

## Audience and job
HOI4 and Millennium Dawn players running a country for long sessions. They read dense numbers at a glance and open the same panels hundreds of times.

## Direction contract
THESIS: The HOI4 shell, rebuilt with original art. The map stays the stage, and every tool lives in the exact place a HOI4 player reaches for it. This refuses the generic dashboard (floating rounded cards, a sidebar list, a modal settings sheet) that the previous build used.

OWN-WORLD: Dark slate-olive steel panels, with a fine noise grain and inset bevels. Edges are 1px bronze hairlines (#9c7b4a family) with brighter top highlights. Panel headers are capitalised condensed type over a darker band. Buttons are square, embossed tiles holding authored line icons. Values are bright cream, green when good, red when bad, amber for warnings. Type: Barlow Semi Condensed for numbers and headers, Barlow for body text, self-hosted.

STORY: The player sees their country's flag, leader and vital statistics before anything else. They open Politics with one click or the F key, read the government and parliament, pause, resume and change speed without hunting. Systems that do not exist yet say which build phase adds them.

FIRST VIEWPORT: The map fills the screen.
- **Top bar**, 56px, full width: on the left, a 72×48 framed flag tile, then a row of 10 square tab tiles (Politics, Research, Diplomacy, Trade, Construction, Production, Recruitment, Logistics, Intelligence, Decisions). In the centre, stat readouts with icons (political power, stability, war support, manpower, factories, treasury). On the right, the date plaque with pause and five speed pips.
- **Left panel:** slides out below the bar, 520px wide.
- **Right outliner:** collapsible.
- **Map modes:** square tiles at the bottom right.

FORM: Pinned by the user ("make it exactly like hoi4"): the HOI4 interface layout with original art. No concept-seed roll, because the direction was pinned by the brief.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Signature move: the stat readouts animate their deltas, so values tick and a +/− flash shows weekly change. Every readout and tile has a rich tooltip with a title and breakdown lines, which is the HOI4 way of explaining numbers.
