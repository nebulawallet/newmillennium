# Research brief: building a country's politics data (Phase 2, Pass A)

You are researching one or more countries for **New Millennium**, a grand strategy game that starts on **1 January 2000**. The data must describe the real world. The game's political simulation depends on it, and the person who commissioned it has strict accuracy rules.

The project root is `C:\Users\eskis\Documents\grandstrategy`. Read these before starting:

1. `CONTENT_GUIDE.md`: data format and accuracy rules (sections 1–3).
2. `data/countries/DEU/*.json`: the finished exemplar. Copy its structure and level of care exactly.
3. `src/content/schemas/country.ts`: the authoritative schema. Unknown keys are errors.
4. `data/ideologies/sub_ideologies.json`, `data/government_types.json`, `data/traits/leader.json`, `data/laws/*.json`, `data/interest_groups.json`, `data/cultures/cultures.json`: the ids you may use.

## Hard rules

- **Never invent a person, name, party, date or number.** Every fact must come from a page you actually fetched in this session.
- **Marking confidence.** Only use `"confidence": "verified"` when fetched data confirms the record. Otherwise use `"needs_review"` with a `review_note` saying exactly what to check. A `needs_review` record is fine; a guessed record is not.
- **Cross-check Wikidata against Wikipedia**, because Wikidata has errors and gaps. In Germany it got resignation dates wrong and omitted acting office-holders. When they disagree, prefer the Wikipedia article (or an official source) and mention the conflict in a `note`.
- **Death dates.** `died` may be `YYYY` or `YYYY-MM` if no exact day is documented.
- **Date precision.** If the tool prints a year (`1999`) rather than a full date, store a bare year where the schema allows it (party `founded`, leader `from`/`to`). Where a full date is required, mark the record `needs_review`.
- **Neutrality.**
  - Traits may only be factual background (lawyer, former regional executive…) or clearly documented stances.
  - Do not add `bio` text.
  - Never record allegations, scandals, criminal cases or health matters about real people.
  - Treat every party and ideology even-handedly in names, notes and descriptions.
- **Only write inside your own `data/countries/<TAG>/` folder(s).**
  - Do not edit schemas, global data files, other countries, or `POLITICS_REVIEW.md`.
  - Do not run `npm run review-report`.
  - If you need a culture, sub-ideology or trait that doesn't exist, use the closest existing id and list what's missing in your final report.
- **Use the Write tool to create JSON files**, not shell heredocs.
- **Respect the Wikimedia APIs.** Run research commands one at a time, not in parallel loops. The tool already retries on HTTP 429.

## Research tool

Run all commands from the project root.

**A person:** birth and death dates, gender, parties, positions held with dates, and enwiki/Wikidata URLs.
```bash
npx tsx scripts/research/wiki.ts person "Name on Wikipedia" Q12345
```

**Every holder of an office**, by position QID. Find the QID with `search`, or from a `person` result's `held:` lines.
```bash
npx tsx scripts/research/wiki.ts holders Q11696 --from 1999
```

**A party's chairs/leaders.**
```bash
npx tsx scripts/research/wiki.ts chairs "Party article title" --from 1999
```

**Raw wikitext** of an article: infobox results, seats, dates, lists. Use `--section 0` for the infobox, or `--grep` to filter lines.
```bash
npx tsx scripts/research/wiki.ts wikitext "2000 Russian presidential election" --section 0
```

**Search Wikidata** for an entity.
```bash
npx tsx scripts/research/wiki.ts search "president of russia"
```

**Tips.**
- Election articles have an infobox (section 0) with `party1 = / seats1 = / percentage1 =` or `candidate1 = / popular_vote1 = / percentage1 =`. Many also have an `{{Election results ...}}` template with exact votes.
- "List of heads of state of X" and "List of prime ministers of X" articles give complete tenure lists, including acting holders.
- If a page name is ambiguous, `person` may return a disambiguation page. Re-run with the QID.
- Keep notes in your scratch folder (given in your task), not in the project.

## Pass A scope (what to produce)

For each country, create these files:

### country.json
- **Government**: real government type, `head_of_state_office`, `head_of_government_office` and `effective_executive`.
- **Offices** for head of state and head of government, with the **complete holder timeline from the person in office on 2000-01-01 through today** (data date 2026-10-14). Include acting holders and documented vacancies.
- **Legislature**: chambers with seat counts, electoral system, and `seats_2000`, the composition on 1 January 2000.
  - If you can only find the result of the last election before 2000, use it and say so in a `note` on the chamber's `system`.
  - Seat totals must add up exactly. Use `independents`, `vacant`, `appointed` or `others` keys for the remainder.
- **`start_2000`**:
  - Ruling parties.
  - `ideology_support`, derived from the last real national vote shares before 2000 and summing to 1. Explain the derivation in `ideology_support_note`. For non-democracies, give an estimate and say it is an estimate.
  - Stability and war support (gameplay values).
  - `at_war_with` / `civil_war` if applicable.
