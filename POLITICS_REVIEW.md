# Politics data review list

Everything in the game about real people, parties and institutions must be verifiable.
Records that could not be confirmed against a fetched source are marked `confidence: "needs_review"`
and listed below for a human to check. When you have checked an item, fix the data, add a source,
set `confidence: "verified"`, and re-run `npm run review-report`.

## Manual notes

_This section is preserved by `npm run review-report`._

### How "verified" was established (Phase 1, DEU exemplar)

- Facts were read from raw Wikidata (SPARQL) and Wikipedia wikitext using `scripts/research/wiki.ts`, not from model summaries. This covers dates of birth and death, gender, office tenures, party chairs and election results.
- Wikidata and Wikipedia were cross-checked. Wikidata errors found and corrected in the DEU data:
  - Susanne Hennig-Wellsow resigned as Die Linke co-chair on 2022-04-20; Wikidata gives 2022-06-25.
  - Frauke Petry's AfD co-chair term ended on 2017-09-29; Wikidata gives 2017-04-22.
  - Wikidata lists Gernot Erler as foreign minister 2005-2009. He was a Minister of State, so he is not included.
  - Wikidata leaves Norbert Walter-Borjans's SPD co-chair term open-ended. It ended on 2021-12-11.
- Acting office holders missing from Wikidata were added from Wikipedia:
  - Jens Böhrnsen (acting President, 2010).
  - Horst Seehofer (acting President, 2012).
  - Peter Altmaier (acting Finance Minister, 2017-18).
  - Johann-Georg Dora (acting Inspector General, 2009-10).
  - Olaf Scholz and Frank-Walter Steinmeier (acting SPD chairs).
- Dates Wikidata holds only at year precision are stored as bare years, not invented day dates. Examples: the Greens' co-spokespersons 1998–2008, the CSU and FDP chairs, and NPD leaders.

### Gameplay values that are estimates, not facts

These are not real-world claims and are not listed as `needs_review`. Each is labelled as an estimate in its file.

- Faction strengths inside parties.
- Interest group influence and approval.
- Starting stability and war support.
- `electoral_appeal`, which defaults to 50 for everyone and will be tuned in Phase 5 so historical elections reproduce.

### Post-2026 and very recent data

Some records come from live Wikidata and could not be independently confirmed. Each is flagged `needs_review` or noted:

- FDP chair Christian Dürr (2025-05-16 to 2026-05-30) and his successor Wolfgang Kubicki.
- A 2026 change of co-chair in Die Linke.
- The BND president since September 2025.

### Neutrality

Live sources sometimes report allegations or investigations involving real people. These are never added to the data or the game; scandal events are generic and never name real people.

<!-- AUTO-GENERATED BELOW: run `npm run review-report`; edits below this line are overwritten -->

## Needs review: 5 of 152 records

Countries with politics data: 1 / 212.

Countries with no data yet (211): ALB, AND, AUT, BEL, BIH, BGR, HRV, CYP, CZE, DNK, FIN, FRA, GRC, HUN, ISL, IRL, ITA, LIE, LUX, MLT, MCO, NLD, MKD, NOR, POL, PRT, ROU, SMR, SVK, SVN, ESP, SWE, CHE, GBR, YUG, MNE, KOS, VAT, NCY, RUS, UKR, BLR, MDA, EST, LVA, LTU, GEO, ARM, AZE, KAZ, KGZ, TJK, TKM, UZB, PMR, ABK, SOS, NKR, ICH, USA, CAN, ATG, ARG, BHS, BRB, BLZ, BOL, BRA, CHL, COL, CRI, CUB, DMA, DOM, ECU, SLV, GRD, GTM, GUY, HTI, HND, JAM, MEX, NIC, PAN, PRY, PER, KNA, LCA, VCT, SUR, TTO, URY, VEN, FAR, DZA, BHR, EGY, IRN, IRQ, ISR, JOR, KWT, LBN, LBY, MRT, MAR, OMN, QAT, SAU, SYR, TUN, TUR, ARE, YEM, PSE, ESH, KUR, AGO, BEN, BWA, BFA, BDI, CPV, CMR, CAF, TCD, COM, COD, COG, CIV, DJI, GNQ, ERI, SWZ, ETH, GAB, GMB, GHA, GIN, GNB, KEN, LSO, LBR, MDG, MWI, MLI, MUS, MOZ, NAM, NER, NGA, RWA, STP, SEN, SYC, SLE, SOM, ZAF, SDN, TZA, TGO, UGA, ZMB, ZWE, SSD, SML, UNI, RCD, MLC, AFG, AFN, BGD, BTN, IND, MDV, NPL, PAK, LKA, TEL, CHN, JPN, KOR, PRK, MNG, TWN, BRN, KHM, IDN, LAO, MYS, MMR, PHL, SGP, THA, VNM, TLS, AUS, NZL, FJI, PNG, SLB, VUT, WSM, TON, KIR, TUV, NRU, FSM, MHL, PLW

### DEU — Germany (5)

| kind | record | what to check | file |
|---|---|---|---|
| chamber | `bundesrat` Bundesrat | The source confirms 69 votes today; confirm the total was also 69 on 1 January 2000 (Hesse's fifth vote dates from 1996). | data/countries/DEU/country.json |
| person | `deu.martin_jaeger` Martin Jäger (b. 1964) | Not found on Wikidata/enwiki by the research tool; the Wikipedia BND article lists 'Martin Jäger (b. 1964)' as president since 15 September 2025. Confirm birth date and gender from the BND or dewiki page. | data/countries/DEU/people.json |
| party | `deu.wasg` Labour and Social Justice – The Electoral Alternative (WASG) | Founding/dissolution dates confirmed on Wikidata; confirm Klaus Ernst's role and dates on the WASG executive board. | data/countries/DEU/parties.json |
| party | `deu.linke` The Left (Linke) | Wikidata lists a change of co-chair on 2026-06-20 (Jan van Aken succeeded by Luigi Pantisano). Confirm with the party or Wikipedia before adding it. | data/countries/DEU/parties.json |
| party | `deu.dvu` German People's Union (DVU) | Confirm the 1987 registration as a party and the 2010-2011 merger into the NPD. | data/countries/DEU/parties.json |
