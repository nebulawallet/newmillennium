# Focus trees plan (rewritten 19 October 2026)

The user's goals:
- **Bigger trees:** the national focus trees are far too small.
- **Political paths:** focuses must let a country change course politically. "I want countries to be able to go fascist and stuff", as in HOI4 and Millennium Dawn, where the political branch decides what the country becomes.

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

What the 14 trees do politically today, counted across all of them:

| Effect | Times used |
|---|---|
| Interest-group approval | 135 |
| `change_law` | 9 |
| `add_ruling_party_popularity` | 9 |
| Government type, parties (ban, legalise, found, boost), elections, leaders, coups, civil wars, blocs | 0 |

So no focus today can change where a country goes.

The ideology model has 8 groups: liberal democratic, social democratic / left, conservative, nationalist / populist right, socialist / communist, autocratic, religious, and non-aligned. It has 37 sub-ideologies, and **no fascist or far-right authoritarian ideology**: the furthest right is right-populist, national-conservative and ethno-nationalist. Real parties exist in most groups for most countries. Only 9 parties, in 6 countries, are "autocratic".

Format: CONTENT_GUIDE §7. Each focus has `{ id, name, description, x, y, days, prerequisites, mutually_exclusive, available?, bypass?, effects, ai_weight? }`. The UI already handles large trees.

## Part 1: Political paths (engine and content model first)

### 1a. Decisions for the user (settle these before building)

1. **A fascist ideology.** Add a group `fascist` (name "Fascist / ultranationalist authoritarian") with sub-ideologies such as `fascist`, `national_socialist`, `clerical_fascist` and `ultranationalist`, each with a map colour, policy axes and default laws.
   - Real parties go in it only where a fetched source describes them that way (for example, Golden Dawn in Greece). Otherwise they keep their current classification.
   - Recommendation: yes, add it.