- **`claims`**: only if real and relevant (e.g. the PRC's claim on Taiwan).

### people.json
Everyone referenced anywhere in your files:
- All head of state and head of government holders 2000–today.
- Party leaders in 2000 and leaders of the main parties since.
- Every presidential candidate with ≥5% of the vote, plus runners-up.
- For parliamentary systems, the main parties' candidates for head of government in each election.
- Tier-1 countries should also include obvious major opposition figures of 2000.

For each person:
- Get birth and death dates and gender from the research tool (`person`). Never assume gender from a name. If the source has none, mark the record `needs_review`.
- `party`, `sub_ideology`, `roles_possible`.
- Factual `traits` only where clearly documented. It's fine to leave traits empty.
- `available.from` only for people born 1965 or later who were not yet active in 2000. It must not be later than their first office, leadership post or candidacy in your files, because the validator checks this.

### parties.json
- Every party with national parliamentary seats on 2000-01-01, plus significant extra-parliamentary parties and movements.
- Parties founded 2000–2026 that won seats or the head of government, with `status_2000: "not_yet_founded"`.
- For each party:
  - Native and English names, abbreviation, a sensible colour (the party's real colour where known), sub-ideology and founding date.
  - Leader history from 2000 (years are fine when that's all the source gives).
  - `popularity_2000`: the last national vote share before 2000, with the source noted.
  - Lineage for mergers, splits and renames.
- Factions are Pass B, except in one-party and dominant-party states. There, include at least the main documented internal groupings, with neutral descriptions and real figures.

### elections.json
- **Every national election from 2000-01-01 to 2026-10-14**:
  - Presidential, legislative (each directly elected chamber), indirect presidential (by parliament or electoral college), and national referendums.
  - In one-party states, party congresses that chose the leadership.
- For each election: date, kind, chamber or office, and `historical` with:
  - `party_results` (share and seats) for legislative elections.
  - `candidates` (share or votes, and round) for presidential elections.
  - `winner`.
  - Its own `source` and `confidence`.
- `party_results[].seats` means the seats held **after** the election. When only part of the chamber was contested (e.g. US Senate classes, staggered upper houses), also give `seats_won`.
- `rules` for the recurrence: `every_years`, an `anchor` set to the most recent real election, and `snap_possible`.
  - For direct presidential elections decided in a single round by plurality (e.g. Mexico, South Korea, Taiwan, the Philippines), add `"system": "plurality"`. Two rounds is the default; use `"irv"` for instant runoff.
- `winner` must be the real winner. In historical mode the game replays the record, so a wrong winner changes history. For a legislative election, the winner is the largest party (for a joint list or union such as CDU/CSU, the leading party).
- A person has one `party` (their main party). Record concurrent or earlier memberships in `party_history`, e.g. a United Front party leader who is also a CCP member.
- Seat keys besides party ids are `independents`, `others`, `appointed`, `vacant` and `speaker`. Parties whose members do not take their seats get `abstentionist: true`. For referendums that are not plain yes/no, use `options: [{label, share, votes}]`.
- People, parties and offices have an optional `note` field. Use it to record conflicting sources (e.g. "Wikipedia gives 3 Feb, Wikidata 6 Feb").
- Countries without national elections: use `rules: []`, `elections: []` and a `no_elections_reason`.

### interest_groups.json and laws.json
- `interest_groups.json`: 2000 influence (0–1) and approval (0–100) for all 10 interest group types. These are gameplay estimates; say so in `note`.
- `laws.json`: the law in force on 2000-01-01 for each of the 12 categories, with a short `note` on the non-obvious choices.

## Light tier (use when your task says "light")

Most countries now get light research only. Produce the same six files, but cover only the following.

**What to cover**

- **country.json:**
  - government type and constitution notes
  - the offices: head of state, head of government, effective executive
  - holders on 1 January 2000 and the current holders, with dates
  - holders in between only where the task asks for them (conflict countries may need key transitions)
  - legislature with its 1 January 2000 seats
- **people.json:** only the people above, plus the leaders of the 3–5 main parties, each sourced.
- **parties.json:** the 3–5 main parties (those holding most seats in 2000, plus any later major party the task names), with their leaders in 2000 and now.
- **elections.json:**
  - the election rules
  - the last national election before 2000, so seats and support are right
  - the most recent election
  - No full 2000–2026 history: the game simulates the rest.
- **interest_groups.json and laws.json:** as in Pass A. These are gameplay judgements, noted as such.

**What to skip**

- full election histories
- every party leader change
- minor parties
- referendums, unless the task names them

All hard rules still apply. Every fact comes from a fetched source, no invented dates, and anything uncertain is marked needs_review.

## Definition of done

1. This command returns **0 errors**:
   ```bash
   npm run validate-data -- --only <TAG> --tier core --warnings
   ```
2. There are no `REVIEW_NOTE` warnings. Every `needs_review` record has a `review_note`.
3. Re-read your files once against the hard rules above.

## Final report (your last message)

Keep it under 400 words:
- Files written and counts (people, parties, elections).
- Every `needs_review` record and why.
- Any missing global ids (cultures, sub-ideologies, traits) you had to approximate.
- Schema friction: anything the schema could not express accurately.
- Real-world facts that conflict between sources.
