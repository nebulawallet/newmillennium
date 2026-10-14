# New Millennium: Architecture & Build Plan

Status: **draft, awaiting approval**. No code has been written yet.

Decisions already made:
- **UI:** Preact + signals.
- **De facto states:** they start as their own countries.
- **Phase 2:** two passes (core data for the whole world first, then depth).

---

## 0. Guiding principles

1. **Content is data.** Every country, person, party, ideology, law, tech, focus, event, decision, unit and bloc lives in `data/**/*.json`.
   - Engine code only knows *types* of things, such as "an effect called `add_stability`". It never knows specific things, such as "the USA".
   - Some places would otherwise need country-specific logic (Electoral College, Iran's Guardian Council vetting, China's party congress). In those cases the logic is a generic mechanism that data switches on.
2. **One source of truth.** Office tenure lives only on the office's `holders` list, never duplicated on the person. Seats live only in election results and the 2000 legislature snapshot.
3. **The simulation is pure TypeScript** (`src/sim`): no DOM and no Three.js. State is plain structured-clone-able data, with a seeded RNG and a command queue.
   - The player and the AI change state only through the same `Command` objects.
   - This keeps saves small, makes runs deterministic, and lets the AI move to a Web Worker later without a rewrite.
4. **The validator is the gatekeeper.** Content is compiled through the same code path as `validate-data`. If it doesn't validate, the game doesn't load it.
5. **Accuracy over coverage.** A real person who can't be confirmed is marked `needs_review`, never guessed. Nobody is invented.
   - Fictional people only appear after 2026, with `generated: true`, and only when a country runs out of real people.

---

## 1. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Build | Vite (latest stable), TypeScript strict | As requested |
| Render | three.js; `troika-three-text` for SDF map labels | Crisp zoom-scaled labels without a heavy dependency |
| UI | Preact + `@preact/signals`, plain CSS with custom properties (dark theme) | Chosen |
| Charts | Hand-written SVG components (hemicycle, pie, line, bar) | Tiny; full control over the look |
| Schemas | zod v4, which emits JSON Schema into `data/_schema/` | Gives VS Code autocomplete and validation while editing JSON |
| Scripts | `tsx` (runs TS directly in Node 24) | |
| Map pipeline | `mapshaper` (topology, simplify, dissolve, clip), `@turf/*`, `d3-geo`, `polylabel`, `geotiff`/`pngjs` | Topology-preserving simplification keeps shared borders identical |
| Tests | Vitest | Election maths, coalitions, effects, validator |
| Save | JSON + `fflate` compression → localStorage, falling back to IndexedDB when over the ~5 MB quota; download/upload `.json` | localStorage alone will overflow late-game |

---

## 2. Folder structure

```
grandstrategy/
├─ PLAN.md  CONTENT_GUIDE.md  POLITICS_REVIEW.md
├─ package.json  tsconfig.json  vite.config.ts  index.html
├─ data/                              ← ALL game content (JSON)
│  ├─ _schema/                        generated JSON Schemas (do not edit)
│  ├─ world/countries.json            master list: every tag, region, start_status, detail_tier
│  ├─ ideologies/groups.json          8 groups
│  ├─ ideologies/sub_ideologies.json  ~32 sub-ideologies
│  ├─ government_types.json
│  ├─ interest_groups.json            IG type definitions
│  ├─ laws/<category>.json            12 categories, each with its laws
│  ├─ traits/{leader,advisor,commander,party}.json
│  ├─ countries/<TAG>/
│  │   ├─ country.json                identity, offices, institutions, legislature, 2000 state, sources
│  │   ├─ people.json                 every real person tied to this country
│  │   ├─ parties.json                parties + factions (incl. not-yet-founded ones)
│  │   ├─ elections.json              calendar 2000–2026 + historical results + recurrence rules
│  │   ├─ interest_groups.json        2000 influence/approval per IG
│  │   ├─ laws.json                   2000 law per category
│  │   ├─ cabinet.json                ministers & advisors (tier-1 countries)
│  │   └─ military.json               high command (all countries; successors for majors)
│  ├─ blocs/*.json                    NATO, EU, CSTO, Shanghai Five/SCO, OAU→AU, Arab League, ASEAN, OPEC…
│  ├─ events/<theme>/*.json  decisions/*.json  focus_trees/*.json
│  ├─ techs/<category>.json  units/{equipment,sub_units}/*.json
│  ├─ economy/{resources,buildings,shocks}.json
│  ├─ names/<culture>.json            name pools, ONLY for post-2026 generated leaders
│  └─ map/{border_overrides_2000,province_overrides,straits,resource_sites,cultures}.json
├─ scripts/
│  ├─ validate-data.ts  review-report.ts  gen-schemas.ts  content-stats.ts
│  └─ map/{fetch,build-provinces,attributes,adjacency,export,benchmark}.ts
├─ .cache/raw/<dataset>/              raw downloads (gitignored, one empty dir per dataset)
├─ public/map/                        generated map assets (committed, so the game runs without re-downloading)
├─ src/
│  ├─ content/   zod schemas, loader, compiled ContentDB + types
│  ├─ sim/       state/, systems/{politics,economy,military,diplomacy}/, scripting/, commands/, rng, tick, save
│  ├─ render/    map scene, shaders, map modes, labels, picking, camera
│  ├─ ui/        Preact app, panels/, charts/, theme.css
│  ├─ ai/        strategic, political, military (worker-ready)
│  └─ main.ts
└─ tests/
```

