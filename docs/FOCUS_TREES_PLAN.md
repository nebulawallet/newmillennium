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

### 1a. Decisions (made by the user, 19 October 2026)

1. **There is a fascist ideology.** The group `fascist` ("Fascist / ultranationalist authoritarian") has the sub-ideologies `fascist`, `national_socialist` and `ultranationalist`, each with policy axes, preferred and forbidden laws, AI weights (aggression and militarism 1.8) and interest-group affinities. Diplomacy affinities are set both ways. It is in `data/ideologies/` and validated.
   - No party is classified in it yet. A real party moves to it only where a fetched source describes it that way (for example, Golden Dawn in Greece or the NPD in Germany, if they are in the data). That reclassification is research, done per country with sources.
2. **Real parties only.** An alternative path brings to power a real party already in the data whose sourced ideology fits. A country without such a party has no such path. Nothing is invented: no generated movements and no invented leaders (CLAUDE.md is unchanged on this and now says so for focus paths).
3. **Leaders of alternative regimes:** the real party's leader from the data on that date, or an unnamed council if the party has none.

### 1b. Engine work (main session; pure TypeScript in `src/sim`, validated and tested)

- **`install_government`** `{ party?, ideology?, government_type, leader? }`: a real party of the data takes power (named, or the most popular one of an ideology group in that country). It sets the government type, the ruling party, the executive from the party leader (or a council), and the default laws of the new ideology. This works like the peace conference's "change ideology" term (`partiesOfGroup` in `src/sim/military/peace.ts`), which already installs a party of a chosen ideology.
- **Shifting support:** extend `add_ideology_support` to take a group (fascist, communist, and so on) and spread the change over its sub-ideologies.
- **A helper for paths:** `partiesOfGroup` (peace.ts) already finds a country's real parties of an ideology. Path focuses use it through an `available` trigger, such as a new `has_party_of_group`, so a path only shows where a fitting real party exists.
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

- The decisions in 1a are recorded (done: here and in CLAUDE.md).
- The engine effects are built and tested.
- Every country in "Order" has a tree of the target size with a political branch.
- History is unchanged under the trace.
- The user has played an alternative path (for example, fascist Russia) and approved it.
