# Content guide

All game content lives in `data/` as JSON. The engine never hard-codes a country, person, party, ideology, law, tech, focus or event. To add or change content, edit data files and run:

```bash
npm run validate-data
```

The validator is the gatekeeper: the game loads content through the same compiler (`src/content/compile.ts`), so anything that fails validation will not load.

**Editor support.** Run `npm run gen-schemas` once. VS Code then autocompletes and checks every data file as you type: the schemas are in `data/_schema/` and the mapping is in `.vscode/settings.json`. Unknown keys are errors, so typos are caught.

---

## 1. Accuracy rules for real people and parties (non-negotiable)

1. **Never invent a person, name or party.** Every real-world record must be verifiable.
2. **Every person, party, office, chamber, election result and country file carries:**
   - `source`: an array of at least one `{ url, title, accessed }`.
   - `confidence`: `"verified"` or `"needs_review"`.
3. **When `verified` is allowed.** Use `verified` only if you actually opened the source and it confirms the record.
   - If you are unsure about any fact in the record, use `needs_review` and say what to check in `review_note`.
   - `died` may be `YYYY` or `YYYY-MM` when sources give no exact day.
   - Never guess a date: Wikidata often stores dates at year precision. The research tool prints `2000` rather than `2000-01-01`, so copy it as a year (`2000`) where the schema allows, or mark the record `needs_review`.
4. **Neutral content only.**
   - Traits record documented background or stated positions only (see `data/traits/leader.json`), never judgements.
   - `bio` is one or two sentences of documented fact.
   - Scandal events never target real people.
5. **Health and death.** Never script the death or illness of a living person.
   - `died` is only for people who have actually died, and only historical-mode events may use it.
   - Random age-based retirement is handled by the engine with neutral wording.
6. **Fictional people.** These are only for after 2026, when a country runs out of real politicians.
   - Mark them `generated: true` with `available.from` of `2027-01-01` or later.
   - Draw names from `data/names/<culture>.json`.
7. **Review list.** Run `npm run review-report` after editing. It regenerates `POLITICS_REVIEW.md`, which lists everything marked `needs_review`.

### Research tool

`scripts/research/wiki.ts` queries Wikipedia and Wikidata and prints raw facts with URLs to cite:

```bash
npx tsx scripts/research/wiki.ts person "Gerhard Schröder" Q567
```
Prints birth and death, gender, parties, and every position held with dates.

```bash
npx tsx scripts/research/wiki.ts holders Q4970706 --from 1999
```
Prints every holder of an office (by position QID).

```bash
npx tsx scripts/research/wiki.ts chairs "Social Democratic Party of Germany" --from 1999
```
Prints a party's leaders.

```bash
npx tsx scripts/research/wiki.ts wikitext "2002 German federal election" --section 0
```
Prints the raw infobox (results, seats, dates).

```bash
npx tsx scripts/research/wiki.ts search "president of france"
```
Finds a Wikidata QID.

Wikidata has errors and gaps. Cross-check against the Wikipedia article (or an official source) before marking a record `verified`. Missing acting holders are a common gap.

---

## 2. Files and ids

| What | Where |
|---|---|
| Master country list (every tag on the map; `research` = `full`, `light` or `default`) | `data/world/countries.json` |
| Ideology groups / sub-ideologies | `data/ideologies/groups.json`, `sub_ideologies.json` |
| Government types | `data/government_types.json` |
| Interest group types | `data/interest_groups.json` |
| Laws (one file per category) | `data/laws/<category>.json` |
| Traits | `data/traits/*.json` |
| Modifiers (every modifier id used anywhere) | `data/modifiers.json` |
| Cultures | `data/cultures/cultures.json` |
| A country's politics | `data/countries/<TAG>/{country,people,parties,elections,cabinet,military,interest_groups,laws}.json` |

**Ids.**
- **Global definitions** use `snake_case` ids, e.g. `social_democrat` or `free_press`.
- **Country records** use scoped ids: the lower-case tag, a dot, then a snake_case name. Examples: `deu.angela_merkel`, `deu.spd`, `deu.chancellor`.
  - A record's prefix must match its folder.
  - Other countries may reference it, e.g. Australia's monarch office points at `gbr.elizabeth_ii`'s office through `ex_officio_of`.
- **Person ids** are `<tag>.<given>_<family>` in ASCII. Add a disambiguator only when needed, e.g. `usa.george_w_bush` vs `usa.george_h_w_bush`.

