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

## Needs review: 120 of 1478 records

Countries with politics data: 17 / 212.

Countries with no data yet (195): ALB, AUT, BEL, BIH, BGR, HRV, CYP, DNK, FIN, GRC, HUN, ISL, IRL, ITA, LIE, LUX, MLT, MCO, MKD, PRT, ROU, SMR, SVK, SVN, CHE, YUG, MNE, KOS, VAT, NCY, UKR, BLR, MDA, EST, LVA, LTU, GEO, ARM, AZE, KAZ, KGZ, TJK, TKM, UZB, PMR, ABK, SOS, NKR, ICH, CAN, ATG, ARG, BHS, BRB, BLZ, BOL, BRA, CHL, COL, CRI, CUB, DMA, DOM, ECU, SLV, GRD, GTM, GUY, HTI, HND, JAM, MEX, NIC, PAN, PRY, PER, KNA, LCA, VCT, SUR, TTO, URY, VEN, FAR, DZA, BHR, EGY, IRQ, ISR, JOR, KWT, LBN, LBY, MRT, MAR, OMN, QAT, SAU, SYR, TUN, ARE, YEM, PSE, ESH, KUR, AGO, BEN, BWA, BFA, BDI, CPV, CMR, CAF, TCD, COM, COD, COG, CIV, DJI, GNQ, ERI, SWZ, ETH, GAB, GMB, GHA, GIN, GNB, KEN, LSO, LBR, MDG, MWI, MLI, MUS, MOZ, NAM, NER, NGA, RWA, STP, SEN, SYC, SLE, ZAF, SDN, TZA, TGO, UGA, ZMB, ZWE, SSD, SML, UNI, RCD, MLC, AFG, AFN, BGD, BTN, IND, MDV, NPL, PAK, LKA, TEL, KOR, PRK, MNG, TWN, BRN, KHM, IDN, LAO, MYS, MMR, PHL, SGP, THA, VNM, TLS, AUS, NZL, FJI, PNG, SLB, VUT, WSM, TON, KIR, TUV, NRU, FSM, MHL, PLW

### AND — Andorra (12)

