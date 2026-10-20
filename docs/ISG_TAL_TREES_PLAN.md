# Plan: bigger trees for the Islamic State and the Taliban

The user's request (20 October 2026): "taliban and isis need bigger trees". Today both have 8-focus stubs (`data/focus_trees/isg.json`, `tal.json`), written by `scripts/dev/focus-trees/gen_syr_afg.py`. This plan is the brief for the session that builds them.

## Goal

| Tree | Tag | Today | Target |
|---|---|---|---|
| Islamic State | `ISG` | 8 | 70–90 focuses, including a surviving-state branch past 2019 |
| Taliban | `TAL` (insurgency 2002–2021); `AFG` once the Taliban govern | 8 | 70–90 focuses, including a governing branch past 2021 for a `TAL` that never merged |

Same style as the Russia model tree (`gen_rus.py`): focuses build things, add and remove national spirits, unlock decisions, raise divisions, give equipment and grant research. They don't only nudge modifiers.

## Content rules (CLAUDE.md, plus extra care for these two)

- **Neutral and descriptive.** Describe organisation, territory, forces, revenue and negotiations as a historian would. No glorification, no recruitment or propaganda language, and no atrocities or violence against civilians as gameplay. Nothing that reads as a how-to.
- **Real facts only, cited.** Every named event, place or date comes from an article fetched with `scripts/research/wiki.ts`. Year-only dates stay years. Unconfirmed items get generic names and no date.
- **No real people in focus names or effects.** Leaders stay in the person data; focuses don't name them.
- **Paths are internal choices** (FOCUS_TREES_PLAN.md, Order step 4). Neither has parties in the data (`parties.json` is empty), so there are no `install_government` paths. Branches are strategic choices instead, made mutually exclusive where it makes sense: for example a negotiated path against a military path for the Taliban, or territorial consolidation against expansion for the Islamic State.
- **History must not change.** Both groups' rise and fall is scripted in `data/events/conflicts.json` (18 events mention them). AI focus picks must not move those milestones: no `declare_war` or `occupy_provinces` on the historical path. Combat effects stay modest (timed, 1–4 years, about ±0.02–0.05).

## How they exist in the game

- `data/conflicts/armed_groups.json`: `ISG` (kind `militant_group`) and `TAL` (kind `insurgency`). They're on the map only while an event has spawned them and they hold provinces.
- `data/countries/ISG|TAL/country.json`: government type `insurgent_movement`; executive office `isg.leader` / `tal.leader`. Each has its own laws and interest groups.
- The Islamic State holds land in the trace from June 2014 to 2019. The Taliban insurgency holds land from 2002 until it merges into `AFG` in August 2021, after which the Taliban govern through the `AFG` tag.
- Focuses must work while the group holds land. Gate early focuses with `{"exists": "ISG"}` / `{"exists": "TAL"}` where needed.
- Starting spirits (`data/spirits/isg.json`, `tal.json`) can't use `start` the normal way, because the group isn't active on 1 January 2000. Either add the spirits through the spawn events in `conflicts.json`, or give them to the first focus. Adding them in the spawn events is better, but it's a data change to `conflicts.json`, so run `conflict-trace` afterwards.

## Sourced facts already gathered (Sonnet research, 19 October 2026)