**Dates** are `YYYY-MM-DD`. Party `founded`/`dissolved` and leader `from`/`to` also accept a bare year when that is all the source gives.

---

## 3. Adding or editing a country

The four required files are `country.json`, `people.json`, `parties.json` and `elections.json`.

`data/countries/DEU/` is the fully worked exemplar; copy its structure.

### country.json

- **`government`**
  - `type`: a government type id.
  - `head_of_state_office` and `head_of_government_office`: may be the same office, e.g. a US-style president with role `head_of_state_and_government`.
  - `effective_executive`: the office whose decisions the player makes.
- **`offices`**: the executive offices, each with a `holders` timeline in chronological order.
  - Each holder has `person`, `from`, and optionally `to`, `acting` and `note`. `to` may be the last day in office or the handover date.
  - **Leave `to` off** if the person is still in office on the data date (`as_of` in `world/countries.json`).
  - **Vacancies**: use `person: null` with `vacant_reason`. Example: Somalia before August 2000.
  - **Acting holders**: use `acting: true`. Acting holders may overlap a vacancy without triggering the overlap check.
  - **Collective heads of state**: set `seats` (e.g. 3 for the BiH Presidency) and list every member's tenure.
  - **Ex officio offices**: set `ex_officio_of` instead of holders. Examples: Andorra's co-prince is the President of France, and a realm's monarch is the UK monarch.
  - `power_weight` splits real executive power. A ceremonial president is about 0.1; Iran's Supreme Leader is about 0.6 alongside a President at about 0.4.
- **`legislature.chambers[].seats_2000`**: the seat distribution on 1 January 2000.
  - Keys are party ids, or `independents`, `vacant`, `appointed` or `others`.
  - The totals must equal `seats`.
- **`start_2000.ideology_support`**: popular support per sub-ideology, summing to 1.
  - Derive it from the last real vote shares and explain how in `ideology_support_note`.
  - Values for one-party states are documented estimates; say so in the note.
- **`party_system: "no_parties"`**: requires `no_parties_reason`. Use it only where parties were genuinely banned or absent (e.g. Saudi Arabia in 2000).

### people.json

- **Who goes in:** everyone referenced anywhere in that country's files. That means:
  - Office holders (2000 to today).
  - Party leaders.
  - Opposition figures and candidates.
  - Cabinet members and military chiefs.
  - Currently active politicians who can lead after 2026.
- **`roles_possible`**: what the game may use the person for (`head_of_government`, `opposition_leader`, `foreign_minister`, `army_chief`, etc.).
- **`available.from`**: when the person enters the game as a usable character. Leave it unset for people active in 2000; set it to when later figures historically emerged.
- **`electoral_appeal`** (0–100, default 50): a balancing setting tuned so historical results reproduce. It is not a judgement of the person.

### parties.json

- Include every party with seats in 2000, plus significant extra-parliamentary movements.
- **Parties founded after 2000** use `status_2000: "not_yet_founded"` with the real `founded` date. Events bring them into the game. Examples: Die Linke 2007, AfD 2013, En Marche 2016.
- **`lineage`** records mergers, splits and renames, e.g. PDS → Die Linke.
- **`factions`**: real internal groupings with real figures.
  - Strengths are gameplay estimates and should sum to about 1.
  - One-party states must have factions; leadership contests at party congresses are fought between them.
- **`coalition_red_lines`**: only documented refusals to govern together.

### elections.json

- **`elections`**: every real national election from 2000 to today, in date order. Results go in `historical`:
  - `party_results` (share and seats), and/or `candidates` (person, party, share or votes, round).
  - `winner`.
  - Its own `source` and `confidence`.
- **`rules`**: the recurrence (`every_years` from an `anchor` date). The engine continues the calendar after the last real election.
  - In historical mode the game holds each election on its real date (including real snap elections) for as long as the country follows history; otherwise it counts `every_years` from the last election.
  - For a direct presidential election, set `system` when it is not decided in two rounds: `"plurality"` (one round, most votes wins), `"irv"` (instant runoff) or `"electoral_college"`. Two rounds is the default.
