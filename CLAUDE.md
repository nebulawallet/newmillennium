# CLAUDE.md: standing rules for agents in this repo

Start every session by reading [HANDOFF.md](HANDOFF.md). It holds the current state and the next steps.

## Non-negotiable content rules (real people and parties)

- **Never invent a person, name, party, date or number.** Every real-world fact must come from a source you actually fetched (use `scripts/research/wiki.ts`).
- **Every person, party, office, chamber, election and country record carries `source` and `confidence`.**
  - `verified` only when a fetched source confirms the record.
  - Otherwise use `needs_review` with a `review_note` saying what to check.
- **Neutrality.** No satire, no allegations or scandals about real people, no health speculation. Traits record only factual background or documented stances.
- **No scripted deaths.** Never script the death of a living person. `died` is only for people who have actually died.
- **Fictional leaders** are allowed only after 2026, with `generated: true`.
- **Year-only dates stay years.** Wikidata often stores only a year; never invent a day.

## Engineering rules

- **Content is data.** Nothing country-specific is hard-coded in logic. Add content in `data/`, never in `src/`.
- **Validate after every data change:**
  ```bash
  npm run validate-data -- --only <TAGS>
  ```
  `npm run check` must pass before every commit.
- **The simulation (`src/sim`) stays pure TypeScript:** no DOM, no Three.js, seeded RNG only (never `Math.random`), state that can be serialised to JSON.
- **The UI follows [DESIGN.md](DESIGN.md):**
  - HOI4 positions for every system.
  - Original art only; no Paradox-owned assets.
  - Square corners, bronze hairlines, a tooltip on every number.
  - No eyebrows or labels above headings.
  - Unbuilt systems say which phase adds them.
- **Commits:** one per phase or batch, with a clear message, ending with the Co-Authored-By line the harness provides.
- **Research agents** follow [scripts/research/AGENT_BRIEF.md](scripts/research/AGENT_BRIEF.md). Run at most about 6 at once, and audit each result before committing.

## Where things live

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the code map and [CONTENT_GUIDE.md](CONTENT_GUIDE.md) for the data formats.