**Content compile path:**
1. A Vite plugin and `validate-data` both call `compileContent()`. It loads all JSON, zod-parses it, resolves cross-references, and emits a single `ContentDB`.
2. In dev, editing any data file hot-reloads the content.
3. A production build writes `public/content/*.json`.

---

## 3. Politics data schemas (core of Phase 1)

The schemas below are shown as TypeScript-ish types. They will be implemented in zod.

### 3.1 Shared

```ts
type ISODate = `${number}-${number}-${number}`;    // "2000-01-01"
type Confidence = "verified" | "needs_review";
interface SourceRef { url: string; title: string; accessed: ISODate; note?: string }
interface Sourced { source: SourceRef[] /* min 1 */; confidence: Confidence; review_note?: string }
interface LocalName { en: string; native?: string; native_latin?: string }  // native = original script
```

- `confidence: "verified"` is only allowed when at least one source URL was actually fetched and confirmed the claim. The validator also flags `verified` entries whose sources are only generic home pages.

### 3.2 Country list (`world/countries.json`)

```ts
interface CountryListEntry {
  tag: string;                 // ISO alpha-3 where one exists (USA, RUS); custom for others (YUG, KOS, ESH, TWN, PSE…)
  region: "europe"|"former_ussr"|"north_america"|"latam_caribbean"|"mena"|"subsaharan_africa"|"south_asia"|"east_se_asia"|"oceania";
  start_status: "independent" | "de_facto" | "un_administered" | "releasable";
  un_member_2000: boolean; un_member_today: boolean;
  detail_tier: 1 | 2 | 3;      // 1 = full cabinet/advisors + deep content; 3 = small state, generic advisor slots
}
```

**Coverage.**
- All 193 current UN members.
- Observers and others: Holy See, Palestine, Taiwan.
- Releasables: Kosovo, SADR, Montenegro, South Sudan.
- De facto states at start: Transnistria, Abkhazia, South Ossetia, Nagorno-Karabakh, Northern Cyprus, Somaliland.
- UN-administered at start: East Timor (UNTAET).
- That's about 205 tags in total.
- Dependencies (Greenland, Puerto Rico, Hong Kong, New Caledonia…) are provinces of their sovereign, with an `autonomy` flag, unless they are later made releasable.

**Releasables still need full political data**, so they can be released with real leaders:
- Kosovo: Rugova/LDK, Thaçi/PDK
- South Sudan: Garang/SPLM
- SADR: Mohamed Abdelaziz
- Montenegro: Đukanović

**Naming.** On 1 Jan 2000 the state was officially the **Federal Republic of Yugoslavia** (tag `YUG`). It is renamed "Serbia and Montenegro" by the 2003 event, and the territory matches your spec.

### 3.3 Country (`countries/<TAG>/country.json`)

