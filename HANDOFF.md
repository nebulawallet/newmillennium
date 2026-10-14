# Handoff: New Millennium

Read this first when you pick up the project in a new session, with a new agent, or after a break. Last updated 14 October 2026, after commit `193ea02`.

## What this is

New Millennium is a grand strategy game in the style of Hearts of Iron IV, set from 1 January 2000 onward with no fixed end date. Politics is the heart of the game: every country has real leaders, parties, opposition figures and institutions, and the player or the AI decides who holds power.

- **Stack:** TypeScript, Three.js (map), Vite, Preact with signals (UI).
- **Content:** all content is JSON under `data/`.

| Document | What it holds |
|---|---|
| [PLAN.md](PLAN.md) | The approved architecture and the 13-phase plan. |
| [CONTENT_GUIDE.md](CONTENT_GUIDE.md) | How to add people, parties and countries by editing data. |
| [PRODUCT.md](PRODUCT.md) | Product truth: users, constraints, principles. |
| [DESIGN.md](DESIGN.md) | The UI design system (HOI4 layout, original steel-and-bronze art). |
| [CLAUDE.md](CLAUDE.md) | Standing rules for any agent working in this repo. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Code map. |
| [docs/PHASE2_BATCHES.md](docs/PHASE2_BATCHES.md) | The research queue for the politics database. |
| [docs/MAP_RENDERING.md](docs/MAP_RENDERING.md) | Renderer benchmark and the decision it led to. |
| [POLITICS_REVIEW.md](POLITICS_REVIEW.md) | Every data record marked `needs_review` (regenerated). |

## Status by phase

| # | Phase | Status |
|---|---|---|
| 1 | Politics schemas and `validate-data` | **Done** |
| 2 | World politics database | **In progress.** 8 of 212 countries done: DEU, USA, RUS, GBR, CHN, IRN, SOM (Pass A, core 2000 data); DEU also has full Pass B depth. Research was paused by the user; see below. |
| 3 | Map pipeline and rendering | **Done** apart from polish: 4,580 provinces on 2000 borders; mesh renderer chosen. Resources per province are stubbed until Phase 7. |
| 4 | Time loop, top bar, save/load, politics screen | **Done** |
| — | UI rebuild in the HOI4 layout | **Done** (`193ea02`), at the user's request |
| 5 | Elections, coalitions, interest groups, laws, unrest, coups, civil war | Not started. Next code phase. |
| 6–13 | Scripting and events, economy, research, production, combat, diplomacy, AI, content | Not started |

## Where things stand right now

- **Nothing is running.** The user asked to stop all background agents and the dev server.
- **Uncommitted, partial research output** from the stopped agents is in `data/countries/`:
  - `SWE`: complete and passes core validation, but not yet audited. Audit before committing.
  - `FRA`, `JPN`, `TUR`: incomplete; each fails validation on missing files.
  - Finish them by relaunching their batches (see [docs/PHASE2_BATCHES.md](docs/PHASE2_BATCHES.md)), or delete the folders to start clean.
- **Last verified on `193ea02`:** `npm run check` passes (typecheck, 41 tests, validation of the countries that have data).

## How to run

```bash
npm install
npm run dev              # http://localhost:5173 (?bench runs the renderer benchmark)
npm run check            # typecheck + tests + validate existing countries (core tier)
npm run validate-data    # full world check; fails until all 212 countries have data (expected)
npm run validate-data -- --only DEU --tier full --report
npm run review-report    # regenerates POLITICS_REVIEW.md
npm run fetch-map        # downloads ~60 MB of map sources into .cache/raw (gitignored)
npm run build-map        # rebuilds public/map from .cache/raw (about 15 s); set MAP_SKIP_PREPARE=1 to reuse simplified sources
npm run fetch-worldbank  # refreshes data/economy/worldbank_2000.json
npm run gen-schemas      # JSON Schemas for editor autocomplete
```

In game: Space pauses, 1–5 or +/- set speed, Q–P open the tab row (Q is Politics), Esc opens the menu.

