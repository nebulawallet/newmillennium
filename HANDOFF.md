# Handoff: New Millennium

Read this first when you pick up the project in a new session, with a new agent, or after a break. Last updated 17 October 2026, after the four reworks (UI, war, research, construction and market: commits `72b3f71`, `004fa25`, `043b56f`, `c81a5fc`).

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
| 2 | World politics database | **Narrowed (17 Oct 2026):** 70 countries full, 9 light (IRQ, AFG, AFN, SYR, LBN, IND, PAK, CAN, MEX), 133 on the default profile (`research` in `data/world/countries.json`; docs/CONFLICTS_PLAN.md). |
| 3 | Map pipeline and rendering | **Done** apart from polish: 4,580 provinces on 2000 borders; mesh renderer chosen. Resources per province are stubbed until Phase 7. |
| 4 | Time loop, top bar, save/load, politics screen | **Done** |
| — | UI rebuild in the HOI4 layout | **Done** (`193ea02`), at the user's request |
| 5 | Elections, coalitions, interest groups, laws, unrest, coups, civil war | **Done** (see "Phase 5 notes" below) |
| 6 | Scripting, events, decisions, focus trees | **Done** (see "Phase 6 notes") |
| 7 | Economy | **Done** (see "Phase 7 notes") |
| 8 | Research | **Done** (see "Phase 8 notes") |
| 9 | Production and units | **Done** (see "Phase 9 notes") |
| 10 | Combat, supply, war and peace | **Done** (see "Phase 10 notes") |
| 11 | Diplomacy | **Done** (see "Phase 11 notes") |
| 12 | AI | **Done** (see "Phase 12 notes") |
| — | Major conflicts 2000–2026 | **Done (17 Oct 2026):** armed groups and 57 dated conflict events (see "Conflicts notes") |
| — | Reworks: UI, war, research, construction and market | **Done (17 Oct 2026),** at the user's request (see "Reworks notes") |
| 13 | Content and polish | **In progress.** National focus trees for 13 major countries (USA, RUS, DEU, GBR, FRA, CHN, JPN, ITA, ESP, TUR, IRN, POL, ISR); every other country uses the shared generic tree. Historical wars and world events of 2001-2026 (`data/events/wars_and_world.json`); 424 dated world events in `data/events/history_*.json` (pipeline: `scripts/dev/gen-events-history.py` candidates -> `scripts/research/verify-events.ts` -> build). |

## Where things stand right now

- **Direction (17 October 2026):** the game is about the major conflicts of 2000–2026 (Israel–Palestine, Russia–Ukraine, Iraq, Afghanistan, Syria/ISIS, Lebanon). See [docs/CONFLICTS_PLAN.md](docs/CONFLICTS_PLAN.md) and CLAUDE.md "Scope and cost".
- **All of them are scripted** on sourced dates in `data/events/conflicts.json`, with non-state armed groups on the map (see "Conflicts notes" below). `npx tsx scripts/dev/conflict-trace.ts` prints the whole 2000–2026 timeline in about two minutes; run it after any change to wars, the AI or the conflict data.
- **Research tiers:** 70 full, 9 light, 133 default. No partial folders remain and nothing is untracked. **No research agents are running.** Ask the user before starting one (Sonnet, medium effort, at most 2–3).
- **Every check passes:** `npm run check` (141 tests) and the whole-world `npm run validate-data`. The start screen shows no data errors.
- **Speed:** about 3.5 ms per game day over a 10-year soak (median 2.6 ms, p99 21 ms, worst 37 ms) after the reworks; it was 2.4 ms before. The extra comes from the bigger tech tree, the goods market (monthly) and AI construction placement. Profile with `scripts/dev/profile-systems.ts`.
- **Saves:** the Lebanon map rebuild (`64ec430`) renumbered about 1,400 province ids, so saves from before it load misaligned. GameState is v11 (v10 armies, v11 construction money and the goods market; both migrate).
- **Dev server:** another worktree may hold port 5173; `.claude/launch.json` has `dev-alt` on 5181.
- **Audit helper:** `python -I -X utf8 scripts/dev/audit-country.py TAG` prints offices, legislature, latest elections, needs_review items and dates after June 2026.
- **Audit checklist for research results:**
  - Plurality presidencies need `"system": "plurality"`.
  - Check every death and every claim dated after June 2026 yourself with `scripts/research/wiki.ts`; remove a death that only Wikidata gives.
  - Scan for allegations, convictions, health claims and loaded words.
  - Agent prompts must forbid blanket process kills (`taskkill /IM node.exe`).