- **How results are used.** In historical mode, an election whose real candidates and parties still exist follows the recorded result (`historical_adherence`, 97% by default). So:
  - `winner` must be the real winner: the person for presidential elections, the party (or the leading party of a bloc, e.g. CDU for CDU/CSU) for legislative ones.
  - Shares that the record does not attribute to a party count as "others"; seats with special keys (`independents`, `others`, …) are copied as they are.
- **No elections:** countries without elections use `rules: []`, `elections: []` and `no_elections_reason`.
- **Party congresses** in one-party states use `kind: "party_congress"`.

### electoral_units.json (optional)

Sub-national units with real past results. It does two things:
- **Regional lean.** Every election breaks its national result down by province; where a province's admin-1 code is in a unit, the unit's real `basis_shares` set its lean (a proportional swing from the `basis_election`). Countries without the file get a generic breakdown (regional parties, culture, population density).
- **Electoral college.** With `office` set, the units elect that office: each unit's `votes` (by apportionment year, `from_year`) go to its plurality winner (`method: "winner_take_all"`) or are split (`"proportional"`).

Rules:
- `basis_shares` are real vote shares from a fetched source, by party id; `basis_election` must be an election id in elections.json.
- `adm1` codes are the map's Natural Earth `adm1_code` values (see `.cache/work/admin1_attrs.csv` after `npm run fetch-map`).
- The USA file is the worked example: states and DC, electoral votes for the 1990–2020 censuses, and the 2000 state results.

### cabinet.json and military.json (optional; required by `--tier full`)

Both use the same office format.

- **Cabinet offices** use `role: "minister"` plus a `portfolio` (`foreign`, `defence`, `finance`, `interior`…), or `role: "intelligence_chief"`.
- **Military offices** use `military_chief`, `army_chief`, `navy_chief` or `air_chief`.
- **Tier-1 countries** need foreign, defence, finance and interior ministers plus an intelligence chief, all with holders on 2000-01-01.
- **Every independent country** needs a `military_chief`.

### interest_groups.json and laws.json (optional)

- `interest_groups.json` sets 2000 `influence` (0–1) and `approval` (0–100) per interest group type.
- `laws.json` sets the law in force on 2000-01-01 for each category.
- Missing entries fall back to defaults derived from the government type.

---

## 4. Ideologies

- **Groups** (`groups.json`) drive diplomacy and AI. Every group must list a `diplomacy_affinity` toward every group, including itself.
- **Sub-ideologies** (`sub_ideologies.json`) each have:
  - A six-axis `policy` vector (each −1…+1): economy, social, authority, sovereignty, religion, environment. Coalition distance comes from these vectors.
  - Preferred and forbidden laws.
  - Modifiers.
  - AI weights.
  - Interest group affinities.
- **Adding a sub-ideology:** add an entry with a new id. The validator checks every law, modifier and interest group it references.
- Every party maps to exactly one sub-ideology. A party's factions may map to others.

## 5. Laws, interest groups, government types, traits, modifiers

- **Laws.** Each category file lists its laws in spectrum order. A law has a `pp_cost`, `requires_vote`, optional `allowed_gov_types`, `modifiers`, and an optional weekly `ideology_support_drift`.
- **Interest groups.** Each type has law preferences, reactions to leader traits, economic sensitivity, and escalation `actions`: protest, strike, mass movement, uprising, coup, impeachment, civil war. Each action has an approval threshold and a minimum influence.
- **Government types.** Each type sets whether it holds elections, needs a majority, requires a legislature and requires parties. It also sets coup risk, political power gain, succession model and forbidden laws.
- **Traits** must be factual. Use `background` for career or training and `stance` for documented positions. Advisor and commander role traits are attached by the engine according to office.
- **Modifiers.** Every modifier id used anywhere must be defined in `data/modifiers.json`.

### Politics tuning (`data/rules/politics.json`)

Gameplay constants for elections, coalitions, interest groups, unrest and laws: voter affinity, leader appeal and incumbency weights, noise, historical adherence, coalition penalties, confidence-vote risk, coup and civil-war scales, law cooldowns. Every value has a default in `src/content/schemas/rules.ts`; list only the ones you change. These are gameplay estimates, not facts about the world.

A law's `ideology_support_drift` may use the key `ruling` for "the ruling party's sub-ideology" (e.g. state-controlled media slowly favours whoever governs).

## 6. Scripts: effects and triggers

Focuses, events and decisions share one scripting format. The registry is `src/content/script/registry.ts`, and `validate-data` checks every script against it.