## Next steps, in order

1. **Phase 2 research (when the user wants it resumed).**
   - Audit `SWE`, then finish `FRA`, `JPN` and `TUR`.
   - Launch the remaining batches from [docs/PHASE2_BATCHES.md](docs/PHASE2_BATCHES.md), at most about 6 agents at once (Wikimedia rate limits).
   - Every agent follows [scripts/research/AGENT_BRIEF.md](scripts/research/AGENT_BRIEF.md).
   - After each batch: validate it, spot-check facts yourself (especially anything after June 2026), run `npm run review-report`, commit.
   - The Commonwealth realms reference `gbr.monarch`, which now exists. Andorra references `fra.president`, so do France first.
2. **Phase 5 (can run in parallel with research):**
   - Elections: vote share from ideology support, party popularity, economy and so on; seat allocation per electoral system (D'Hondt, Sainte-Laguë, Hare, FPTP, two-round, MMP, US Electoral College); historical-mode weighting.
   - Coalitions and the negotiation UI, then interest-group approval, law changes, unrest, coups, civil war.
   - Add an election-night screen and the election-results map mode (it is already listed as "unavailable").
   - Acceptance: historical mode reproduces the real winners of US 2000 and Russia 2000.
3. **Phase 2, Pass B:** cabinets, military chiefs, opposition depth and factions. `--tier full` must pass.

## Decisions already made (don't relitigate)

- **Two-pass research.** Pass A is core 2000 data for every country; Pass B adds depth.
- **De facto states are their own countries at start:** Transnistria, Abkhazia, South Ossetia, Nagorno-Karabakh, Northern Cyprus, Somaliland and Iraqi Kurdistan.
- **Insurgent and rival-government tags exist for 2000:** AFN, TEL, UNI, RCD, MLC, FAR, ICH and SSD. Kosovo and the SADR are releasable.
- **Yugoslavia** starts as the Federal Republic of Yugoslavia (`YUG`), which includes Montenegro and Kosovo.
- **Renderer:** the mesh renderer (approach A) was chosen; approach B is kept behind `?renderer=texture`.
- **UI:** the HOI4 layout with original art only, desktop only. Every HOI4 tab is shown now; tabs for systems not yet built show which phase adds them.
- **Map data** comes from Natural Earth 10m, AWS terrain tiles and World Bank 2000 figures. GeoEPR was not downloaded (non-commercial licence); regional cultures are hand-curated in `data/map/regional_cultures.json`.
- **Real-world facts after June 2026** were verified directly on Wikidata and Wikipedia and recorded neutrally:
  - Khamenei died on 2026-02-28; Mojtaba Khamenei has been Supreme Leader since 2026-03-08.
  - Andy Burnham has been UK Prime Minister since 2026-07-20.
  - Zhu Rongji died on 2026-08-12.
  - Hastert died on 2026-10-03.

## Gotchas learned the hard way

- **Bash heredocs** with an apostrophe in the body fail in this harness. Write scripts with the Write tool and run them; Python heredocs without apostrophes work.
- **Python on Windows writes CRLF.** `.gitattributes` normalises to LF, so the git warnings are harmless. Run Python with `-I -X utf8` when printing non-ASCII.
- **The hidden browser pane has a 0×0 viewport and throttles requestAnimationFrame.** Before visual checks, set a size with `resize_window` and call `nm.view.renderOnce()`. Reset with preset `desktop` afterwards.
- **Vite HMR resets the page** whenever source files change. Data changes do not reload; they show a "content changed" banner.
- **The Wikimedia APIs rate-limit with HTTP 429.** The research tool retries; keep agent concurrency at about 6.
- **Wikidata errors are common** (wrong dates, missing acting holders, dates stored at year precision). Always cross-check against Wikipedia; the research tool prints real date precision.
- **Border quads must be `DoubleSide`.** Their winding depends on segment direction.
- **Three.js `computeBoundingSphere` on 2D geometry gives NaN.** Use `setWorldBounds()` in `src/render/layers/ProvinceColors.ts`.