### Reworks notes (17 October 2026)

**Part 1, UI** (`72b3f71`):
- Slim 48px top bar with the national flag hanging below it.
- Flags: flag-icons 7.6.0 (MIT) in `public/flags`, mapped by `data/world/flags.json` (`scripts/dev/gen-flags.ts`, codes from Natural Earth). They show in the top bar, country select, diplomacy, news, wars and trade routes. Tags with no ISO flag keep the placeholder. The flags are today's flags: those that changed after 2000 (Afghanistan, Iraq, Libya...) are not dated (the file is `needs_review`).
- Panels: a faint data grid and bronze corner ticks.
- Focus tree and research screen: pan/zoom canvas views (`src/ui/panzoom.ts`).
- DESIGN.md has the new components.

**Part 2, war** (`004fa25`):
- `src/sim/military/fronts.ts`: armies with a front, an offensive line, spearheads, execute/stop, an empty commander slot and a plan status. Rules are in `data/units/war.json` `fronts`.
- The AI forms its own armies and plans through the same commands.
- UI: army cards in the bottom bar, drawing tools on the map (`MapView.capture`), frontlines traced on the real border segments, APP-6 unit counters.
- The conflict trace matches the earlier version, except that Russia now takes all three limited-war targets in 2022.

**Part 3, research** (`043b56f`):
- 330 technologies, with every category covering every year 2000–2030, and 13 mutually exclusive pairs.
- Researching ahead costs `1 + 0.3n + 0.08n²` (n years ahead); catching up is up to 50% cheaper.
- A pacing test checks that an average country keeps up with each year's technologies (`scripts/dev/research-balance.ts`).

**Part 4, construction and market** (`c81a5fc`):
- Every building stands in a province, with slots from infrastructure, population and terrain.
- Starting factories are derived from World Bank industry and placed by population, not stored.
- The queue can be reordered and cancelled, shows estimated finish dates, and takes at most 15 factories per project.
- Money is paid over time; spending above 2% of GDP adds to the deficit.
- Goods market and trade routes (`src/sim/economy/market.ts`); the Trade tab shows them.
- `scripts/dev/economy-check.ts` compares debt, growth and factories over 10 years.

**Still stubbed after the reworks:**
- **Commanders:** the army card's commander slot is always empty. Generated (fictional, after 2026 only) or sourced commanders are Phase 13 content.
- **Naval and air war:**
  - Air bases only raise air effectiveness, and ports only raise trade efficiency.
  - No naval combat, invasions or air missions (Phase 10/12 stubs).
  - Spearheads and offensive lines are land-only.
- **Fronts:**
  - Fronts form only where land borders meet: no fronts across the sea.
  - Armies split a front by order along its main axis, not by geography the player chooses: there is no front-line editing beyond choosing the enemy.
- **Market:** only three goods (consumer, industrial, fuel). Raw resources keep their separate price index. Imports are not limited by routes or sanctions; only exports are.
- **Flags:** not dated (see above); de facto states, insurgent governments and armed groups use the placeholder.
- **Research:** technology effects are modifiers only. Equipment variants still need `requires_tech` in `units/equipment.json` for any new equipment; only 18 technologies unlock equipment today.
- **Construction:** the AI picks building types by fixed weights, not by need (for example, it does not build refineries for its fuel deficit).

### Conflicts notes (17 October 2026)

- **Armed groups** (`data/conflicts/armed_groups.json`, `src/sim/conflicts/armedGroups.ts`): ISG (Islamic State), IQI (Iraqi insurgency), TAL, HAM, DPR, LPR, SYO (Syrian opposition), HEZ, SDF.
  - Groups own the land they hold, and each province remembers its original country (`state.armedGroups.home`).
  - Effects: `spawn_armed_group`, `armed_group_loses`, `end_armed_group` (defeat, or merge `into` a country for a takeover or annexation).
  - Group wars call in no allies and never end by exhaustion. In dynamic mode land follows control.
  - **Historical mode:** AI countries neither attack nor enter armed-group land, so these fronts move only on scripted dates (the player still can). Scripted wars between countries do not end by exhaustion either.
