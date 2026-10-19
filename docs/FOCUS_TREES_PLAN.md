# Focus trees plan (from 19 October 2026)

The user's verdict: the national focus trees are far too small. Every national tree has 13–19 focuses, and the generic tree for minor countries (24) is bigger than any of them. HOI4 major trees run past 100 focuses, and Millennium Dawn's are larger still. The conflict countries, which are the point of the game (see [CONFLICTS_PLAN.md](CONFLICTS_PLAN.md)), have no tree of their own.

## Where things stand

| Tree | File | Focuses |
|---|---|---|
| Russia | `rus.json` | 13 |
| United States | `usa.json` | 16 |
| Spain, Iran, Israel, Poland, Turkey | `esp`, `irn`, `isr`, `pol`, `tur` | 17 each |
| China, France, Italy, Japan | `chn`, `fra`, `ita`, `jpn` | 18 each |
| Germany, United Kingdom | `deu`, `gbr` | 19 each |
| Generic (everyone else) | `generic.json` | 24 |
| Iraq, Afghanistan, Syria, Ukraine, Palestine, Islamic State, Taliban | none | use the generic tree |

Format: CONTENT_GUIDE §7, "National focus trees". Each focus has `{ id, name, description, x, y, days, prerequisites, mutually_exclusive, available?, bypass?, effects, ai_weight? }`. `validate-data` checks every trigger, effect and id. The UI (`src/ui/scripted/FocusTree.tsx`) already pans, zooms and draws elbows and exclusive pairs, so big trees need no UI work.

## Goal

Every conflict country and every major gets a real tree:
- **Size:** 60–80 focuses (conflict countries and the US, Russia and China may go to about 100).
- **Branches:** 3–5, each with a historical path and real alternatives.
- **Timing:** about 70 days per focus, so a full branch takes years and the choices matter.

## Order

1. **Russia** (pilot). It is written in the main session and shown to the user before anything is scaled up. It sets the style, depth and effect balance for the rest.
2. **Conflict countries:** United States, Iraq, Syria, Ukraine, Israel, Palestine, Afghanistan, then the Islamic State and the Taliban (their trees are only usable while they hold land).
3. **Other majors:** China, Iran, Turkey, Germany, France, United Kingdom, Japan, Italy, Spain, Poland.
4. **Generic tree:** extend it to about 40 focuses with a few conflict-aware branches (neighbour at war, insurgency at home).

## Design rules for every tree

- **Branches** (choose 3–5):
  - Domestic politics: party and government paths, reforms, emergency powers.
  - Economy: growth model, energy and resources, sanctions resilience.
  - Military: reform, doctrine, procurement, conscription.
  - Foreign policy: blocs, alliances, the great-power alignment of the era.
  - Conflict branch where the country has one (Russia: Chechnya, Georgia, Crimea and Donbas; Iraq: insurgency, ISIS, Mosul; Israel: Gaza and Lebanon; and so on).
- **History first:** each tree has a historical path that reproduces what the country actually did, in roughly the real order. Give it the highest `ai_weight` so AI countries on the historical path take it. Alternatives are mutually exclusive with it where the choice really was either/or.
- **Gated by reality:** use `available` triggers on dates (`date_after`), offices (`holds_office`), ruling party or ideology, wars (`at_war_with`), flags and completed focuses. A branch should not open before the world allows it (for example, the Crimea focuses only after February 2014 events, or behind a choice that leads there).
- **Effects** use the existing toolkit (full list in `src/sim/scripting/engine.ts`):
  - Politics and mood: political power, stability, war support, laws, party popularity, interest groups, timed modifiers.
  - Diplomacy: opinion, blocs.
  - Military and research: war goals, divisions and equipment, tech unlocks.
  - Conflict: armed groups, provinces, `country_event`.
- **Effects are gameplay, and they are balanced:** follow the sizes in the current trees (+50 PP, ±0.02–0.05 stability, timed modifiers of 1–4 years). No single focus may decide a war.
- **Facts:** CLAUDE.md applies.
  - A focus named after a real policy, programme or event cites a source in the tree's `source`, fetched with `scripts/research/wiki.ts`.
  - Never invent people, parties, dates or numbers. `set_leader` only with real people already in the data.
  - Neutral wording: no satire, no allegations, no loaded words in names or descriptions.
  - No scripted deaths of living people.
- **Layout:** branches side by side, about 8 columns per branch, rows by stage. Exclusive pairs sit on the same row.
- **Engine gaps:** if a branch needs an effect that does not exist, add it to the engine in the main session (pure TypeScript in `src/sim`, validated, tested). Do not fake it with text. Candidates: `add_building` (factories, infrastructure), `add_manpower`, `add_research_bonus`, `add_military_factory`.

## Process per tree

1. **Research:** find the real policies, programmes and turning points of 2000–2026 for the country (`scripts/research/wiki.ts extract` / `wikitext --grep`). List them with dates and sources.
2. **Draft:** sketch the branches and the historical path on paper (ids, names, prerequisites, exclusives) before writing JSON.
3. **Write:** add the focuses to `data/focus_trees/<tag>.json` (new trees list their `countries`).
4. **Validate:** run `npm run validate-data -- --only <TAG>`, then `npm run check`.
5. **Playtest:**
   - `npx tsx scripts/dev/conflict-trace.ts`: the historical timeline must not change.
   - `npx tsx scripts/dev/scenario-check.ts`: leaders still right.
   - `npx tsx scripts/dev/soak.ts 10`: no errors, speed similar.
   - Open the tree in the game: it must read well, with no overlaps.
6. **Commit and push:** one commit per tree (or per batch); `git push newmillennium HEAD:refs/heads/main` deploys the site.

## Agents

After the user approves the Russian pilot, the remaining trees can go to research agents:
- Run them on Sonnet at medium effort, at most 2–3 at once, and only with the user's go-ahead (CLAUDE.md "Scope and cost").
- Each agent gets one country, this plan, the pilot tree as the model, and the rule never to kill processes it did not start.
- Audit every result before committing: sources, neutrality, balance, validation and the trace.

## Done when

- Every country in "Order" has a tree of the target size, its historical path reproduces history under the trace, and the user has seen the pilot and at least one conflict tree.
- HANDOFF.md lists the trees, their sizes and any engine effects added.