2. **Who takes power on an alternative path.** CLAUDE.md forbids invented parties and people before 2026, so pick one of:
   - **(a) Real parties only.** The path brings to power a real party already in the data whose sourced ideology fits (the country's ethno-nationalist party, its communist party, and so on). A country without one has no such path.
   - **(b) Real parties, plus movements the path creates** where no real party fits. They would use a generic name built from the ideology and the country (for example, "Russian National Front"), carry `generated: true`, have no named leader (a "ruling council"), and be clearly marked as fiction. This needs a written exception in CLAUDE.md.
   - Recommendation: (b), with (a) preferred wherever a real party fits.
3. **Leaders of alternative regimes.** Use real people only: the real party's leader from the data, or an unnamed council. Never name an invented person before 2026 (the rule stays).

### 1b. Engine work (main session; pure TypeScript in `src/sim`, validated and tested)

- **`install_government`** `{ party?, ideology?, government_type, leader? }`: a party (or a movement, if decision 2b is taken) takes power. It sets the government type, the ruling party, the executive from the party leader (or a council), and the default laws of the new ideology. This works like the peace conference's "change ideology" term (`partiesOfGroup` in `src/sim/military/peace.ts`), which already installs a party of a chosen ideology.
- **Shifting support:** extend `add_ideology_support` to take a group (fascist, communist, and so on) and spread the change over its sub-ideologies.
- **`set_party_ideology`** (optional): a real party radicalises. Only on alternative paths, never as a claim about history.
- **`found_movement`** (only if decision 2b is taken): creates a generated party of a given sub-ideology for this country. It is flagged, the UI shows it as fictional, and it has a council and no named leader.
- **Ideology drives the AI:** a fascist or communist regime gets higher aggression and militarism weights (`src/sim/ai/ai.ts` `weights`), claims on neighbours, worse relations with liberal democracies, and the bloc changes that follow (leaving NATO or the EU). The country leaves the historical path (`followsHistory = false`) as soon as an alternative political focus completes.
- **Map and UI:** add the colour of the new ideology to the ideology map mode, and a tooltip on every political focus that shows which government it will install.

### 1c. The political branch (required in every tree)

Every tree, the generic one included, has a political branch:
- **Historical path:** what the country actually did (for Russia, Putin's "power vertical" and the dominant-party state). It has the highest `ai_weight` for countries on the historical path.
- **Alternative paths:** 3–5 mutually exclusive turns, available where the country's situation allows them. The usual set is:
  - liberal democratisation;
  - nationalist / populist turn;
  - fascist / ultranationalist turn;
  - communist / socialist turn;
  - religious turn (where it fits, e.g. Turkey or Iran);
  - military junta (via `trigger_coup`).
- **Gates:** each alternative opens through triggers that make it plausible, for example low stability, high unrest, a lost war, an economic crisis, the support level of an ideology, or interest-group approval. Each takes several focuses: build support, then the decisive step (`install_government`, a coup or a civil war), then consolidation (laws, blocs, the army).
- **Consequences** come through ideology: AI behaviour, relations and blocs change automatically.
- **Wording:** neutral and descriptive. A path describes what the government does, never praise or mockery. Real parties on alternative paths are a counterfactual ("if this party came to power"), not a claim about them.

## Part 2: Bigger trees

### Goal

Every conflict country and every major gets a real tree:
- **Size:** 60–80 focuses (the conflict countries and the US, Russia and China may go to about 100).
- **Branches:** the political branch above, plus 2–4 of economy, military, foreign policy, and the country's conflict branch.
- **Timing:** about 70 days per focus.

### Order

1. **Engine work from Part 1** (after the user's decisions).
2. **Russia** (pilot). It is written in the main session with a full political branch, including a fascist or ultranationalist path, a communist path, a liberal path and the historical path, and shown to the user in the game before anything is scaled up.
3. **Generic tree.** Grow it to about 40 focuses, with the political branch, so every minor country can also go fascist, communist, liberal or into a junta.
4. **Conflict countries:** United States, Iraq, Syria, Ukraine, Israel, Palestine, Afghanistan, then the Islamic State and the Taliban (usable while they hold land; their political branch covers internal choices, not elections).
5. **Other majors:** China, Iran, Turkey, Germany, France, United Kingdom, Japan, Italy, Spain, Poland.

### Rules for every tree

- **Gated by reality:** use `available` triggers on dates, offices, ruling party or ideology, wars, flags and completed focuses.
- **Effects are balanced gameplay:** +50 PP, ±0.02–0.05 stability, timed modifiers of 1–4 years. No single focus decides a war.
- **Facts (CLAUDE.md):**
  - Focuses named after real policies cite sources fetched with `scripts/research/wiki.ts`.
  - No invented people.
  - Neutral wording; no scripted deaths of living people.
- **Layout:** branches side by side, about 8 columns per branch, exclusive pairs on one row.

### Process per tree

1. **Research and draft:** research the real policies and turning points, then draft the branches and the historical path before writing JSON.
2. **Write and validate:** write `data/focus_trees/<tag>.json`, then run `npm run validate-data -- --only <TAG>` and `npm run check`.
3. **Playtest:**
   - `conflict-trace`: history must not change with the historical path taken.
   - `scenario-check`: leaders still right.
   - `soak.ts 10`.
   - Play an alternative path in the game (going fascist should visibly change the government, the laws, the map colour and the AI's behaviour).
4. **Commit and push:** one commit per tree, then `git push newmillennium HEAD:refs/heads/main` (this deploys the site).

### Agents

- **When:** only after the user approves the Russian pilot, and only with their go-ahead.
- **Model:** Sonnet at medium effort, at most 2–3 at once.
- **What each agent gets:** this plan, the pilot as the model, and the rule never to kill processes it did not start.
- **Audit:** check every result before committing.

## Done when

- The user's decisions in 1a are recorded in CLAUDE.md and this plan.
- The engine effects are built and tested.
- Every country in "Order" has a tree of the target size with a political branch.
- History is unchanged under the trace.
- The user has played an alternative path (for example, fascist Russia) and approved it.