- **Other war effects:** `deploy_divisions` / `recall_divisions` (expeditionary forces; the host grants access), `occupy_provinces`, `dissolve_country`, `declare_war` with a `zone` (a limited war's target provinces), and `set_historical_government_type`. All are in CONTENT_GUIDE §12.
- **Timeline** (dates from Wikipedia):
  - **Afghanistan:** Taliban rule ends 9 Dec 2001 (insurgency on Uruzgan and Zabul); the United Front merges 22 Dec 2001; presidential from 7 Dec 2004; offensive 1 May 2021; takeover 15 Aug 2021.
  - **Iraq:** invasion from 20 Mar 2003, fought from Kuwait (8 US and 2 UK divisions, a 60-day "Iraqi forces collapsed" penalty). The fall of Baghdad on 9 Apr 2003 puts the rest under coalition control. 6 US divisions stay until 18 Dec 2011. The insurgency holds Ramadi/Fallujah from 4 Apr 2004 to 15 Nov 2006. Parliamentary from 15 Oct 2005.
  - **ISIS:** Raqqa 13 Jan 2014, Mosul 10 Jun 2014, Iraq's victory 9 Dec 2017, Baghuz 23 Mar 2019.
  - **Syria:** the opposition from 19 Jul 2012; Russia from 30 Sep 2015; the SDF from 10 Oct 2015 (Raqqa 17 Oct 2017; hands over Raqqa and Deir ez-Zor 18 Jan 2026; dissolved 25 Aug 2026); the fall of Assad 8 Dec 2024.
  - **Gaza:** Hamas from 15 Jun 2007; wars 2008–09, 2014 and 2021; the Gaza war from 7 Oct 2023 (ongoing per Wikipedia).
  - **Lebanon:** Hezbollah holds the new "South Lebanon" province from 12 Jul 2006 (war until 14 Aug 2006); war from 8 Oct 2023; withdraws under the 27 Nov 2024 ceasefire; the 2026 war from 2 Mar 2026 (ongoing).
  - **Donbas and Ukraine:** DPR 7 Apr 2014, war from 12 Apr, LPR 27 Apr. Russia's 2022 limited war targets Kherson, Zaporizhzhia and Mariupol. DPR and LPR are annexed on 30 Sep 2022. About 11% of Ukraine's remaining population is occupied, plus Crimea and the annexed DPR and LPR.
- **Province choices** on the coarse map (one province can cover a whole governorate) are flagged `needs_review` in each event.
- **Combat and AI changes** (they affect every war):
  - Combat width is 80.
  - Starting fighters come from World Bank military spending, and stock quality from spending per soldier.
  - Support units move at the line battalions' speed.
  - The AI attacks in strength, toward the enemy capital, and also from wherever its divisions stand.
  - Limited-war attackers stay in their zone.
  - Divisions sent home after a peace go to the capital.

### Phase 5 notes

- **Elections** (`src/sim/politics/`): party shares come from ideology support (policy-distance affinity), a per-party calibration fixed at start so the model begins at the real 2000 vote shares, leader appeal, incumbency and fatigue, law modifiers (managed elections) and the economic mood, plus logit-normal noise. Seats per system: D'Hondt, Sainte-Laguë, Imperiali, Hare, Droop, FPTP, two-round, AV, block, STV/SNTV approximations, MMP with overhang, parallel, staggered chambers, indirect chambers, and the US Electoral College (`data/countries/USA/electoral_units.json`, real 2000 state results and apportionments 1990–2020).
- **Historical mode:** elections whose real candidates and parties exist follow the record with probability 0.97 (`data/rules/politics.json`); if the real winner would lose on the noisy shares, the smallest uniform swing that gives them the win is applied. A result that leaves the record sets `followsHistory = false` for that country. The timeline only continues an office from its real predecessor. Acceptance tests: US 2000, Russia 2000 and Germany 2002 reproduce in at least 90 of 100 seeds (`tests/elections.test.ts`).
- **Dynamic mode:** elected offices and governments are decided only by the simulation; appointed, hereditary and military offices still follow their real successions while the predecessor matches. Presidential nominees are chosen by party, preferring people who stood for the office in real elections within about four years.
- **Coalitions:** formateur = largest party (or the president's party in president-led systems; on the historical track, the real head of government's party). Partners scored by policy distance, size, cross-bloc gaps, grand-coalition and minority penalties, red lines; on the historical track the real cabinet's parties get a bonus where `cabinet.json` exists. The player picks from the options (partners may refuse). Confidence votes only in systems where the head of government is the effective executive.
- **Interest groups, laws, unrest:** approval drifts to a target (laws, ruling ideology, leader traits, economy) with a per-country offset so 2000 values are the equilibrium. Laws cost PP and pass a legislature vote. Unhappy groups protest, strike, march, rise up or try impeachment; armed groups can stage coups (military junta, elections end); civil war splits the map into one contiguous rebel region (`force_civil_war` command for scripting and tests).
- **UI:** election-night window, government-formation window, law picker, government support / unrest / economic mood rows, recent results, early elections, election-results and unrest map modes.
- **Stubbed in Phase 5:** party bans, dynamic party congresses in one-party states, combat in civil wars (ends by a monthly chance until Phase 10), running mates are picked by appeal, the economic mood is a placeholder cycle until Phase 7, aging and health exits.

### Phase 6 notes

- **Script engine** (`src/sim/scripting/engine.ts`): evaluates every trigger and runs every effect in the registry, including scopes (`country`, neighbours, every/any country, root/from), `if` and `random_list`. Effects for systems not built yet (treasury, techs, war goals, opinion) are accepted, described as "arrives in Phase N" and do nothing. `describeEffects` / `describeTrigger` produce the tooltip text.
- **Systems** (`src/sim/scripting/systems.ts`): historical events fire on their dates (historical mode, while the country follows history unless `any_path`); random events by `mean_days`; queued `country_event`s. The player answers in an event window (the game pauses); AI picks by weight. Focus progress is daily; AI countries pick weighted available focuses. Decisions cost PP, can last `days`, and cool down; AI takes them monthly.
- **Content:** generic tree (24 focuses in four branches), USA tree (Bush and Gore administration branches by who is President, Republican/Democratic agendas by governing party), RUS tree (Putin-era reforms when Putin is President, CPRF programme when the CPRF governs), 8 generic decisions, 5 sourced historical events (Bush v. Gore, September 11, China joins the WTO, euro cash, 2004 EU enlargement).
- **UI:** focus tile beside the flag opens the focus tree; Decisions tab (P); event windows. The Decisions tab is no longer a stub.
- **Acceptance:** all scripts validate; the Gore and Bush branches diverge (`tests/scripting.test.ts`).
- **Not yet:** Ecuador January 2000 and Yugoslavia October 2000 events (need ECU and YUG data); trees for the other ~30 tier-1 countries (Phase 13).

### Phase 7 notes

- **Model** (`src/sim/economy/economy.ts`): every country starts from World Bank 2000 figures (`data/economy/worldbank_2000.json`; sparse fiscal series use the nearest year up to 2005; anything missing is a labelled estimate by income tier). Monthly: growth moves toward a target (potential growth from real 1995-2000 growth blended with an income catch-up path, fiscal stance, interest rates, stability, high debt, resource prices, modifiers changed since 2000, shocks); Okun's law for unemployment; inflation with an anchor that converges on a long-run target; Taylor-style interest rates; budget toward targets (AI governments follow a simple fiscal rule; the player sets targets); debt dynamics; factories from industry value added; daily construction; a world resource price index. The economic mood that drives elections and interest groups comes from these numbers.
- **Shocks:** the 2008 financial crisis and the 2020 pandemic are world events (`data/events/economic_shocks.json`, sourced) with two choices each; they fire in both modes. Acceptance: the 2008 crisis lowers the US governing party's share before the 2008 election (`tests/economy.test.ts`).
- **UI:** Economy panel (click the growth readout in the top bar), Construction tab (T; infrastructure needs a selected province), Trade tab (R), Resources map mode, infrastructure map mode shows built levels, outliner construction list.
- **Stubbed:** province-level resource deposits (national rents only), trade deals and sanctions (Phase 11), military factories produce nothing until Phase 9, sourced figures for tags without World Bank data (TWN, YUG, de facto states use estimates).

### Phase 8 notes

- **Data (superseded by the research rework, see "Reworks notes"):** `data/techs/<category>.json`, nine categories, 82 technologies from the 1980s to the 2030s (generic abstractions placed in the year they became broadly available; generated by `scripts/dev/gen-techs.py`, edit the JSON afterwards), and `data/techs/rules.json`.
- **Model** (`src/sim/research/research.ts`): 3–6 slots by GDP; speed from World Bank R&D spending and modifiers; researching ahead of a technology's year costs 25% more per year, older ones are cheaper to catch up on. Starting technologies: everything up to 2000 minus a lag by income tier, shortened by R&D (civilian) or military spending (military categories). Effects are permanent modifiers. `unlock_tech` and `has_tech` work in scripts. AI fills its slots.
- **UI:** Research tab (W): slots, categories, technologies by year.
- **Next:** Phase 9 equipment should reference technologies (`requires_tech`) rather than technologies listing equipment.

### Phase 9 notes

- **Data:** `data/units/equipment.json` (equipment families with variants unlocked by technologies; generic names), `sub_units.json` (battalions and support companies), `military.json` (manpower shares by conscription law, production efficiency, default templates, starting-army rules). Generated by `scripts/dev/gen-units.py`.
- **Model** (`src/sim/military/military.ts`): manpower = population × conscription-law share; production lines turn military factories into equipment with growing efficiency; templates (width limit 30); training draws manpower at the start and equipment at the end; divisions refit monthly from the stockpile; A* movement over land provinces the owner may enter (own territory, civil-war enemies, and wars from Phase 10); speed in km/h × 10 marching hours a day.
- **Starting armies:** World Bank armed forces personnel × 0.6 / 12,000 per division; the mix depends on income, tank technology and military spending; fully equipped with the best variants the country can build.
- **UI:** unit counters on the map (click to select, shift adds, right-click a province to move), Production tab (Y), Recruitment tab (U) with a template designer, armies list in the outliner.
- **GameState v6** adds `divisions`, `wars` (empty until Phase 10).

### Phase 10 notes

- **Data:** `data/units/war.json` (combat width, damage rates, terrain defence, entrenchment, armour and air bonuses, supply, capitulation, war support, white peace, world tension, sourced list of nuclear states in 2000).
- **Model** (`src/sim/military/war.ts`): a division ordered into a province held by enemy divisions attacks from where it stands; daily battles fit both sides into the combat width; attack is soft/hard by target hardness, halved when piercing is below armour, scaled by organisation and strength; defence adds terrain and entrenchment; air superiority from fighter and drone stockpiles gives a bonus. Beaten defenders retreat to a friendly neighbour or are destroyed. Moving into an enemy province without divisions occupies it. Supply: provinces feed `2 + 1.2 × infrastructure` divisions (half in enemy territory); extra divisions lose strength.
- **Peace:** a side capitulates when enemies hold 70% of its population; the AI annexes the occupied provinces on a conquest goal; the player gets a peace conference (annex or return). After 6 months, a side whose war support falls to 15% makes a white peace. Invaded countries rally to at least 50% war support; holding enemy territory raises war support each month.
- **UI:** "Declare war" in a foreign province's panel (tooltip shows tension and rules), battle highlight on unit counters, Wars section in the outliner (tension, occupation, war support), peace-conference dialog (pauses the game).
- **Stubbed:** nuclear weapons only raise world tension (no use), naval combat and invasions, air missions beyond the superiority bonus, alliances, war justification and AI declarations (Phase 11 and 12). The AI does not move its divisions yet (Phase 12), so AI defenders hold where they stand.
- **GameState v7** adds `worldTension`, `battles`, `pendingPeace`, `War.goal`, `Division.entrenchment`.

### Phase 11 notes

- **Data:** `data/diplomacy/blocs.json` (NATO, EU, CIS, Collective Security Treaty, ASEAN, Arab League, OAU/African Union, Mercosur, NAFTA, SCO with sourced 2000 members), `un.json` (permanent members, regional groups and seats, elected members 1999–2002, all sourced), `rules.json` (gameplay values). Generated by `scripts/dev/gen-diplomacy.py`. Enlargements and the British withdrawal are historical events in `data/events/blocs.json` (`join_bloc` / `leave_bloc` effects); historical events that name their countries now also reach countries without politics data.
- **Model** (`src/sim/diplomacy/diplomacy.ts`): opinion from ruling-ideology affinity, shared and rival blocs, war, guarantees, sanctions, trade deals, unjustified aggression, improved relations and scripted modifiers. Guarantors and defensive-bloc members (NATO, CST) join wars against a member or guaranteed country unless they are allied with the attacker. Military access lets divisions cross a host. Trade deals, economic blocs and sanctions change growth relative to 1 January 2000 (`EconomyState.tradeBase`), so the calibration is unchanged. Blocs admit applicants by the members' average opinion and the bloc's `join_trigger`, after an accession period.
- **UN Security Council:** five permanent members with a veto and ten elected members; the real intakes to 2001 come from data, later ones are drawn each 1 January within each regional group (weighted by economy). Resolutions (condemn, sanctions) need nine votes and no veto; members vote by opinion. The council answers unjustified wars with a sanctions resolution.
- **War justification:** 90 days (less with world tension) and 30 PP; a war without one costs stability, doubles the tension added and brands the attacker an aggressor (world opinion -30, fading over two years). War is now declared from the Diplomacy tab.
- **Foreign influence** (Intelligence tab): fund a party abroad (popularity each month, PP cost) or back a coup by an interest group (180 days, then a coup attempt); each risks exposure every month.
- **UI:** Diplomacy tab (E) with a country list, relations view, blocs and the Security Council; Intelligence tab (O); Logistics tab (I: equipment shortfalls, supply by province); Relations, Blocs and Supply map modes; the top-bar manpower stat; trade agreements and sanctions in the Trade tab.
- **Stubbed:** AI diplomacy beyond answering requests and council votes (AI guarantees, sanctions, applications and declarations come with Phase 12); real 2000 sanctions regimes are not modelled; the player's council vote follows opinion automatically.
- **GameState v8** adds `diplomacy`.

### Phase 12 notes

- **AI** (`src/sim/ai/ai.ts`): planners return `Command`s (the player's objects) from the state, and the AI system applies them.
  - Strategic: once a month per country on its bucket day. It improves relations with important or neighbouring countries, signs trade deals, applies to blocs (only off the historical path, since real enlargements are events) and sanctions aggressors, lifting sanctions once the target is at peace. Major powers guarantee friends someone is justifying against. Aggressive regimes off the historical path justify and declare war on much weaker hostile neighbours (never nuclear states). Regimes with high `foreign_influence` fund like-minded parties in hostile neighbours. It also keeps production lines on every military factory and trains divisions at war, when threatened, or now and then for militaristic regimes.
  - Weights come from the ruling sub-ideology's `ai_weights`: aggression, trade, integration, militarism, foreign_influence.
  - Military: every third day for each AI country at war. Priorities: retake its own provinces; hold threatened front provinces; screen the rest of the front with up to half the army; then attack empty or beatable enemy provinces with rested divisions. Worn-out attackers break off.
- **Civil wars are fought:** the army splits (divisions in rebel regions plus a share set by the rising group's influence); the war ends when a side holds none of its regions or the rebels hold 70% of the population (chance only when neither side has divisions).
- **Performance:** monthly economy and poll updates and AI planning run per country on its own day of the month (`src/sim/bucket.ts`). The pathfinder uses a binary heap. A 10-year historical soak averages about 1.0 ms per game day, p99 3 ms, against the 30 ms speed-5 budget. A live speed-5 run showed no main-thread task over 50 ms.
- **Worker:** `src/worker/simWorker.ts` runs the whole simulation in a Web Worker. `?soak=10[&dynamic][&seed=N]` runs 10 years there and reports tick times and errors, and `npx tsx scripts/dev/soak.ts 10 [--dynamic]` does the same in Node. Live play stays on the main thread: copying the state back every few days (690 KB now, several MB with all countries) would cost more than the sim itself.
- **Stubbed:** AI peace terms beyond capitulation and white peace; naval and air AI (no naval or air combat yet); AI does not answer the player's UN proposals by negotiation; historical wars of 2001–2026 (Afghanistan, Iraq, Georgia, Ukraine) are content for Phase 13, so historical mode has no AI-started wars.

## How to run

```bash
npm install
npm run dev              # http://localhost:5173 (?bench runs the renderer benchmark)
npm run check            # typecheck + tests + validate existing countries (core tier)
npm run validate-data    # whole-world check (passes: default-tier countries need no data)
npm run validate-data -- --only DEU --tier full --report
npm run review-report    # regenerates POLITICS_REVIEW.md
npm run fetch-map        # downloads ~60 MB of map sources into .cache/raw (gitignored)
npm run build-map        # rebuilds public/map from .cache/raw (about 15 s); MAP_SKIP_PREPARE=1 reuses simplified sources. Renumbers provinces: see gotchas
npm run fetch-worldbank  # refreshes data/economy/worldbank_2000.json
npm run gen-schemas      # JSON Schemas for editor autocomplete
npx tsx scripts/dev/conflict-trace.ts [YYYY-MM-DD] [--dynamic]          # every war and armed-group change from 2000 (~2 min)
npx tsx scripts/dev/group-trial.ts ISG IRQ "Ninawa,Sala ad-Din" 6 365   # one group against the AI on the real map
npx tsx scripts/dev/profile-systems.ts 1500 --map --from 2014-01-01     # time per system
npx tsx scripts/dev/soak.ts 10 [--dynamic]                              # 10-year speed and error soak
npx tsx scripts/dev/research-balance.ts [TAG ...]                       # research pacing 2000-2025
npx tsx scripts/dev/economy-check.ts [years] [TAG ...]                  # debt, growth, construction money, trade
npx tsx scripts/dev/gen-flags.ts <ne_10m_admin_0_countries.shp>         # rebuilds data/world/flags.json and public/flags
```

In game: Space pauses, 1–5 or +/- set speed, Q–P open the tab row (Q is Politics), Esc opens the menu.

## Next steps, in order

1. **Dated effective executive.** `effective_executive` is static content, so post-2005 Iraq still treats the President as the executive and coalitions form around the PUK. Add a state field, set by an effect on a real date, that `effectiveLeader`, the coalition code and the UI read.
2. **Yemen: light research?** YEM is the only conflict country still on the default profile (CONFLICTS_PLAN lists it as "maybe"). Ask the user before starting an agent.
3. **Balance:**
   - Brazil's and Argentina's debt rise to about 72% by 2010, partly because Brazil's starting interest rate (57%) is the World Bank lending rate, not the policy rate.
   - The 2003 invasion takes only four provinces before the scripted fall of Baghdad.
   - Default-profile countries are not playable.
4. **Map polish:** armed groups have no map labels. Isolated slow days (30–48 ms) remain on the US Electoral College day and the busiest invasion days.
5. **After the reworks:**
   - Dated flags for countries whose flag changed after 2000 (needs sourced dates and openly licensed SVGs).
   - Commanders: decide with the user whether to source real commanders (Phase 2 rules apply) or leave the slot empty.
   - AI construction by need (refineries for fuel deficits, factories where goods prices are high).
   - Fronts across the sea and naval invasions.
6. **Phase 13 polish:**
   - UI: a first pass is done (live province panel, group names in the news).
   - More events where useful: about 500 now; pipeline `scripts/dev/gen-events-history.py` → `scripts/research/verify-events.ts`.
   - Focus trees for conflict countries: IRQ, AFG, SYR, UKR and PSE use the generic tree.

For each research batch:

- Set the country's `research` to `light` (or `full`) in `data/world/countries.json` first; default-tier folders are ignored.
- Run `npm run validate-data -- --only <tags>`.
- Spot-check with `scripts/research/wiki.ts`, and check anything after June 2026 yourself.
- Run `npm run review-report`.
- Stage the folder, run `npm run check`, then commit.

## Decisions already made (don't relitigate)

- **Two-pass research.** Pass A is core 2000 data for every country; Pass B adds depth.
- **De facto states are their own countries at start:** Transnistria, Abkhazia, South Ossetia, Nagorno-Karabakh, Northern Cyprus, Somaliland and Iraqi Kurdistan.
- **Insurgent and rival-government tags exist for 2000:** AFN, TEL, UNI, RCD, MLC, FAR, ICH and SSD. Kosovo and the SADR are releasable.
- **Yugoslavia** starts as the Federal Republic of Yugoslavia (`YUG`), which includes Montenegro and Kosovo.
- **Renderer:** the mesh renderer (approach A) was chosen; approach B is kept behind `?renderer=texture`.
- **UI:** the HOI4 layout with original art only, desktop only. Every HOI4 tab is shown now; tabs for systems not yet built show which phase adds them.
- **Map data** comes from Natural Earth 10m, AWS terrain tiles and World Bank 2000 figures. GeoEPR was not downloaded (non-commercial licence); regional cultures are hand-curated in `data/map/regional_cultures.json`.
- **Research tiers** (user decisions, 17 Oct 2026): full for the 70 committed countries; light for IRQ, AFG, AFN, SYR, LBN, IND, PAK, CAN and MEX; the default profile for the rest. The BGD and EGY partial folders were dropped.
- **Historical mode holds armed-group fronts** until their scripted dates; dynamic mode fights them freely (user decision, 17 Oct 2026). Where the AI cannot be relied on to reach a real milestone (Baghdad, 9 April 2003), a sourced event moves the front.
- **Real-world facts after June 2026** were verified directly on Wikidata and Wikipedia and recorded neutrally:
  - Khamenei died on 2026-02-28; Mojtaba Khamenei has been Supreme Leader since 2026-03-08.
  - Andy Burnham has been UK Prime Minister since 2026-07-20.
  - Zhu Rongji died on 2026-08-12.
  - Hastert died on 2026-10-03.
  - Iraq: Nizar Amidi has been President since 2026-04-12 and Ali al-Zaidi Prime Minister since 2026-05-14. Hamid Majid Mousa is recorded as living (his death appears in Wikidata only).
  - Canada: Louise Arbour has been Governor General since 2026-06-08. Joan Russow died on 2026-07-30; Ajit Pawar (India) died on 2026-01-28.
  - Syria: the SDF dissolved on 2026-08-25; the People's Assembly first sat on 2026-07-12. Lebanon: the 2026 war began on 2026-03-02.

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
- **Commit only on a passing check:** gate commits on the exit code (`npm run check > log && git commit`), not on grepping the output. A Phase 8 commit slipped through with a timed-out test that way.
- **Cache** anything derived from `countryModifiers` monthly rather than computing it daily.
- **`npm run check` uses `--tracked`:** stage a newly audited country folder before running it, or it will not be validated.
- **Tests compile every folder on disk, tracked or not.** A research agent writing files while tests run changes random draws, and seed-dependent election tests can fail. Set the country's tier to `default` during the check, or wait for the agent.
- **Vitest ignores `.claude/**`:** other sessions' git worktrees live in `.claude/worktrees` and doubled the test files before the exclude.
- **`scripts/research/wiki.ts --grep` takes a JavaScript regex:** use `a|b`, not `a\|b`.
- **The game log keeps only 500 entries.** For long traces, collect entries with `sim.onLog` (see `scripts/dev/conflict-trace.ts`).
- **A map rebuild renumbers provinces** (about 1,400 ids in the Lebanon rebuild). Scripts select provinces by name or adm1 code, never by id. After a rebuild, check that every province name used in `data/events` still exists.
- **The harness blocks `rm` on a shell-variable path** (`rm "$D"/*`); use a literal path or `"${D:?}"`.
- **Preact skips re-rendering a child whose props are unchanged.** The game state is mutated in place, so any child component that reads live state must read `version.value` itself (army cards, focus tile, research slots and others were stale until fixed).
- **The browser pane's synthetic drags** send only the start and end points; the plan-drawing tool samples between pointer events, so real and synthetic drags both work.
- **The goods market calibrates through 2000:** demand scales and the trade-income baseline are set over the first year, while AI queues fill up. Prices stay at 1 until 2001.
- **Simulation speed:** profile on the real map with `npx tsx scripts/dev/profile-systems.ts 1500 --map --from 2014-01-01`. Do cheap checks before scanning `state.provinceOwner` (4,580 entries) per country per day.
