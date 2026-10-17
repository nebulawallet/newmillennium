# Conflicts plan (direction since 17 October 2026)

The point of New Millennium is the major conflicts of 2000–2026:

- Israel–Palestine
- Russia–Ukraine
- Iraq
- Afghanistan
- the Syrian civil war and ISIS

Effort goes there first. Breadth (every country, full histories) comes last.

## Research tiers (Phase 2 is no longer "all 212 countries")

| Tier | Who | What |
|---|---|---|
| **Full** | Major powers already done (USA, RUS, CHN, DEU, GBR, FRA, JPN, ITA, ESP, TUR, IRN, ISR, PSE, POL, UKR, KOR, …; 70 countries are committed) | Full 2000–2026 history: offices, parties, elections |
| **Light** | Countries the conflicts need, plus a few big players: IRQ, AFG (and AFN), SYR, maybe LBN, YEM; optionally IND, PAK, SAU, EGY, MEX, CAN, IDN, AUS, ZAF, NGA, VEN | Leaders on 1 January 2000, 3–5 main parties with their leaders, the last election before 2000, current leaders. No full history: the game simulates their politics from 2000 |
| **Default** | Everyone else | No research. A generic government built from data already in the repo (countries.json, World Bank, government type). No named people before 2026 (CLAUDE.md forbids invented real-world people; generated leaders only after 2026) |

Support for the tiers (done 17 October 2026): `research` on each entry in `data/world/countries.json`; light checks in `src/content/compile.ts` (`checkLight`); the default profile in `data/rules/politics.json` (`default_profile`) and `src/sim/state.ts`. To move a country up a tier, change its `research` value and add its folder.

## Partial research folders on disk (untracked, from interrupted agents)

| Folder | State | Plan |
|---|---|---|
| IND | 6 files | Keep as light if wanted |
| PAK | 5 files | Keep as light if wanted |
| BGD | 4 files | Drop (default) |
| IRQ | 6 files | Done: audited, committed (light) |
| AFG, AFN | 6 files each | Done: audited, committed (light) |
| CAN | 6 files | Optional light |
| MEX | 4 files | Optional light |
| EGY | 1 file | Optional |

Audit each before committing (checklist in HANDOFF.md, "Next steps").

## Conflict modelling (the main work)

**Already working**

- **Russia–Ukraine:**
  - Crimea passes to Russia on 18 March 2014 (`transfer_provinces`).
  - The 2022 invasion is a real `limited` war (the attacker aims only at land near its border; no capitulation).
  - Ukraine gets general mobilisation and Western aid through `add_divisions` and `add_equipment`.
  - The front holds at roughly a quarter of Ukraine's population occupied.
  - Georgia 2008 is also a limited war, with a ceasefire on 12 August.
- **Engine pieces available:**
  - Effects: `declare_war` (goals `conquest`, `status_quo`, `limited`), `white_peace`, `transfer_provinces` (by map adm1 codes), `add_divisions`, `add_equipment`.
  - Scripted wars keep both countries on the historical path.
  - The civil-war system (`src/sim/politics/unrest.ts`: rebel tag, province split, army split, fought out by the AI).

**Missing (do these):**

1. **Non-state actors as sides.** (Mechanic done 17 October 2026; see CONTENT_GUIDE §12.) Extend the civil-war / rebel mechanic so an event can spawn a named armed group on given regions, with divisions:
   - ISIS in Iraq and Syria, June 2014
   - the Taliban insurgency from 2001
   - Hamas controlling Gaza from June 2007
   - Donbas separatists, April 2014
   - Syrian rebels, 2011

   It also needs a way to end or shrink them on real dates: Mosul July 2017, Raqqa October 2017, Baghuz March 2019, Kabul 15 August 2021, the fall of Assad on 8 December 2024.
Status 17 October 2026: items 1–5 are scripted in `data/events/conflicts.json`, including Lebanon 2006, 2023–24 and 2026 (see HANDOFF.md, step 4).

2. **Iraq:** finish light IRQ data. The 2003 invasion becomes a real war, followed by occupation and a dated insurgency, ISIS in 2014 and the US withdrawal (18 December 2011).
3. **Afghanistan:** finish AFG/AFN light data. Then the 2001 war, the Taliban insurgency, and the Taliban return in 2021 (a real takeover, not only a text event).
4. **Syria:** light SYR data, then the civil war from 2011 with rebel and ISIS regions, the Russian intervention (September 2015) and the fall of Assad (December 2024).
5. **Israel–Palestine:**
   - Hamas–Fatah split, with Gaza separate from the West Bank from 2007.
   - Gaza wars as real fighting: 2008–09, 2014, 2021 and from 7 October 2023.
   - The 2006 Lebanon war against Hezbollah. This needs a non-state side in Lebanon.

Every dated fact comes from a fetched source:

- **Event candidates:** `scripts/dev/gen-events-history.py` (for candidates) and `scripts/research/verify-events.ts`.
- **Single facts:** `scripts/research/wiki.ts`.

Region codes for provinces come from `public/map/provinces.json` (`adm1` field).