```ts
interface Country extends Sourced {
  tag: string; name: LocalName & { official?: LocalName }; adjective: string;
  culture_primary: string;                      // → map/cultures.json
  government: {
    type: GovernmentTypeId;                     // presidential | parliamentary | semi_presidential | constitutional_monarchy
                                                // | absolute_monarchy | theocracy | one_party | military_junta
                                                // | hybrid_authoritarian | failed_contested | transitional_administration
    effective_executive: OfficeId;              // whose decisions the player "is"
    constitution: { term_limit_amendable: boolean; emergency_powers: boolean; referendum_required_for?: string[] };
  };
  offices: Office[];
  legislature: Legislature | null;              // null only if the gov type allows (e.g. Saudi Arabia 2000)
  party_system: "multi_party" | "dominant_party" | "one_party" | "no_parties";
  no_parties_reason?: string;                   // required when party_system = no_parties
  start_2000: {
    ruling_parties: PartyId[];                  // government coalition
    confidence_and_supply?: PartyId[];
    ideology_support: Record<SubIdeologyId, number>;   // sums to 1; derived from latest real vote shares
    stability: number; war_support: number;     // gameplay initial values, documented rationale in notes
    at_war_with?: string[]; civil_war?: CivilWarStart;  // Afghanistan, DRC, Angola, Sri Lanka, Sierra Leone, Sudan, Colombia, Chechnya…
  };
  claims?: { tag: string; provinces: string[]; note: string }[];   // parent claims on de facto states etc.
}

interface Office {
  id: OfficeId;                      // "USA.president"
  title: LocalName;
  role: "head_of_state" | "head_of_government" | "head_of_state_and_government" | "supreme_leader"
      | "party_general_secretary" | "governor_general" | "deputy" | "collective_head_member"
      | "transitional_administrator" | "military_council_chair";
  power_weight: number;              // 0–1, share of executive power (e.g. nominal presidents ≈ 0.1)
  selection: "direct_election" | "legislature" | "electoral_college" | "hereditary" | "appointed"
           | "party_congress" | "council" | "military" | "religious_council" | "foreign_ex_officio" | "rotation";
  appointed_by?: OfficeId;           // PM appointed by President, GG by monarch…
  ex_officio_of?: OfficeId;          // Andorra co-prince = "FRA.president"; realms → "GBR.monarch"
  term_years?: number; term_limit?: { max_terms: number; consecutive_only: boolean };
  seats?: number;                    // collective heads: BiH Presidency 3, Swiss Federal Council 7, San Marino 2
  succession?: { type: "line"|"vice"|"council_choice"|"election"; heirs?: PersonId[] };
  holders: { person: PersonId | null; from: ISODate; to?: ISODate; acting?: boolean;
             vacant_reason?: string; historical: true }[];   // real tenure timeline 2000–2026
}
```

This office model covers the awkward real-world cases:
- **Dual offices:** Putin as acting President and still formally PM on 1 Jan 2000.
- **Nominal vs effective executive:**
  - Pakistan: Musharraf as Chief Executive, Tarar as President.
  - North Korea: Kim Jong-il as NDC chairman, Kim Yong-nam as SPA Presidium president.
  - Libya: Gaddafi holds no formal office.
- **Collective and rotating heads:** Switzerland, BiH, San Marino.
- **Shared persons:** Elizabeth II across all the realms.
- **Ex-officio heads:** Andorra.
- **Vacancies with a sourced reason:** Somalia before the TNG of August 2000.
- **Transitional administrators:** UNMIK, UNTAET, the BiH High Representative.

### 3.4 Legislature

```ts
interface Legislature { name: LocalName; chambers: Chamber[] }
interface Chamber extends Sourced {
  id: string; name: LocalName; seats: number; term_years: number; elected: "direct"|"indirect"|"appointed"|"mixed";
  system: { type: "fptp" | "two_round" | "av" | "list_pr" | "mmp" | "parallel" | "stv" | "block" | "sntv" | "appointed" | "indirect";
            formula?: "dhondt" | "sainte_lague" | "hare" | "droop";
            threshold?: number; district_model?: "national" | "provinces" | "admin1" | "custom";
            pr_share?: number;          // for mixed systems
            reserved_seats?: { group: string; seats: number }[] };
  seats_2000: Record<PartyId | "independents" | "vacant" | "appointed", number>;   // must sum to seats
  confidence_chamber: boolean;          // can bring the government down
}
```

### 3.5 Person (`countries/<TAG>/people.json`)

```ts
interface Person extends Sourced {
  id: PersonId;                          // "usa.al_gore" (country-prefixed slug, globally unique)
  name: LocalName; gender: "male" | "female";
  birth_year: number; birth_date?: ISODate;
  died?: ISODate;                         // ONLY for people who died before today; used by historical events only
  country: string; party?: PartyId; party_history?: { party: PartyId; from: ISODate; to?: ISODate }[];
  sub_ideology: SubIdeologyId;            // documented personal position
  traits: TraitId[];                      // factual background / documented stance (see 3.9)
  roles_possible: RoleTag[];              // head_of_government, president_candidate, opposition_leader,
                                          // foreign_minister, defence_minister, finance_minister, interior_minister,
                                          // army_chief, navy_chief, air_chief, intelligence_chief, party_leader…
  available: { from?: ISODate; to?: ISODate };   // e.g. future leaders become available when they historically emerged
  electoral_appeal?: number;              // balancing knob, default 50; NOT a judgement. Tuned so historical results reproduce
  military?: { branch: "army"|"navy"|"air"|"joint"; rank: string };
  generated?: false;                      // true only for post-2026 procedural leaders (separate pool)
  bio?: string;                           // 1–2 neutral sentences, documented facts only
}
```