| kind | record | what to check | file |
|---|---|---|---|
| chamber | `general_council` General Council | Add party records (with founding dates) for the National Democratic Group, New Democracy and the Democratic National Initiative and move their 10 seats out of 'others'; confirm no changes between 1997 and 1 January 2000. | data/countries/AND/country.json |
| party | `and.pla` Liberals of Andorra (L'A) | Only the founder is recorded as leader; add the party's presidents with dates (the fetched pages give lead candidates, not presidents). | data/countries/AND/parties.json |
| party | `and.ps` Social Democratic Party (PS) | Founding: sources give only June 2000; the day (01) is a placeholder because a bare year 2000 counts as before the game start for not_yet_founded parties. Leaders: Catalan Wikipedia confirms Bartumeu as PS president in 2009; other dates are inferred from lead candidacies and Wikidata memberships (he joined SDP in 2013). Confirm presidents and dates. | data/countries/AND/parties.json |
| party | `and.pd` Democratic Party (PD) | No leader found in the fetched sources. | data/countries/AND/parties.json |
| party | `and.lauredian_union` Lauredian Union (UL) | Resolve the founding year conflict (2001 per the infobox; a list of that name won 2 seats in 1997) and add leaders. | data/countries/AND/parties.json |
| party | `and.apc` Andorra for Change (APC) | Add founder Eusebi Nomen as a person and leader; sub-ideology not checked. | data/countries/AND/parties.json |
| party | `and.da` Democrats for Andorra (DA) | Confirm the year Xavier Espot became party president (2019 assumed from his lead candidacy) and whether formed_from the Liberal Party is the right lineage (infobox: predecessor Reformist Coalition). | data/countries/AND/parties.json |
| party | `and.sdp` Social Democracy and Progress (SDP) | Add presidents with dates. | data/countries/AND/parties.json |
| party | `and.tv` Third Way (TV) | Sub-ideology not checked against a source; add Josep Pintat Forné as leader. | data/countries/AND/parties.json |
| party | `and.cc` Committed Citizens (CC) | Founding year assumed from its first election (2019); confirm the founding date and leaders. | data/countries/AND/parties.json |
| party | `and.ae` Andorra Forward (AE) | Sub-ideology (right_populist) not checked against a fetched source. | data/countries/AND/parties.json |
| party | `and.concordia` Concord (Concòrdia) | Sub-ideology (centrist_liberal) not checked against a fetched source; Escalé's start as leader assumed from the founding date. | data/countries/AND/parties.json |

### CHN — China (4)

| kind | record | what to check | file |
|---|---|---|---|
| chamber | `npc` National People's Congress | The 9th NPC article gives 2,979 deputies and 2,130 CCP deputies, but a single figure of 460 for the eight other parties plus independents together, which leaves 389 deputies unaccounted for (2,130 + 460 = 2,590). Only the China Democratic League's own count (77) was found. The 772 'others' are every non-CCP deputy except the CDL: the other seven parties, non-party deputies and the unexplained remainder. The election results table in the list of presidents gives 2,983 total seats instead of 2,979. Check an official NPC source for the total and the per-party breakdown. | data/countries/CHN/country.json |
| person | `chn.sang_guowei` Sang Guowei (b. 1941) | Birth date 1941-11-11 and death date 2023-12-07 come from Wikidata only; no birth or death date was found in the Wikipedia infobox. Confirm both. | data/countries/CHN/people.json |
| party | `chn.rcck` Revolutionary Committee of the Chinese Kuomintang (RCCK) | The Wikipedia chair table ends Wan Exiang's term on 18 March 2018 and starts Zheng Jianbang on 10 December 2022, leaving a gap; Wikidata shows Wan Exiang as chair from December 2012 with no end. Wan is recorded here until Zheng took over. Confirm who chaired the RCCK from 2018 to 2022. | data/countries/CHN/parties.json |
| party | `chn.cdp` China Democracy Party (CDP) | The article says the party's history and founding date are unclear because several groups founded it along different paths; the infobox date (28 June 1998) is used. Leaders are left empty for Pass B. Confirm the founding date and whether to list its founders. | data/countries/CHN/parties.json |

### DEU — Germany (5)

| kind | record | what to check | file |
|---|---|---|---|
| chamber | `bundesrat` Bundesrat | The source confirms 69 votes today; confirm the total was also 69 on 1 January 2000 (Hesse's fifth vote dates from 1996). | data/countries/DEU/country.json |
| person | `deu.martin_jaeger` Martin Jäger (b. 1964) | Not found on Wikidata/enwiki by the research tool; the Wikipedia BND article lists 'Martin Jäger (b. 1964)' as president since 15 September 2025. Confirm birth date and gender from the BND or dewiki page. | data/countries/DEU/people.json |
| party | `deu.wasg` Labour and Social Justice – The Electoral Alternative (WASG) | Founding/dissolution dates confirmed on Wikidata; confirm Klaus Ernst's role and dates on the WASG executive board. | data/countries/DEU/parties.json |
| party | `deu.linke` The Left (Linke) | Wikidata lists a change of co-chair on 2026-06-20 (Jan van Aken succeeded by Luigi Pantisano). Confirm with the party or Wikipedia before adding it. | data/countries/DEU/parties.json |
| party | `deu.dvu` German People's Union (DVU) | Confirm the 1987 registration as a party and the 2010-2011 merger into the NPD. | data/countries/DEU/parties.json |

### ESP — Spain (24)

| kind | record | what to check | file |
|---|---|---|---|
| person | `esp.guillerme_vazquez` Guillerme Vázquez (b. 1952) | Birth year and gender come from Wikidata only; cross-check with the Galician Wikipedia. | data/countries/ESP/people.json |
| person | `esp.xavier_vence` Xavier Vence (b. 1961) | Birth date and gender come from Wikidata only; cross-check with the Galician Wikipedia. | data/countries/ESP/people.json |
| person | `esp.david_bonvehi` David Bonvehí (b. 1979) | Birth year, gender and party presidency come from Wikidata only; cross-check with the Catalan Wikipedia. | data/countries/ESP/people.json |
| party | `esp.pdecat` Catalan European Democratic Party (PDeCAT) | Leadership 2016-2018 (founder Artur Mas as president, Marta Pascal as general coordinator) was not confirmed from a fetched source, and Bonvehí's 2018-2023 presidency comes from Wikidata only. Complete the leader history. | data/countries/ESP/parties.json |
| party | `esp.cc` Canarian Coalition (CC) | Leader history not found in the fetched sources (the article names only Fernando Clavijo as current leader of the regional government). Add the party's presidents/secretaries general from 2000. | data/countries/ESP/parties.json |
| party | `esp.ea` Basque Solidarity (EA) | Leader history from 2000 not found in the fetched article (it names Unai Ziarreta as leader around 2009 and Eva Blanco now). Add the presidents with dates. | data/countries/ESP/parties.json |
| party | `esp.uv` Valencian Union (UV) | Leader in 2000 not confirmed (the article names Chiquillo, then Joaquín Ballester Sanz until April 2006 and José Manuel Miralles from May 2006, without full dates). Add leaders as people if needed. | data/countries/ESP/parties.json |
| party | `esp.icv` Initiative for Catalonia Greens (ICV) | The article's list of presidents ends with 'Joan Saura (2000-present)' but its infobox names Joan Herrera and Dolors Camats as later national coordinators. Find when Saura stood down and add the later leaders. | data/countries/ESP/parties.json |
| party | `esp.par` Aragonese Party (PAR) | Leader history from 2000 not found in the fetched article (it names only the current president). Add the party presidents with dates. | data/countries/ESP/parties.json |
| party | `esp.upn` Navarrese People's Union (UPN) | Leader history not found with dates (the article mentions Miguel Sanz as president and Cristina Ibarrola as current president). Add the presidents from 2000. | data/countries/ESP/parties.json |
| party | `esp.pa` Andalusian Party (PA) | Leader history from 2000 not found in the fetched article. Add the secretaries general with dates. | data/countries/ESP/parties.json |
| party | `esp.cha` Aragonese Union (CHA) | Leader history from 2000 not found in the fetched article (only current president and secretary general). Add the presidents with dates. | data/countries/ESP/parties.json |
| party | `esp.geroa_bai` Yes to the Future (GBai) | The infobox names Uxue Barkos (esp.uxue_barkos) as leader but gives no dates; add her tenure. | data/countries/ESP/parties.json |
| party | `esp.fac` Asturias Forum (FAC) | Later presidents Cristina Coto (2015-2018) and Carmen Moriyón (2018-) are listed in the article but not added as people. | data/countries/ESP/parties.json |
| party | `esp.prc` Regionalist Party of Cantabria (PRC) | The infobox now names Paula Fernández Viaña as leader; find the date Revilla handed over and add her as a person. | data/countries/ESP/parties.json |
| election | `senate_2000` legislative_upper 2000-03-12 | seats should be the full Senate composition after the election; the regionally appointed senators (about 50) still need to be added by party. | data/countries/ESP/elections.json |
| election | `senate_2004` legislative_upper 2004-03-14 | seats should be the full Senate composition after the election; the regionally appointed senators (about 50) still need to be added by party. | data/countries/ESP/elections.json |
| election | `senate_2008` legislative_upper 2008-03-09 | seats should be the full Senate composition after the election; the regionally appointed senators (about 50) still need to be added by party. | data/countries/ESP/elections.json |
| election | `senate_2011` legislative_upper 2011-11-20 | seats should be the full Senate composition after the election; the regionally appointed senators (about 50) still need to be added by party. | data/countries/ESP/elections.json |
| election | `senate_2015` legislative_upper 2015-12-20 | seats should be the full Senate composition after the election; the regionally appointed senators (about 50) still need to be added by party. | data/countries/ESP/elections.json |
| election | `senate_2016` legislative_upper 2016-06-26 | seats should be the full Senate composition after the election; the regionally appointed senators (about 50) still need to be added by party. | data/countries/ESP/elections.json |
| election | `senate_2019_04` legislative_upper 2019-04-28 | seats should be the full Senate composition after the election; the regionally appointed senators (about 50) still need to be added by party. | data/countries/ESP/elections.json |
| election | `senate_2019_11` legislative_upper 2019-11-10 | seats should be the full Senate composition after the election; the regionally appointed senators (about 50) still need to be added by party. | data/countries/ESP/elections.json |
| election | `senate_2023` legislative_upper 2023-07-23 | seats should be the full Senate composition after the election; the regionally appointed senators (about 50) still need to be added by party. | data/countries/ESP/elections.json |

### FRA — France (3)

| kind | record | what to check | file |
|---|---|---|---|
| chamber | `national_assembly` National Assembly | Seats are the June 1997 election result by label. Check the group composition on 1 January 2000 (UDF/DL split of 1998, by-elections) and move DL's deputies from fra.udf to fra.dl; confirm that the 7 MDC deputies were counted as miscellaneous left in the official results. | data/countries/FRA/country.json |
| chamber | `senate` Senate | The fetched source gives the six largest groups after the 1998 renewal (315 seats); the 6 unaffiliated senators are the remainder of 321. Groups are mapped to parties approximately (Independent Republicans to DL, Centrist Union to UDF). Confirm group sizes on 1 January 2000. | data/countries/FRA/country.json |
| election | `assembly_2024` legislative 2024-06-30 | Bloc totals are verified, but 435 seats of the New Popular Front, Ensemble, LR and minor labels are not split by party. Split them using the group composition at the opening of the 17th legislature (18 July 2024): LFI, PS, Ecologists, GDR/PCF, Renaissance, MoDem, Horizons, LR (Republican Right). | data/countries/FRA/elections.json |

### GBR — United Kingdom (4)

| kind | record | what to check | file |
|---|---|---|---|
| chamber | `house_of_lords` House of Lords | 669 is the membership in March 2000 (House of Lords Annual Report 1999-2000, quoted on Wikipedia); the exact figure on 1 January 2000 was not found. The party/group breakdown (Conservative, Labour, Liberal Democrat, Crossbench, bishops, others) for early 2000 could not be fetched (House of Commons Library Research Paper 00/61 was unreachable), so all seats are recorded as 'appointed'. Replace with the group breakdown from that paper. | data/countries/GBR/country.json |
| party | `gbr.green` Green Party of England and Wales (Green) | Principal-speaker terms are seasonal years from a table with rowspans; confirm them. The end of the Bartley/Berry co-leadership in 2021 is unclear in the source (Bartley resigned and Berry was acting leader until 1 October 2021?): confirm the exact dates. | data/countries/GBR/parties.json |
| party | `gbr.respect` Respect Party (Respect) | Leader history is empty: the infobox names no leader (the 2005 results table names Linda Smith). Confirm the party's leaders or national chairs 2004-2016. | data/countries/GBR/parties.json |
| party | `gbr.your_party` Your Party (YP) | Check how many sitting MPs belong to the party and the date Corbyn became parliamentary leader (stored as the year 2025). | data/countries/GBR/parties.json |

### IRN — Iran (19)

| kind | record | what to check | file |
|---|---|---|---|
| chamber | `majlis` Islamic Consultative Assembly | Bloc seat counts for the 5th Majlis differ by source: Nohlen et al. give CCA and allies 110, Combatant Clerics and allies 80, Executives of Construction and allies 80 (used here, with the five minority seats folded into the blocs); Adelkhah gives Right 90-100, Executives of Construction 70-80, Left about 40; Kazemzadeh gives hardliners 150, Rafsanjani/Executives of Construction 15-60, Imam's Line 30, independents 30. Confirm a preferred breakdown. Also confirm whether the Majlis should count as a confidence chamber (it votes confidence in individual ministers). | data/countries/IRN/country.json |
| person | `irn.akbar_hashemi_rafsanjani` Akbar Hashemi Rafsanjani (b. 1934) | Party affiliation is ambiguous: Wikidata and the Executives of Construction Party infobox (spiritual leader) link him to the ECP, while the 2005 election infobox lists him under the Combatant Clergy Association. Birth, death and offices are confirmed. | data/countries/IRN/people.json |
| person | `irn.ahmad_tavakkoli` Ahmad Tavakkoli (b. 1951) | Wikipedia marks the birth date 'citation needed'; the death date (2025-07-23) agrees between Wikipedia and Wikidata. Party (Islamic Coalition Party) is from Wikidata only. | data/countries/IRN/people.json |
| person | `irn.saeed_jalili` Saeed Jalili (b. 1965) | Wikidata links him to the Front of Islamic Revolution Stability without dates; the 2011 start is the front's founding year. He stood as an independent principlist in 2024. | data/countries/IRN/people.json |
| party | `irn.reformists` Reformists (2nd of Khordad camp) (Reformists) | This is a political camp, not a registered party. 'founded' is the date of the 1997 presidential election that began the 2nd of Khordad movement; its coordinating body, the Council for Coordinating the Reforms Front, was founded on 1999-11-13. Confirm which date the project prefers. | data/countries/IRN/parties.json |
| party | `irn.principlists` Principlists (conservative camp) (Principlists) | This is a political camp, not a party, and sources give it no founding date. 'founded' is set to 1988-03-16, when the Association of Combatant Clerics split from the Combatant Clergy Association and the left/right camps took organisational form. Confirm or replace this date. | data/countries/IRN/parties.json |
| party | `irn.acc` Association of Combatant Clerics (ACC) | Sources say Karroubi was a founding member and former secretary-general and left the ACC in 2005; the start of his secretary-generalship is not sourced (1988 is the founding year). After his resignation the post was vacant until Mousavi Khoeiniha was elected in late August 2005. Khatami chairs the Central Council (dates not sourced). | data/countries/IRN/parties.json |
| party | `irn.iipf` Islamic Iran Participation Front (IIPF) | Mohammad-Reza Khatami led the front as secretary-general until Mohsen Mirdamadi was elected at its 9th congress; neither the end of Khatami's term nor Mirdamadi's start is sourced, so Mirdamadi is not listed. Wikipedia gives the ban as 2010-04-19; Wikidata gives dissolution as 2010-09-27. | data/countries/IRN/parties.json |
| party | `irn.mdp` Moderation and Development Party (MDP) | The source gives the founding month only (November 1999), stored as the year. Rouhani is named as leader, with membership from 1999 in Wikidata; the start of his leadership is not dated in the source. Mohammad Bagher Nobakht is named as secretary-general (dates not sourced). | data/countries/IRN/parties.json |
| party | `irn.fmi` Freedom Movement of Iran (FMI) | Wikipedia says the group is outlawed but continues to exist; the date it was formally banned is not sourced, so status_2000 is 'extra_parliamentary' rather than 'banned'. Yazdi's successor (Mohammad Tavasoli, current secretary-general) has no sourced start date and is not listed. | data/countries/IRN/parties.json |
| party | `irn.abadgaran` Alliance of Builders of Islamic Iran (Abadgaran) | The infobox names Ahmadinejad as head of the election campaign in 2003 and Hossein Fadaei in 2004; Fadaei was not researched and is not listed, and the alliance has no formal leader series. Dissolution date not sourced. | data/countries/IRN/parties.json |
| party | `irn.pjp` Progress and Justice Population of Islamic Iran (PJP) | Leader history is empty: the secretary-general (Morteza Kamel Navvab) and spiritual leader (Ghalibaf) have no sourced dates. | data/countries/IRN/parties.json |
| party | `irn.rfi` Resistance Front of Islamic Iran (RFI) | Rezaee is named as spiritual leader; that he held the role from the 2011 founding is assumed. The secretary-general (Yadollah Habibi) has no sourced dates. | data/countries/IRN/parties.json |
| party | `irn.firs` Front of Islamic Revolution Stability (Stability Front) | Leader history is empty: the infobox names Sadegh Mahsouli as secretary-general and Mahdi Mirbaqiri as spiritual leader, without dates. Neither was researched. | data/countries/IRN/parties.json |
| party | `irn.ccirf` Coalition Council of Islamic Revolution Forces (CCIRF (SHANA)) | Haddad-Adel is named as leader; that he led from the 2019 founding is assumed. Confirm the start of his leadership. | data/countries/IRN/parties.json |
| election | `assembly_of_experts_2016` legislative 2016-02-26 | List endorsements overlap, so seat totals by camp could not be derived and the winner is omitted. Find a source giving a reformist/principlist/independent split of the 88 members. | data/countries/IRN/elections.json |
| election | `majlis_2020` legislative 2020-02-21 | The source counts only seats decided after the first round (279 of 290); the 11 runoff seats of 11 September 2020 are not allocated to camps. It is also unclear whether the five minority seats are inside the 'independents' figure. | data/countries/IRN/elections.json |
| election | `majlis_2024` legislative 2024-03-01 | Check the camp assignment of the Voice of the Nation list (47 seats), which the infobox places under the reformists although its leader is usually described as an independent conservative, and whether the People's Alliance of Islamic Revolution should map to the Stability Front. | data/countries/IRN/elections.json |
| election | `supreme_leader_2026` indirect_presidential 2026-03-08 | Vote totals were not published: the infobox gives the winner's tally only as at least 59, and lists Hassan Rouhani and Hassan Khomeini as other names considered, with unknown votes. Confirm the date and any published count. | data/countries/IRN/elections.json |

### JPN — Japan (12)

| kind | record | what to check | file |
|---|---|---|---|
| chamber | `house_of_representatives` House of Representatives | Seat counts are from the June 2000 dissolution, not 1 January 2000. Confirm the composition on 1 January 2000, in particular the Liberal Party total before the April 2000 split and the 10 unitemised seats (independents or vacancies). | data/countries/JPN/country.json |
| chamber | `house_of_councillors` House of Councillors | Composition after the July 1998 election, not on 1 January 2000; party switching in 1998-99 (for example the November 1998 formation of New Komeito) is not reflected. | data/countries/JPN/country.json |
| person | `jpn.yuriko_koike` Yuriko Koike (b. 1952) | Her party on 1 January 2000 is not recorded: Wikidata lists New Frontier Party (to 1997) and LDP (from 2003) only. Check her Liberal / Conservative Party membership in 2000. | data/countries/JPN/people.json |
| person | `jpn.shunichi_mizuoka` Shun'ichi Mizuoka (b. 1956) | Wikipedia lists him as interim CDP leader in 2026 without a start date; confirm when he took over from Noda. | data/countries/JPN/people.json |
| party | `jpn.sakigake` New Party Sakigake (NPS) | Takemura is listed as leader in 2000; check when he stopped leading the party before its 2004 dissolution. | data/countries/JPN/parties.json |
| party | `jpn.conservative_2000` Conservative Party / New Conservative Party (NCP) | Check when Chikage Ogi's leadership ended and the exact date of the 2003 merger into the LDP. | data/countries/JPN/parties.json |
| party | `jpn.pnp` People's New Party (PNP) | Leadership years come from election infoboxes (Watanuki in 2005 and 2007, Kamei in 2010); confirm the exact handover dates. | data/countries/JPN/parties.json |
| party | `jpn.tomorrow` Tomorrow Party of Japan (TPJ) | Check when Kada's leadership ended (the Wikipedia infobox lists Tomoko Abe as its final president). | data/countries/JPN/parties.json |
| party | `jpn.plp` People's Life Party / Liberal Party (2016) (PLP) | Ozawa is the party's president per the infobox; confirm he led it continuously from December 2012 (co-leadership arrangements in 2014-2016 are not modelled). | data/countries/JPN/parties.json |
| party | `jpn.cdp` Constitutional Democratic Party of Japan (CDP) | Post-2026 status is unsettled in the sources: Wikipedia lists Shunichi Mizuoka as interim leader (no start date) and the Democratic Reform Party (founded 17 September 2026) as successor. Confirm when Noda's leadership ended and whether the CDP still exists as a separate party. | data/countries/JPN/parties.json |
| party | `jpn.reiwa` Reiwa Shinsengumi (Reiwa) | The party's Wikipedia infobox (fetched 2026-10-14) shows the name 'Party of Life' (いのちの党) with leader Joji Yamamoto, while Tarō Yamamoto's article still lists him as leader. Confirm the party's current name and leader. | data/countries/JPN/parties.json |
| party | `jpn.sanseito` Sanseitō (DIY) | Confirm the date Kamiya became party leader (he led it at the 2025 election; Matsuda was leader in 2022). | data/countries/JPN/parties.json |

### NLD — Netherlands (3)

| kind | record | what to check | file |
|---|---|---|---|
| party | `nld.50plus` 50PLUS (50+) | The leadership list ends with Martin van Rooijen from 17 June 2021 while the infobox names Jan Struijs as leader; add the handover date to Struijs. | data/countries/NLD/parties.json |
| party | `nld.fvd` Forum for Democracy (FvD) | Lidewij de Vos's infobox ends her term as leader in the House on 6 August 2026; check who leads the party and its House group after that date. | data/countries/NLD/parties.json |
| party | `nld.bij1` BIJ1 (BIJ1) | Simons's tenure as leader has no end date in the fetched sources; the infobox names Tofik Dibi as current leader. Add the handover date. | data/countries/NLD/parties.json |

### NOR — Norway (1)

| kind | record | what to check | file |
|---|---|---|---|
| party | `nor.h` Conservative Party (H) | The leadership change from Erna Solberg to Ine Eriksen Søreide is given only as the year 2026 in the party article; confirm the exact date of the 2026 party convention. | data/countries/NOR/parties.json |

### POL — Poland (8)

| kind | record | what to check | file |
|---|---|---|---|
| person | `pol.marek_borowski` Marek Borowski (b. 1946) | Confirm Borowski's SLD membership years (left to found Social Democracy of Poland in 2004) and his SdPl chairmanship dates. | data/countries/POL/people.json |
| party | `pol.mn` German Minority Electoral Committee (MN) | Kroll's end date and Galla's start date are not in the fetched sources; Galla is placed from 2011 because the 2011 Sejm election infobox names him as the committee's leader (and 2007 still names Kroll). Confirm the handover year. | data/countries/POL/parties.json |
| party | `pol.up` Labour Union (UP) | Leader history 2000-2026 not fetched; Wikidata has no chairs for this party. Add the chairs from the Polish Wikipedia article. | data/countries/POL/parties.json |
| party | `pol.samoobrona` Self-Defence of the Republic of Poland (SRP) | Lepper is recorded as leader until his death on 5 August 2011; confirm whether he remained chairman until then and who succeeded him. | data/countries/POL/parties.json |
| party | `pol.lpr` League of Polish Families (LPR) | Leaders before Giertych (2001-2005) and his start date are not confirmed: Wikidata gives 2006-03-11 while the 2005 election infobox already names him as leader. | data/countries/POL/parties.json |
| party | `pol.sdpl` Social Democracy of Poland (SDPL) | Borowski's end date as leader and later chairs are not in the fetched sources (Wikidata lists only Wojciech Filemonowicz with no dates). | data/countries/POL/parties.json |
| party | `pol.konfederacja` Confederation Liberty and Independence (KWiN) | The current infobox names Slawomir Mentzen and Krzysztof Bosak as co-chairmen, but no start dates were found, so leader_history is empty. Add their co-chairmanship with dates. | data/countries/POL/parties.json |
| party | `pol.nowa_lewica` New Left (NL) | Wikidata lists Robert Biedron as co-chair alongside Czarzasty (no dates); the current infobox names only Czarzasty. Add Biedron's co-chair tenure with dates. | data/countries/POL/parties.json |

### RUS — Russia (3)

| kind | record | what to check | file |
|---|---|---|---|
| chamber | `federation_council` Federation Council | The source confirms 89 subjects x 2 members and ex officio membership before the 2000 reform, but not the occupancy on 1 January 2000. Check whether Chechnya's two seats were filled on that date; if not, change 'appointed' to 176 and add 'vacant': 2. | data/countries/RUS/country.json |
| election | `duma_2003` legislative 2003-12-07 | The infobox gives LDPR 11.35% while LDPR's list votes (6,944,322) against United Russia's (22,776,294 = 37.56%) imply about 11.45%; 11.45% is stored. Check the official CEC figure. | data/countries/RUS/elections.json |
| election | `duma_2026` legislative 2026-09-20 | Recent article flagged for copy-editing. Confirm the seat totals and list percentages against the final CEC protocol, and settle turnout (infobox 59.58% vs text 55.66%). | data/countries/RUS/elections.json |

### SOM — Somalia (14)

| kind | record | what to check | file |
|---|---|---|---|
| office | `som.prime_minister` Prime Minister of Somalia | Wikipedia and Wikidata disagree on the 2003-2004 changeovers: Hassan Abshir Farah's end (8 Nov vs 8 Dec 2003), Muhammad Abdi Yusuf's start and end (8 Nov 2003 - 1 Nov 2004 vs 8 Dec 2003 - 3 Nov 2004) and Ali Mohammed Ghedi's start (1 Nov vs 23 Dec 2004). Check them against a primary source. Also confirm the date the 1990s vacancy began. | data/countries/SOM/country.json |
| person | `som.omar_haji_mohamed` Omar Haji Mohamed (b. 1934) | Died in November 2014 (Wikipedia and Wikidata give only the month), so 'died' is not stored; add the exact death date if a source gives it. Confirm he still led the SNF on 1 January 2000. | data/countries/SOM/people.json |
| person | `som.mohammed_said_hersi_morgan` Mohammed Said Hersi Morgan (b. 1949) | Faction affiliation in 2000 is unclear: the Wikipedia infobox gives Somali Patriotic Movement only for 2002-2004, while the Osman Ali Atto article calls him a Somali National Front leader in 1994. No party is set; confirm which faction he led on 1 January 2000. | data/countries/SOM/people.json |
| person | `som.abdiwahid_gonjeh` Abdiwahid Elmi Gonjeh (b. 1950) | Birth year conflict: Wikidata gives about 1950, the Wikipedia list of prime ministers gives 1962, and his own Wikipedia article has no birth date. 1950 is stored provisionally; confirm. | data/countries/SOM/people.json |
| person | `som.abdiweli_sheikh_ahmed` Abdiweli Sheikh Ahmed (b. 1959) | Birth year conflict: Wikipedia says 1959, Wikidata says October 1958. Wikipedia's 1959 is stored; confirm. | data/countries/SOM/people.json |
| person | `som.mohamed_hussein_roble` Mohamed Hussein Roble (b. 1968) | Birth year conflict: Wikipedia says February 1968, Wikidata says October 1963. Wikipedia's 1968 is stored (with available.from set to his appointment); confirm. | data/countries/SOM/people.json |
| person | `som.hamza_abdi_barre` Hamza Abdi Barre (b. 1973) | Birth year varies: Wikidata gives 1973 (and 1972 in a duplicate statement), his Wikipedia article implies 1972 or 1973, and the list of prime ministers says 1974. 1973 is stored; confirm. | data/countries/SOM/people.json |
| party | `som.usc` United Somali Congress (Ali Mahdi wing) (USC) | Founding year conflicts within the Wikipedia article: the infobox says 1987, the lead says 'Formed in 1989'. Also confirm the start year of Ali Mahdi's leadership of his wing and whether the wing used a separate name (e.g. Somali Salvation Alliance) on 1 January 2000. | data/countries/SOM/parties.json |
| party | `som.ssdf` Somali Salvation Democratic Front (SSDF) | The infobox lists Abdullahi Yusuf Ahmed and Mohamed Abshir Muse as leaders 1991-1998 but no leader after 1998; on 1 January 2000 Abdullahi Yusuf was President of Puntland. Confirm who led the SSDF in 2000. | data/countries/SOM/parties.json |
| party | `som.snf` Somali National Front (SNF) | The infobox also lists Mohammed Hashi Gani as a leader without dates; confirm who led the SNF on 1 January 2000. | data/countries/SOM/parties.json |
| party | `som.icu` Islamic Courts Union (ICU) | The Wikipedia infobox gives foundation 2000 and dissolution '2007-2009', and the text says eleven courts formed the Islamic Courts Council 'during 2000'. Status 'active' on 1 January 2000 reflects the courts' cooperation from April 1999; confirm the founding date and whether the ICU should instead appear as not yet founded. | data/countries/SOM/parties.json |
| party | `som.tayo` Tayo Political Party (TPP) | Wikipedia names Farmaajo as founder and Maryam Qasim as chairperson but gives no dates for either; confirm the leadership timeline. | data/countries/SOM/parties.json |
| election | `president_2004` indirect_presidential 2004-10-10 | The source does not label the 189-79 result as the third round, although the text says he won after the second and third rounds; confirm the round number and the first- and second-round tallies. | data/countries/SOM/elections.json |
| election | `president_2009` indirect_presidential 2009-01-30 | The article text says three rounds, but the results template shows two columns (first round and run-off). Confirm round numbering. Add Maslah Mohammed Siad Barre once his birth year is sourced. | data/countries/SOM/elections.json |

### SWE — Sweden (2)

| kind | record | what to check | file |
|---|---|---|---|
| party | `swe.fp` Liberals (Liberal People's Party until 2015) (L) | Confirm the exact date of the rename from Folkpartiet liberalerna to Liberalerna (2015); the research sources only show the change of name between the 2014 and 2018 elections. | data/countries/SWE/parties.json |
| election | `riksdag_2026` legislative 2026-09-13 | Recent election: results were still described as subject to formal certification by the Election Authority. Re-check final vote counts and the outcome of government formation. | data/countries/SWE/elections.json |

### TUR — Turkey (4)

| kind | record | what to check | file |
|---|---|---|---|
| party | `tur.fp` Virtue Party (FP) | Kutan's leadership start is taken as 1998 from his Wikidata party membership; check the date he became chairman. | data/countries/TUR/parties.json |
| party | `tur.hadep` People's Democracy Party (HADEP) | Chair on 1 January 2000 is unclear: the infobox lists Ahmet Turan Demir 1999-2000 and Murat Bozlak again 2000-2003, while the text says Demir served September 1998 to November 1999. Bozlak's return is entered with the year 2000 only; Demir has no person record. | data/countries/TUR/parties.json |
| party | `tur.saadet` Felicity Party (SAADET) | Leaders before 2016 are missing: Recai Kutan (from 2001), Numan Kurtulmus, Necmettin Erbakan (from 2010-10-18 per Wikidata) and Mustafa Kamalak (2011-2016, years only). Add them with dates from a leader list. | data/countries/TUR/parties.json |
| party | `tur.hdp` Peoples' Democratic Party (HDP) | Co-chairs omitted for lack of person records: Yavuz Onen and Fatma Gok (2012-2013), Sebahat Tuncel and Ertugrul Kurkcu (2013-2014), Serpil Kemalbay (2017-2018), Sultan Ozcan and Cahit Kirkazak (from 2023-08-27). Wikidata also splits Demirtas's tenure (to 2017-03-09, again from 2017-05-20). | data/countries/TUR/parties.json |

### USA — United States (2)

| kind | record | what to check | file |
|---|---|---|---|
| party | `usa.green` Green Party of the United States (GPUS) | Founding date conflicts: Wikipedia says formally formed on 30 July 2001, Wikidata gives April 2001. Check which date marks the FEC recognition/rename from the ASGP. | data/countries/USA/parties.json |
| party | `usa.constitution` Constitution Party (CP) | Founding year conflicts: Wikipedia infobox gives 1990, Wikidata gives 1991. Confirm the founding year. | data/countries/USA/parties.json |
