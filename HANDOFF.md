# Handoff: New Millennium

Read this first when you pick up the project in a new session, with a new agent, or after a break. Last updated 14 October 2026, after the Phase 5 commit.

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
| 2 | World politics database | **In progress.** Done: DEU, USA, RUS, GBR, CHN, IRN, SOM, SWE (Pass A); DEU also has Pass B. Research agents are running batches 1–6; see [docs/PHASE2_BATCHES.md](docs/PHASE2_BATCHES.md). |
| 3 | Map pipeline and rendering | **Done** apart from polish: 4,580 provinces on 2000 borders; mesh renderer chosen. Resources per province are stubbed until Phase 7. |
| 4 | Time loop, top bar, save/load, politics screen | **Done** |
| — | UI rebuild in the HOI4 layout | **Done** (`193ea02`), at the user's request |
| 5 | Elections, coalitions, interest groups, laws, unrest, coups, civil war | **Done** (see "Phase 5 notes" below) |
| 6–13 | Scripting and events, economy, research, production, combat, diplomacy, AI, content | Not started. Phase 6 is next. |

## Where things stand right now

- **Research agents are running** (started 14 October 2026), at most six at once. Their folders in `data/countries/` are untracked until audited and committed. `npm run check` validates only countries tracked by git (`--tracked`), so half-written folders do not block commits.
- **Batches in flight:** 1 (FRA ITA AND MCO), 2 (NOR DNK FIN ISL), 3 (ESP NLD PRT), 4 (JPN KOR TWN PRK MNG), 5 (POL CZE HUN SVK), 6 (TUR ISR PSE). When one finishes: audit, commit, launch the next todo batch.
- **Audit checklist addition (Phase 5):** direct presidential elections decided by plurality need `"system": "plurality"` on their rule (e.g. KOR, TWN, ISL, PSE in the current batches); check `winner` is the real winner.
- **Map rebuilt** in Phase 5 with a population fix (see gotchas). Province ids changed, so saves made before this commit load with misaligned province ownership.

### Phase 5 notes

- **Elections** (`src/sim/politics/`): party shares come from ideology support (policy-distance affinity), a per-party calibration fixed at start so the model begins at the real 2000 vote shares, leader appeal, incumbency and fatigue, law modifiers (managed elections) and the economic mood, plus logit-normal noise. Seats per system: D'Hondt, Sainte-Laguë, Imperiali, Hare, Droop, FPTP, two-round, AV, block, STV/SNTV approximations, MMP with overhang, parallel, staggered chambers, indirect chambers, and the US Electoral College (`data/countries/USA/electoral_units.json`, real 2000 state results and apportionments 1990–2020).
- **Historical mode:** elections whose real candidates and parties exist follow the record with probability 0.97 (`data/rules/politics.json`); if the real winner would lose on the noisy shares, the smallest uniform swing that gives them the win is applied. A result that leaves the record sets `followsHistory = false` for that country. The timeline only continues an office from its real predecessor. Acceptance tests: US 2000, Russia 2000 and Germany 2002 reproduce in at least 90 of 100 seeds (`tests/elections.test.ts`).
- **Dynamic mode:** elected offices and governments are decided only by the simulation; appointed, hereditary and military offices still follow their real successions while the predecessor matches. Presidential nominees are chosen by party, preferring people who stood for the office in real elections within about four years.
- **Coalitions:** formateur = largest party (or the president's party in president-led systems; on the historical track, the real head of government's party). Partners scored by policy distance, size, cross-bloc gaps, grand-coalition and minority penalties, red lines; on the historical track the real cabinet's parties get a bonus where `cabinet.json` exists. The player picks from the options (partners may refuse). Confidence votes only in systems where the head of government is the effective executive.
- **Interest groups, laws, unrest:** approval drifts to a target (laws, ruling ideology, leader traits, economy) with a per-country offset so 2000 values are the equilibrium. Laws cost PP and pass a legislature vote. Unhappy groups protest, strike, march, rise up or try impeachment; armed groups can stage coups (military junta, elections end); civil war splits the map into one contiguous rebel region (`force_civil_war` command for scripting and tests).
- **UI:** election-night window, government-formation window, law picker, government support / unrest / economic mood rows, recent results, early elections, election-results and unrest map modes.
- **Stubbed in Phase 5:** party bans, dynamic party congresses in one-party states, combat in civil wars (ends by a monthly chance until Phase 10), running mates are picked by appeal, the economic mood is a placeholder cycle until Phase 7, aging and health exits.

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

1. **Phase 2 research:** keep about six batches running. After each: `npm run validate-data -- --only <tags> --tier core`, spot-check facts with `scripts/research/wiki.ts` (anything after June 2026 yourself), `npm run review-report`, commit, update the batch table, launch the next batch.
2. **Phase 6:** effect/trigger/scope registry (exists in `src/content/script/`), events, decisions, the generic focus tree, USA and RUS trees, first historical events. Fill the Decisions tab.
3. **Phases 7–13** in PLAN.md order.
4. **Phase 2, Pass B** once Pass A covers all 212 tags: `--tier full` must pass.

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
- **The committed map is not byte-reproducible** from the current `.cache` (a plain rebuild renumbers about a third of the provinces). Province populations now come from a final pass (places assigned to the nearest province of their country, small latitude-scaled area term); before that, Alaska had 19 million people and Manhattan's population was lost.
- **In-game synthetic key events** dispatched on `window` have no element target; the key handler guards for it.
- **`npm run check` uses `--tracked`:** stage a newly audited country folder before running it, or it will not be validated.