```json
{
  "trigger": { "all": [ { "date_after": "2000-11-01" }, { "ruling_sub_ideology": "christian_democrat" },
                        { "not": { "has_flag": "recount_done" } } ] },
  "effects": [
    { "add_stability": 0.03 },
    { "add_ideology_support": { "sub_ideology": "green", "value": 0.02 } },
    { "if": { "limit": { "party_exists": "deu.linke" }, "then": [ { "add_party_popularity": { "party": "deu.linke", "value": 0.01 } } ] } },
    { "every_neighbor": { "limit": { "ruling_ideology_group": "liberal_democratic" },
                          "effects": [ { "add_opinion": { "target": "ROOT", "value": 10 } } ] } },
    { "random_list": [ { "weight": 70, "effects": [ { "set_flag": "a" } ] }, { "weight": 30, "effects": [] } ] }
  ]
}
```

- **Node shape:** every node is an object with exactly one key.
- **Logic:** `all`, `any`, `not`.
- **Scopes:** `every_neighbor`, `any_ally`, `country` (with `tag`), and others.
- **Adding a new effect or trigger** is an engine change: add it to the registry with an argument schema, then implement its handler.

## 7. Events, decisions and national focus trees

All three use the script format above. `validate-data` checks every trigger and effect, every referenced id, every `country_event` target and every `has_completed_focus` id.

### Events (`data/events/*.json`)

`{ "events": [ { id, title, description, options: [ { id, name, effects, trigger?, ai_weight? } ], ... } ] }`. Each event needs one of:
- `historical: { date, source, confidence, any_path?, dynamic_mode? }`: fires on a real date in historical mode, for each listed country (`countries`) whose `trigger` holds, while the country follows history (`any_path: true` fires regardless; `dynamic_mode: true` also fires in dynamic mode).
- `mean_days`: a random event, checked monthly while its `trigger` holds.
- `triggered_only: true`: fired by a `country_event` effect (optionally after `days`).

Rules for real events: the description states documented facts from the cited source, neutrally (no allegations, no characterisation). Never script the death of a living person. `data/events/historical_2000s.json` is the example.

The player chooses an option in the event window; AI countries choose by `ai_weight`.

### Decisions (`data/decisions/*.json`)

`{ "categories": [ { id, name, description } ], "decisions": [ { id, name, description, category, visible?, available?, cost: { political_power }, effects, days?, complete_effects?, cooldown_days?, fire_once?, ai_weight? } ] }`. `days` makes a decision last; `complete_effects` run when it ends. Shown in the Decisions tab (P).

### National focus trees (`data/focus_trees/*.json`)

One file per tree: `{ id, name, countries, focuses: [ { id, name, description, x, y, days, prerequisites, mutually_exclusive, available?, bypass?, effects, ai_weight? } ] }`.
- `countries: []` marks the single generic tree; a tree that lists countries replaces it for them.
- `prerequisites` is a list of groups: every group must be met, and within a group any one completed focus is enough (`[["a", "b"]]` means a or b).
- `available` makes branches depend on who governs, e.g. `{ "holds_office": { "person": "usa.al_gore", "office": "usa.president" } }` or `{ "ruling_party": "rus.cprf" }`.
- Trees that name real laws, reforms or programmes carry `source` and `confidence`, and describe them neutrally (see `usa.json`, `rus.json`).

## 8. Economy

- `data/economy/worldbank_2000.json` is generated by `npm run fetch-worldbank` (World Bank API, CC BY 4.0). Do not edit it by hand; add indicators in `scripts/data/fetch-worldbank.ts`.
- `data/economy/economy.json`: economic rules (factory value, construction, growth and inflation dynamics, AI fiscal rule), resources (each tied to a World Bank rent indicator), and `defaults` by income tier. Defaults are gameplay estimates used only where the World Bank has no figure; the game marks those values as estimates.
- `data/economy/buildings.json`: buildings with a construction cost, `level` (province or national) and what one level adds.
- Economic shocks are events: use the `economic_shock` effect (growth points fading over months, plus unemployment and inflation pressure) and `set_budget` (see `data/events/economic_shocks.json`).

## 9. Technologies

- One file per category in `data/techs/` (`id`, `name`, `description`, `military`, `techs`). Each technology has a `year` (when it became broadly available), a `cost` in research days, `prerequisites` (groups, any one per group), a column `x`, and permanent modifier `effects`.
- Keep technologies generic (no real product names); the year is a design choice, not a claim.
- `data/techs/rules.json` holds the research rules (slots, penalties, starting lags).