**Islamic State**
- "Islamic State": a Salafi jihadist militant organisation and unrecognised quasi-state. It proclaimed a worldwide caliphate in 2014 (the exact day isn't confirmed in the lead) and lost its Middle Eastern territory by 2019. The lead gives about 12 million people under its control and a budget over US$1 billion by the end of 2015.
- "Fall of Mosul": 4–10 June 2014.
- "Battle of Mosul (2016–2017)": began 16 October 2016; end date not confirmed.
- "Raqqa campaign (2016–2017)": the SDF launched it in November 2016; Raqqa was captured in October 2017.
- "Battle of Baghuz Fawqani": began 9 February 2019; end date not confirmed.
- Not confirmed: governance details (taxation, currency), the exact day of the caliphate declaration.

**Taliban**
- "Taliban": a Sunni Islamist political and militant organisation that emerged in 1994, governed 1996–2001 and has governed since 2021.
- "Islamic Emirate of Afghanistan": 1996 to 7 December 2001; reinstated in 2021.
- "Doha Agreement (2020)": US–Taliban agreement signed 29 February 2020 in Doha; the Afghan government was not a party.
- "Fall of Kabul (2021)": 15 August 2021.
- "2001 United States invasion of Afghanistan": October 2001.

**Still to research** (one Sonnet agent, low effort, about 25 calls, per CLAUDE.md "Scope and cost"; ask the user first unless they've said not to):
- Islamic State: its provinces ("wilayat") outside Iraq and Syria; oil fields it held; the coalition campaign (Operation Inherent Resolve, already cited in the US tree); its 2019 shift to insurgency.
- Taliban: the Quetta Shura; the 2015 leadership transition (state only that one happened, no allegations); the Doha political office (2013); the 2021 offensive; Islamic Emirate governance after 2021 (ministries, the economy, the poppy ban of 2022, recognition by states such as Russia in 2025, if a fetched source confirms it).

## Proposed branches

### Islamic State (about 70 focuses)

1. **Administration** (about 12): councils for the towns, courts, services (water, power, bread), tax collection, records. Spirits: `isg_proto_state` (stability, political power) and `isg_administration_strain` (a problem: services fail as territory grows).
2. **Revenue** (about 10): oil fields and makeshift refineries (`add_buildings refinery` in held provinces), agriculture in the Euphrates valley, seized banks (a treasury lump), a currency (only if sourced). Spirit: `isg_war_revenue` (treasury up, foreign influence resistance down).
3. **Forces** (about 14): captured arsenals (equipment), mobile columns (motorised divisions), defence of the cities (army defence), foreign fighters (manpower; a neutral line only), training camps, drones (a research bonus for `air_drones`).
4. **Strategy choice** (exclusive; about 10 each side):
   - *Consolidation*: hold Mosul and Raqqa, fortify, administer (defence and stability).
   - *Expansion*: push toward Baghdad and Damascus (attack and war support; claims through `claim_rival_border`; on alternative paths only, gated `ALT`).
5. **Provinces abroad** (about 8): affiliates as diplomacy-like focuses that raise foreign influence. No map changes and no new tags.
6. **After the caliphate** (about 8, from 2017–2019): disperse to the desert, go underground, cells, recover. Spirit: `isg_insurgency_mode` (organisation down, internal security up). This branch keeps the tree useful after the land is lost.

### Taliban (about 70 focuses)

1. **Insurgency organisation, 2002–2021** (about 14): regroup, shadow governors and courts (tax efficiency, stability), the leadership council, rural networks, recruitment (divisions), funding (treasury; neutral), the spring offensives (timed attack).
2. **Military** (about 12): weapons, IEDs only as a neutral "explosives" equipment line, special units, captured equipment after 2021, the border regions.
3. **Diplomacy and negotiations** (about 10): the Doha office (2013, if sourced), talks with the US, the Doha Agreement (29 February 2020), regional ties (Pakistan, Qatar, Iran, Russia, China; opinion effects).
4. **Strategy choice** (exclusive): a *negotiated path* (talks, prisoner exchanges, stability) against a *military path* (offensives, war support); the historical path gets the higher `ai_weight`.
5. **The second Emirate, from 15 August 2021** (about 16; these focuses should live in the `AFG` tree, gated on the date or on `ruling_party` `afg.taliban`): ministries, revenue without aid, the poppy ban (swap `afg_opium_economy`), mines (copper, lithium), trade corridors, recognition, an army from captured equipment. Coordinate with the existing Afghanistan tree (`gen_syr_afg.py`, AFG section), which already has a small Emirate branch.

## Beyond the historical end (user request, 20 October 2026)

If the player wins the war and the group survives, the tree must keep going: the Islamic State past 2019, and the Taliban (as `TAL`) past 2021 if it never merged into `AFG`, or if the player plays it and holds land. No focus may have a historical end date that cuts the tree off.

- **Gate on the situation, not the date.** Use `{"exists": "ISG"}`, `at_war`, `has_completed_focus` and stability or support triggers. Don't use `date_before`. Dated focuses only mark real events (for example the Doha Agreement) and never close a branch.
- **A counterfactual state-building branch for each, about 15–20 focuses, written as neutral alternative history:**
  - *Islamic State, a surviving proto-state:* a permanent administration, a budget and currency, rebuilding the cities it holds (`add_buildings` infrastructure and factories), trade routes, oil revenue, a standing army (divisions, equipment, research), border defences, attempts at recognition or talks with neighbours (opinion effects only), and internal consolidation (stability, unrest down). Gated on still holding territory after 2017–2019, for example `exists ISG` plus `has_completed_focus` of the consolidation path.
  - *Taliban, the movement wins without merging:* govern the provinces it holds as a state (ministries, courts, taxes, services), rebuild and develop (roads, irrigation, mines), a standing army, diplomacy with the region, and an end to the war (`white_peace` only on an alternative path).
- **Spirits that change with the outcome**, for example `isg_besieged` turning into `isg_entrenched_state`, and `tal_insurgent_movement` turning into `tal_governing_movement`.
- **The AI on the historical path never takes these branches.** Gate them with `ALT` (player, or off history) or with conditions that history never reaches, so the scripted end of both groups stays unchanged in `conflict-trace`.
- **Wording stays neutral:** describe what the administration does, as a historian would describe any de facto state. No praise, and no violence against civilians as gameplay.

## Engine notes

- No new engine work should be needed. All tools exist: spirits, `add_buildings`, `add_claim`, `claim_rival_border`, `add_research_bonus`, decisions, `add_divisions`, `add_equipment`.
- Possibly needed: a trigger for "holds at least N provinces", to gate the expansion branch. If added, put it in `src/content/script/registry.ts` and `src/sim/scripting/engine.ts`, with a test.
- Decisions: `data/decisions/isg.json` and `tal.json` (for example "Recruitment drive", "Fortify a city", "Open a new front" on alternative paths only), using `write_decisions` in `treelib.py`.

## Process

1. Research the "still to research" list with one cheap Sonnet agent (CLAUDE.md "Scope and cost": ask the user first unless they've said not to).
2. Extend `scripts/dev/focus-trees/gen_syr_afg.py` (sections `G = Tree("isg", "ISG")` and `L = Tree("tal", "TAL")`), or split them into `gen_isg_tal.py`. Use the `treelib.py` helpers.
3. Run the generator from the repo root, then `npm run validate-data -- --only ISG,TAL,AFG`.
4. Add tests to `tests/scripting.test.ts`: the spirits apply, a strategy choice excludes the other, and decisions unlock.
5. Checks:
   - `npm run check`, checking `$?` (don't pipe it through grep);
   - `npx tsx scripts/dev/conflict-trace.ts`: the Islamic State still holds land 2014–2019, the Taliban until 2021, and the 2014 to 2017 milestones are unchanged;
   - `scenario-check`, `soak.ts 10`;
   - the paths check from the session scratchpad (no AI country takes a focus that leaves history). It isn't in the repo: rewrite it as `scripts/dev/paths-taken.ts`, which loads the world, runs historical mode to 2026 and lists any completed focus with `leave_history`.
6. Commit, then `git push newmillennium HEAD:refs/heads/main`, and update HANDOFF.md.