**Health exits.**
- The aging system uses a per-person, per-year probability, driven by age, that a person "leaves public life for health reasons". It's a neutral event, rare, and never tied to a date.
- The `died` field is used only by historical-mode events for people who are no longer alive (e.g. Hafez al-Assad, June 2000). Even then the wording is neutral.

### 3.6 Party (`countries/<TAG>/parties.json`)

```ts
interface Party extends Sourced {
  id: PartyId;                           // "deu.spd"
  name: LocalName; abbrev: LocalName; color: `#${string}`;
  sub_ideology: SubIdeologyId; founded: ISODate | number; dissolved?: ISODate;
  status_2000: "active" | "banned" | "exiled" | "not_yet_founded" | "extra_parliamentary";
  leader_history: { person: PersonId; from: ISODate; to?: ISODate }[];
  popularity_2000: number;               // 0–1 (latest real vote share or credible poll; noted)
  lineage?: { formed_from?: PartyId[]; merged_into?: PartyId; split_from?: PartyId; renamed_from?: PartyId };
  factions: { id: string; name: string; sub_ideology: SubIdeologyId; strength: number;
              figures: PersonId[]; note?: string }[];
  coalition_red_lines?: PartyId[];       // documented refusals, e.g. the cordon sanitaire around Vlaams Blok
  regional_base?: string[];              // admin-1 or culture ids, for regionalist parties
}
```

- Parties founded after 2000 (United Russia, AKP, PdL, En Marche…) exist in the data with `status_2000: "not_yet_founded"`. Events activate them.
- In one-party and dominant-party states, the internal factions carry real figures and drive party-congress events.

### 3.7 Elections (`countries/<TAG>/elections.json`)

```ts
interface ElectionCalendar extends Sourced {
  rules: { kind: ElectionKind; chamber?: string; office?: OfficeId; every_years: number;
           month?: number; anchor: ISODate; snap_possible: boolean }[];   // continues the schedule after 2026
  elections: {
    id: string; date: ISODate; kind: "presidential"|"legislative"|"legislative_upper"|"referendum"
                                   |"party_congress"|"party_leadership"|"indirect_presidential";
    chamber?: string; office?: OfficeId; rounds?: number; question?: string;    // referendums
    historical: Sourced & {
      candidates?: { person: PersonId; party?: PartyId; share: number; round: number }[];
      party_results?: { party: PartyId; share: number; seats: number }[];
      winner?: PersonId | PartyId; turnout?: number;
    };
  }[];
}
```

- Countries with no elections declare `rules: []` plus `no_elections_reason`.
- Party congresses (CCP 2002/2012, Vietnam, Cuba, Laos…) live in the same calendar with `kind: "party_congress"`.

### 3.8 Ideologies

```ts
interface IdeologyGroup { id: string; name: string; color: string; diplomacy_affinity: Record<string, number> }

