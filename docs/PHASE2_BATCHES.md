# Phase 2 research queue

Every batch is one research agent (`general-purpose`).

**The prompt.** Each prompt says:
- Read `scripts/research/AGENT_BRIEF.md` and follow it exactly.
- The country tags in the batch, one at a time, each finished before the next starts.
- A scratch folder.
- That the agent writes only to `data/countries/<TAG>/`.
- Country-specific hints. These say where to look, never facts to copy.

See the prompts used in the pilot (git history, early October 2026) for the format.

**Running batches.**
- Run at most about 6 batches at once.
- After each batch:
  1. Run `npm run validate-data -- --only <tags> --tier core`.
  2. Spot-check birth dates, 2000 office holders and the latest election against `scripts/research/wiki.ts`.
  3. Verify any claim dated after June 2026 yourself.
  4. Run `npm run review-report`.
  5. Commit.

## Status key

- **done:** committed and audited
- **partial:** an uncommitted folder exists
- **todo:** not started

## Done (Pass A)

DEU (Pass A and Pass B), USA, RUS, GBR, CHN, IRN, SOM, SWE, FRA, AND, ESP, NLD, JPN, NOR, POL, TUR, ISR, PSE, ITA, MCO, CZE, HUN, SVK, SVN, HRV, MKD, ALB, BIH, YUG, MNE, KOS, PRT, BEL, LUX, ROU, BGR, GRC, CYP, NCY, DNK, FIN, ISL, KOR, TWN, PRK, MNG, UKR, BLR, MDA, PMR, IRL, AUT, CHE, LIE, EST, LVA, LTU, BRA, ARG, CHL, MLT, SMR, VAT, GEO, ARM, AZE, ABK, SOS, NKR, ICH

## Running (relaunched 15 October 2026, evening)

| Agent | Tags |
|---|---|
| 22 | EGY JOR LBN SYR |
| 23 | IRQ KUR SAU YEM |
| 35 | AFG AFN NPL BTN LKA TEL MDV |
| 34 | IND PAK BGD |
| 14 | KAZ KGZ TJK TKM UZB |
| 15 | CAN MEX CUB |

## Todo batches

| # | Tags | Notes |
|---|---|---|
| 17 | URY PRY BOL PER ECU | Ecuador's January 2000 coup: Mahuad replaced by Noboa |
| 18 | COL FAR VEN GUY SUR | |
| 19 | GTM SLV HND NIC CRI PAN BLZ | Belize is a realm |
| 20 | DOM HTI JAM TTO BHS BRB | Jamaica, the Bahamas and Barbados were realms in 2000 (Barbados until 2021) |
| 21 | ATG DMA GRD KNA LCA VCT | Realms except Dominica |
| 24 | KWT BHR QAT ARE OMN | `no_parties` where accurate, with a reason |
| 25 | DZA MAR ESH TUN LBY MRT | Libya: Gaddafi held no formal office |
| 26 | NGA GHA CIV SEN GMB GNB CPV | Côte d'Ivoire: Guéï junta after the December 1999 coup |
| 27 | SLE LBR GIN MLI BFA NER TGO BEN | |
| 28 | CMR TCD CAF GAB GNQ STP COG | |
| 29 | COD RCD MLC AGO UNI ZMB | Second Congo War; UNITA |
| 30 | SDN SSD ETH ERI DJI SML KEN | |
| 31 | UGA RWA BDI TZA MWI MOZ | |
| 32 | ZAF NAM BWA ZWE LSO SWZ | |
| 33 | MDG MUS SYC COM | |
| 36 | IDN MYS SGP BRN PHL TLS | East Timor under UNTAET |
| 37 | THA VNM LAO KHM MMR | |
| 38 | AUS NZL PNG FJI SLB VUT | Realms; Fiji's May 2000 coup |
| 39 | WSM TON KIR TUV NRU FSM MHL PLW | Tuvalu is a realm |

## Pass B (after Pass A is complete)

- Cabinets (foreign, defence, finance and interior ministers plus the intelligence chief) for tier-1 countries.
- A military chief for every independent country.
- Opposition depth (tier 1 needs 4 or more figures).
- Party factions.
- Currently active politicians to lead after 2026.

`npm run validate-data -- --tier full` must pass.