## 10. Units

- `data/units/equipment.json`: equipment families (`domain` land, air or naval) with variants from oldest to newest; each variant has a `requires_tech` (omit for the base model), a `cost` in military-factory days and combat `stats`. Use generic names, never real product names.
- `data/units/sub_units.json`: battalions (`kind: battalion`) and support companies (`kind: support`, width 0) with manpower, equipment needs, organisation, hp, width, speed (km/h) and training days.
- `data/units/military.json`: manpower share by conscription law, production efficiency, the default division templates (`modern_level` decides which countries start with them) and starting-army rules.
- `data/units/war.json`: combat, supply, capitulation, war support, white peace and world-tension values (gameplay estimates), plus `nuclear_states_2000`, which must stay sourced.

## 11. Diplomacy

- `data/diplomacy/blocs.json`: blocs with `kind` (military, economic, political), `defensive` (members join wars against any member), `opinion` between members, `trade_growth`, `accession_days`, an optional `rival` bloc and `join_trigger` (a trigger scoped to the applicant), `renamed` (later names with dates) and `members_2000`. Memberships are facts: source them.
- `data/diplomacy/un.json`: permanent members, the regional groups and their non-permanent seats, and the real elected members with their terms. Later elections are simulated.
- `data/diplomacy/rules.json`: opinion weights, costs and thresholds (gameplay values).
- Enlargements are events with a `historical` date, the countries that join in `countries`, and a `join_bloc` effect (`leave_bloc` for withdrawals). Triggers `in_bloc` and `opinion_of_above` and effects `add_opinion` and `add_wargoal` are available to every script.

## 12. Armed groups (non-state sides)

- `data/conflicts/armed_groups.json`: groups that events put on the map. Each one has a three-letter `tag` (not a country tag), `name`, `color`, `kind` (`insurgency`, `militant_group`, `separatist`, `rebel_coalition`), a division `template`, a neutral `description`, `source` and `confidence`.
- Groups are not on the map at the start. Three effects run them; any event can use them:
  - `spawn_armed_group` = `{ group, regions: [{ from, adm1?, provinces? }], divisions, war_with? }`: the group takes the provinces of `from` in those regions (map adm1 codes, or province names from `public/map/provinces.json`; neither means all of them), raises divisions there, and fights every `from` country in a limited war, unless `war_with` lists others (`[]` for none). Running it again on an existing group extends it.
  - `armed_group_loses` = `{ group, regions, to? }`: the group's provinces whose original country is `from` go back to it, or to `to`. A group left with no land is defeated.
  - `end_armed_group` = `{ group, into?, disband_army_of? }`: without `into`, its land goes back and its divisions disband; with `into`, land and divisions pass to that country (a takeover, or an annexation). `disband_army_of` first removes a country's army (it collapsed in the takeover).
- Wars with a group call in no allies and never end by exhaustion; they end by a script (`white_peace`, `end_armed_group`) or when the group holds nothing. While a group is at war, land changes hands with control.
- Every date that spawns, shrinks or ends a group is a fact: give the event a `historical` date with a source.
- Historical mode: AI countries do not attack or enter armed-group land, so group land changes only by script (the player still can); wars started by historical events do not end by exhaustion. Dynamic mode fights both freely.
- Related effects:
  - `deploy_divisions` = `{ count, in }` sends the country's hardest-hitting divisions abroad and gets military access from the host (Kuwait 2003, Iraq 2003–2011); `recall_divisions` = `{ from }` brings them home; `add_divisions` takes an optional `in` too.
  - `occupy_provinces` = `{ regions }`: the scoped country takes control of provinces on a real date and the owner's divisions there disband (the fall of Baghdad, 9 April 2003).
  - `declare_war` takes an optional `zone` (regions of the target) for a limited war: the attacker aims for and may enter only those provinces (Russia 2022: Kherson, Zaporizhzhia, Mariupol).
  - `dissolve_country` = `{ into }` merges the scoped country into another (the United Front into Afghanistan, December 2001).
- The conflict timeline lives in `data/events/conflicts.json`. Check it with `npx tsx scripts/dev/conflict-trace.ts [YYYY-MM-DD] [--dynamic]`, which prints every war and group change from 2000.