interface SubIdeology {
  id: string; group: IdeologyGroupId; name: string; color: string;
  policy: { economy: number; social: number; authority: number; sovereignty: number; religion: number;
            environment: number };                                  // each −1…+1; drives distance, coalitions, AI
  laws: { preferred: Partial<Record<LawCategoryId, LawId[]>>; forbidden: LawId[] };
  gov_types_allowed?: GovernmentTypeId[];                            // e.g. military_junta sub-ideology
  modifiers: Record<ModifierId, number>;
  ai_weights: Record<string, number>;
  ig_affinity: Partial<Record<InterestGroupTypeId, number>>;
}
```

Planned sub-ideologies (about 32):

| Group | Sub-ideologies |
|---|---|
| Liberal democratic | social liberal, classical liberal, libertarian, centrist, pro-European federalist |
| Social democratic / left | social democrat, democratic socialist, green, labourist |
| Conservative / centre-right | Christian democrat, liberal conservative, traditional conservative, agrarian |
| Nationalist / populist right | right populist, national conservative, ethno-nationalist |
| Socialist / communist | Marxist-Leninist, reformed communist, Bolivarian / left populist, Maoist |
| Autocratic / state-capitalist | dominant-party developmental, personalist, military junta, absolute monarchist, Pan-Arab / Ba'athist |
| Religious / theocratic | Islamist democratic, Islamist conservative, Shia theocratic (velayat-e faqih), Hindu nationalist, religious Zionist / Jewish religious |
| Non-aligned / technocratic | technocratic, regionalist / separatist, constitutional monarchist, independent / big-tent |

Labels stay neutral and descriptive. The list will be finalised in Phase 1.

### 3.9 Traits, interest groups, laws, government types

**Traits.** Traits are limited to verifiable background or documented stance. Examples:
- `former_military_officer`, `economist`, `former_governor`, `lawyer`, `former_intelligence_officer`
- `pro_eu_integration`, `eurosceptic`, `fiscal_conservative`, `market_reformer`, `nationalised_industry_advocate`, `religious_conservative`

Rules:
- No competence judgements such as "corrupt", "incompetent" or "drunk".
- Gameplay modifiers come from these factual traits plus office experience, which is computed from real tenure.

**Interest group types.** Each type has:
- `law_preferences`, `trait_reactions`, `economy_sensitivity`
- `actions` (protest, strike, uprising, coup, impeachment, civil war) with thresholds

Each country file sets 2000 `influence` (0–1) and `approval` (0–100), and optionally a real figurehead person (e.g. a union leader or an oligarch with a documented role).

**Laws.** There are 12 categories. Each law has:
- `pp_cost`, `requires_vote`, `allowed_gov_types`
- `ig_approval`, `modifiers`, `ideology_support_drift`

**Government types.** Each type has:
- `elections`, `needs_majority`, `coup_base_risk`
- `allowed_law_ranges`, `pp_gain`, `succession_model`

### 3.10 The shared script format (used by focuses, events, decisions; built in Phase 6, schema in Phase 1)

```json
{ "trigger": { "all": [ { "date_after": "2000-11-01" }, { "ruling_sub_ideology": "christian_democrat" },
                        { "not": { "has_flag": "recount_done" } } ] },
  "effects": [ { "add_stability": 0.03 },
               { "add_ideology_support": { "sub_ideology": "green", "value": 0.02 } },
               { "scope": "every_neighbor", "if": { "ideology_group": "liberal_democratic" },
                 "effects": [ { "add_opinion": { "target": "ROOT", "value": 10 } } ] } ] }
