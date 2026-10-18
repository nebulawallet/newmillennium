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
  - Square corners, 1px blue hairlines, a tooltip on every number.
  - Countries in an actor role sit on placards (nameplates); resolution blue means selected, white means holding the floor.
  - No eyebrows or labels above headings.
  - Unbuilt systems say which phase adds them.
- **Commits:** one per phase or batch, with a clear message, ending with the Co-Authored-By line the harness provides.
- **Research agents** follow [scripts/research/AGENT_BRIEF.md](scripts/research/AGENT_BRIEF.md). Audit each result before committing. See "Scope and cost" below for when and how to run them.

## Scope and cost (since 17 October 2026)

- **Focus:** the game is about the major conflicts of 2000–2026: Israel–Palestine, Russia–Ukraine, Iraq, Afghanistan, and the Syrian civil war with ISIS. Put effort there before breadth. The plan is in [docs/CONFLICTS_PLAN.md](docs/CONFLICTS_PLAN.md).
- **Research tiers:**
  - **Full:** the 70 countries already committed (`"research": "full"`). Do not extend this tier.
  - **Light:** only countries the conflicts need (IRQ, AFG, AFN, SYR, maybe LBN, YEM) and a few big players the user approves. See "Light tier" in AGENT_BRIEF.md.
  - **Default:** everyone else. No research at all.
- **Ask the user before spawning any agent**, and before any other expensive step.
- **Agent models:**
  - Research agents run on **Sonnet at medium effort**: pass `model: "sonnet"` and `effort: "medium"` to the Agent tool.
  - Simple bulk jobs (reformatting, templated data) run on Sonnet at low effort.
  - Run at most 2–3 agents at once.
  - Engine and conflict-mechanics work stays in the main session.
- **Agent prompts must say:** never kill processes you did not start (no `taskkill /IM node.exe`).
- **Minor countries:** one shared generic focus tree, and the default politics profile once it exists. No per-country content for them.

## Where things live

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the code map and [CONTENT_GUIDE.md](CONTENT_GUIDE.md) for the data formats.