```

- Effects and triggers come from a registry. Each entry has its own zod arg schema, so `validate-data` checks every script in every file.
- Scopes available: `ROOT`, `FROM`, `country`, `every_neighbor`, `every_party`, `random_province`…

---

## 4. `validate-data` (Phase 1)

`npm run validate-data` with options `[--region X] [--only TAG,…] [--tier core|full] [--report]`.

**Fails (exit 1) when:**
1. Any file fails its zod schema, or there are duplicate IDs or dangling references (party leader → person, person → party, office → person, sub-ideology, law, trait…).
2. Any tag in `world/countries.json` is missing `country.json`, `people.json`, `parties.json` or `elections.json`.
3. There's no resolvable **head of state** and **head of government** holder on 2000-01-01. A sourced `vacant_reason` counts as resolved.
4. There's no party list, or an empty one without `party_system: "no_parties"` plus a reason.
5. There's no government type, or there's no election calendar where the government type holds elections.
6. Any person or party lacks `source` (at least 1 entry) or `confidence`.
7. Sanity checks fail:
   - Seats don't sum to the chamber size.
   - Ideology support doesn't sum to 1 ±0.01.
   - A tenure has `from > to`.
   - Someone held office before age 18.
   - A holder's party didn't exist on that date.
   - A real person (not `generated`) has `available.from` after their last tenure… plus similar checks.
8. A `generated: true` person appears anywhere before 2026-12-31, or appears in a historical election.

**`--tier full`** (Pass B) adds:
- At least 4 opposition or rival figures for tier-1 countries, and at least 1 for others.
- Cabinet completeness for tier-1 countries.
- Military chief for 2000.
- Office holder continuity from 2000 to 2026 (no unexplained gaps).

**Reporting.**
- `npm run review-report` regenerates the auto section of `POLITICS_REVIEW.md` from every `needs_review` item. A hand-written notes section above it is preserved.
- It also prints a coverage table: countries × completeness.

---

## 5. Phase 2 research method (two passes, as agreed)

**How the research runs.**
- Parallel subagents are split by region. Big regions are split further into batches of about 6–10 countries, which gives about 25 batches per pass.
- Each agent gets:
  - A strict template.
  - A finished exemplar country, `DEU`, which I build by hand in Phase 1.
  - The accuracy rules.
- Each agent writes only its own `countries/<TAG>/` folders, so there are no write conflicts.

**Sources, in priority order:**
1. Official government and parliament sites.
2. Wikipedia lists of heads of state and government, and election-result articles.
3. IPU Parline for chambers, seats and electoral systems.
4. Election-commission pages.

Every claim gets a `source` URL that was actually fetched.

**Marking confidence.**
- Anything not confirmed by a fetched page is marked `needs_review`, with a note on what is uncertain.
- Agents may not "fill in" from memory without a source. Memory can only suggest *where* to look.

**After each batch:**
1. Run `validate-data --only <batch>`.
2. Do a spot audit: I re-check about 10% of the people against their sources.
3. Run `review-report`.

| Pass | Covers | Done when |
|---|---|---|
| A (core) | Every country's 2000 heads of state and government, offices, government type, legislature and 2000 seats, parties with 2000 leaders and popularity, election calendar 2000–2026 with winners, ideology support, IG and law starting values | `validate-data --tier core` is green for the whole world |
| B (depth) | Successors 2000–2026, opposition and rival candidates with results, party factions, post-2000 parties, cabinets (tier 1), military chiefs plus successors, currently active politicians for after 2026, monarchy heirs | `--tier full` is green; the review list is triaged |

**Tier-1 countries** (full cabinet and advisors; the top 30 by 2000 GDP plus major military powers), about 37:

> USA, JPN, DEU, GBR, FRA, CHN, ITA, CAN, BRA, MEX, ESP, KOR, IND, AUS, NLD, RUS, TWN, ARG, CHE, BEL, SWE, TUR, SAU, POL, IDN, NOR, AUT, ZAF, IRN, ISR, PAK, PRK, EGY, UKR, IRQ, SYR, VNM

**Honest scale note.** This is roughly 3,000–4,000 people and 1,400 elections. Pass A is many hours of agent research and Pass B more. Some long-tail items (minor parties in small states, 2000 cabinets of small countries) will end up `needs_review`.

---

## 6. Map data: what I'll use and how I'll get it

All of these are public sources with no login. Raw downloads go to `.cache/raw/<dataset>/`, which is gitignored. Processed output is committed in `public/map/`.

**I will ask you before Phase 3 downloads anything**, with exact file names and sizes checked via HTTP HEAD first.

| Dataset | Use | Source | Approx. size |
|---|---|---|---|
| Natural Earth 10m admin-0 countries + **breakaway/disputed areas** | Country outlines, de facto states, Kashmir lines | naturalearthdata.com / `nvkelso/natural-earth-vector` (public domain) | ~6 MB |
| Natural Earth 10m **admin-1** states/provinces | Province base (~4,600 polygons) | same | ~15 MB |
| Natural Earth populated places, lakes, rivers, marine polys, geography regions, glaciated areas | Split seeds, names, sea zones, terrain hints | same | ~10 MB |
| Natural Earth 10m roads (optional) | Infrastructure proxy | same | ~20 MB |
| AWS Terrain Tiles (Terrarium PNG, zoom 4, ~256 tiles) | Elevation and ruggedness → terrain | AWS Open Data, public | ~20–30 MB |
| Köppen-Geiger 0.5° climate raster | Desert, tundra, jungle classification | Beck et al. 2018 (CC BY) | to be confirmed (the archive also holds finer rasters) |
| GeoEPR (ETH Zürich) | Ethnic/cultural majority per province, separatism | icr.ethz.ch (free; citation required; **non-commercial/research terms**; fallback is a hand-curated `map/cultures.json`) | ~10 MB |
| World Bank WDI API, SIPRI milex | 2000 population, GDP, debt, military spend (Phase 7, small JSON/xlsx) | api.worldbank.org, sipri.org | <5 MB |

Total raw is about 80–120 MB. Processed output is about 10–20 MB.

**Pipeline** (`npm run build-map`, Node scripts using mapshaper and turf):
1. Load admin-1 and build shared topology.
2. Apply `map/border_overrides_2000.json`:
   - South Sudan → Sudan.
   - Serbia + Montenegro + Kosovo → YUG.
   - Crimea and Sevastopol → Ukraine.
   - Hong Kong and Macau → China.
   - East Timor stays a separate UN-administered entity.
   - De facto areas are clipped out of their parents from the breakaway layer.
   - Controller ≠ owner is set where real civil wars were ongoing (Afghanistan, Sri Lanka, Angola…).
3. **Split** oversized units: Voronoi/k-means seeded by populated places, scored by area^α·pop^β.
4. **Merge** tiny units within the same admin-1 region field.
5. Target **3,000–5,000 provinces**.
6. Attributes:
   - Terrain: elevation, ruggedness, climate, regions.
   - Population: country 2000 total distributed by settlement weight.
   - Infrastructure.
   - Resources: country production totals placed at curated deposit sites in `map/resource_sites.json`, with sources.
   - Culture majority.
   - Coastal flag and port candidates.
7. Adjacency:
   - Land adjacency from topology arcs.
   - Strait links from `map/straits.json` (Bosphorus, Gibraltar, Kerch, Øresund…).
   - Sea zones generated over oceans.
8. Export:
   - `provinces.bin`: quantised geometry and triangles.
   - `provinces.json`: attributes.
   - `adjacency.json`, `borders.bin`, `labels.json`, plus an ID raster for the texture approach.
9. Edits in `map/province_overrides.json` survive regeneration.

**Projection:** Miller cylindrical, cropped to about 58°S–84°N, with seamless horizontal wrap-around (three instanced draws).

**Rendering benchmark** (Phase 3, `scripts/map/benchmark.ts` plus an in-app `?bench`):
- **A, meshes:** one merged `BufferGeometry` with a per-vertex province index, and a 4096-wide color lookup `DataTexture`. Recoloring a map mode is a texture upload with no geometry rebuild. Borders are a separate line mesh with zoom-adaptive width. Picking uses a CPU spatial grid with point-in-polygon tests.
- **B, ID texture:** an 8192×4096 RG8 province-ID texture, with color from the same lookup texture. Borders are drawn in the shader via neighbour sampling. Picking is a CPU array read.
- **Measured:** FPS at 4 zoom levels, map-mode switch time, load time, GPU memory, and border crispness at maximum zoom.
- I expect A to win on sharpness and memory, and B on shader effects. **Hybrid fallback:** mesh A, plus the ID raster used only for terrain shading and picking.

---

## 7. Simulation architecture (summary for later phases)

**State.** `GameState` holds:
- `date`, `rng`, `rules` (historical/dynamic…)
- `countries[tag]`: ruling coalition, office holders, ideology support, IG state, laws, PP, stability, economy, flags, modifiers
- `parties[id]`: runtime popularity, leader, factions, status
- `people[id]`: alive/available, current role
- `provinces`: struct-of-arrays, typed arrays for owner, controller, population and so on
- Armies, wars, blocs, and the event queue

Static content stays in `ContentDB` and is never saved. Saves store only deltas and IDs, plus a content hash.

**Tick.**
- Daily: movement, combat, construction, production.
- Weekly: support drift, unrest, AI political updates.
- Monthly: economy, IG approval, PP, election and term checks, aging.
- Countries are AI-processed in staggered buckets.

**Elections** (Phase 5):
1. Party share = Σ (sub-ideology support × affinity by policy distance) × popularity × leader appeal × incumbency × economy (growth, unemployment, inflation vs expectation) × war effect × scandals × campaign spend × foreign influence × IG endorsements. Then logit-normal noise is applied, and the result is broken down by province using regional bases and cultures.
2. Seats are allocated by the chamber's `system`: D'Hondt, Sainte-Laguë, Hare, FPTP by district, two-round, MMP, parallel, STV approximation, and the US Electoral College (a data table by census era).
3. In **historical mode**, results are pulled toward the recorded result, but only while the "path" still matches (the same candidates and parties exist and nothing major has diverged). In **dynamic mode** there is no pull.
4. Vitest checks that historical mode reproduces the real winners in ≥90% of seeded runs.

**Coalitions.**
- The formateur is the largest party, or the head of state's choice.
- The search is for minimal connected winning coalitions, minimising policy distance and respecting red lines.
- Historical coalitions get a bonus in historical mode.
- Confidence votes, government collapse and snap elections are all modelled.
- The coalition UI shows acceptance odds for each portfolio or policy concession.

**IGs, unrest, coups and civil war.**
- Approval feeds stability, coup risk and law vetoes.
- The escalation ladder is: protest → strike → mass movement → colour revolution / uprising → coup or civil war.
- In a civil war, provinces split by IG and culture loyalty, and armies split by military-IG loyalty.

**AI.** Utility AI weighted by the ruling sub-ideology's `ai_weights`. It issues the same `Command`s as the player and is designed to move to a Web Worker in Phase 12.

---

## 8. Phased build plan

Every phase ends with these steps:
1. `npm run check` (tsc + vitest + validate-data).
2. Run the game in the browser pane and check the console for errors.
3. A summary of what works and what's stubbed.
4. A git commit.

| # | Phase | Key deliverables | Acceptance |
|---|---|---|---|
| 1 | Politics schemas + validator | `git init`, Node/TS tooling, zod schemas, JSON Schema generation, `validate-data`, `review-report`, global data (8 groups, ~32 sub-ideologies, government types, IG types, 12 law categories, traits), the full `world/countries.json` (~205 tags), `DEU` as a fully worked, sourced exemplar, `CONTENT_GUIDE.md` v1 | Validator passes for DEU, fails correctly for missing countries, and unit tests cover each failure rule |
| 2 | World politics DB | Pass A for all regions in parallel, then Pass B. `POLITICS_REVIEW.md` is kept updated | `--tier core` green worldwide after A; `--tier full` green after B |
| 3 | App setup + map | Vite + Three app shell, **download approval checkpoint**, map pipeline, benchmark A vs B with a decision written up, map modes (political, terrain, resources, ruling ideology, party support, unrest, relations, factions; supply once Phase 10 exists), tooltips, selection, labels | About 3–5k provinces at 60 FPS; correct 2000 borders verified visually for YUG, SDN, UKR/Crimea, de facto states and TLS |
| 4 | Loop + top bar + politics screen | Daily tick, speeds 1–5, weekly and monthly hooks, save/load (local + file), top bar, country selection screen (2000 leader, party and government type for all countries), politics screen with live data, hemicycle, pie chart, historical/dynamic rule toggle | Save → load round-trips identically; every country's politics screen renders |
| 5 | Political systems | Elections and election-night screen, coalitions and negotiation UI, IGs, laws, unrest, coups, impeachment, civil war split, party lifecycle (form/split/merge/ban/rename), leadership contests, congresses | US 2000 and Russia 2000 reproduce in historical mode; dynamic mode varies; a forced civil war splits the map |
| 6 | Scripting + content | Effect, trigger and scope registry; events, decisions, the generic focus tree, and the USA and RUS trees with party- and leader-dependent branches; a first set of historical events (Bush v. Gore, Ecuador Jan 2000, FRY Oct 2000…) | All scripts validate; the Gore and Bush branches diverge |
| 7 | Economy | GDP, growth, debt, rates, taxes, budget, real 2000 figures, factories, services, construction, resource market, historical shocks with choices that feed elections and IGs | 2000 figures sourced; the 2008 shock propagates into an election swing |
| 8 | Research | 9 categories, ~1995–2035+, ahead-of-time penalties, starting techs by country | Data-driven tree UI |
| 9 | Production + units | Equipment and variants, production lines with efficiency, division designer, manpower, movement | Build a division and move it |
| 10 | Combat, supply, war, peace | Combat width/org/attack/armor/entrenchment, supply, air and naval zones, nukes, world tension, wargoals, peace conference | AI-free war resolves to a peace deal |
| 11 | Diplomacy | Opinion, guarantees, access, sanctions, trade, 2000 blocs + expansion events, UNSC with vetoes, foreign influence and coup backing | |
| 12 | AI | Strategic, political and military AI; worker offload; ~205 countries smooth at speed 5 | 10 game-years with no errors at an acceptable tick time |
| 13 | Content + polish | The other 30 unique trees, more events, balance, UI polish | |

---

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Errors in real-person data | Source and confidence on every entry, spot audits, `needs_review` instead of guesses, and the generated review list |
| Neutrality | Trait whitelist limited to factual background; the `bio` field is reviewed; scandals and dynamic events only ever target generic or fictional subjects, never real people |
| Map artefacts at borders and in the 2000 overrides | Overrides are data-driven, there is a visual checklist, and manual province overrides survive regeneration |
| Save size | Saves store only deltas, are compressed, and fall back to IndexedDB |
| Performance with ~205 AI countries | Staggered AI buckets, typed arrays, and a worker |
| GeoEPR licence (non-commercial terms) | Flagged now; the curated culture fallback keeps the game licence-clean if needed |
