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

## Needs review: 396 of 5125 records

Countries with politics data: 57 / 212.

Countries with no data yet (155): SMR, VAT, LVA, LTU, ARM, AZE, KAZ, KGZ, TJK, TKM, UZB, ABK, SOS, NKR, ICH, CAN, ATG, ARG, BHS, BRB, BLZ, BOL, BRA, CHL, COL, CRI, CUB, DMA, DOM, ECU, SLV, GRD, GTM, GUY, HTI, HND, JAM, MEX, NIC, PAN, PRY, PER, KNA, LCA, VCT, SUR, TTO, URY, VEN, FAR, DZA, BHR, EGY, IRQ, JOR, KWT, LBN, LBY, MRT, MAR, OMN, QAT, SAU, SYR, TUN, ARE, YEM, ESH, KUR, AGO, BEN, BWA, BFA, BDI, CPV, CMR, CAF, TCD, COM, COD, COG, CIV, DJI, GNQ, ERI, SWZ, ETH, GAB, GMB, GHA, GIN, GNB, KEN, LSO, LBR, MDG, MWI, MLI, MUS, MOZ, NAM, NER, NGA, RWA, STP, SEN, SYC, SLE, ZAF, SDN, TZA, TGO, UGA, ZMB, ZWE, SSD, SML, UNI, RCD, MLC, AFG, AFN, BGD, BTN, IND, MDV, NPL, PAK, LKA, TEL, BRN, KHM, IDN, LAO, MYS, MMR, PHL, SGP, THA, VNM, TLS, AUS, NZL, FJI, PNG, SLB, VUT, WSM, TON, KIR, TUV, NRU, FSM, MHL, PLW

### ALB — Albania (4)

| kind | record | what to check | file |
|---|---|---|---|
| party | `alb.pd` Democratic Party of Albania (PD) | Check when Sali Berisha resumed the chairmanship after 1997 (1997 assumed) and the date the 2022 leadership dispute was settled. | data/countries/ALB/parties.json |
| party | `alb.pbdnj` Unity for Human Rights Party (PBDNJ) | Check the year Vangjel Dule became party leader (2005 assumed). | data/countries/ALB/parties.json |
| party | `alb.pa` Democratic Alliance Party (PAD) | Check the founding year (1992 assumed), the ideology (centrist liberal assumed) and the leader's dates. | data/countries/ALB/parties.json |
| party | `alb.pr` Republican Party of Albania (PR) | Check the year Fatmir Mediu became party leader (2005 assumed). | data/countries/ALB/parties.json |

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

### AUT — Austria (3)

| kind | record | what to check | file |
|---|---|---|---|
| chamber | `bundesrat` Federal Council | The source gives 64 members from 1993 and 62 in 2002, so 64 on 1 January 2000 is inferred; confirm, and add the party breakdown (XXI. GP member list) if the chamber should carry party seats. | data/countries/AUT/country.json |
| party | `aut.greens` The Greens – The Green Alternative (Greens) | Founding date is a placeholder for '1986' (no day given; Wikidata says 1987-02-13). The article timeline shows Felipe from 2015 overlapping Glawischnig; confirm Felipe's 2017 tenure. | data/countries/AUT/parties.json |
| party | `aut.lif` Liberal Forum (LIF) | Check when Heide Schmidt stepped down as LIF leader. | data/countries/AUT/parties.json |

### BEL — Belgium (2)

| kind | record | what to check | file |
|---|---|---|---|
| party | `bel.groen` Green (Groen) | Add Aimen Horch (Groen chair since 21 March 2026) as a person once a birth year is documented, and append him to leader_history. | data/countries/BEL/parties.json |
| party | `bel.ecolo` Ecolo (Ecolo) | Leader history before July 2024 is not recorded: no fetched source gives dated terms for Ecolo's federal secretaries/co-presidents from 1999 to 2024. Also confirm the current pair (French Wikipedia: Leroy and Vanden Burre since 15 March 2026; English infobox: Vanden Burre and Cogolati). | data/countries/BEL/parties.json |

### BGR — Bulgaria (9)

| kind | record | what to check | file |
|---|---|---|---|
| party | `bgr.bbb` Bulgarian Business Bloc (BBB) | Check the BBB's ideology (recorded as right_populist) and whether Ganchev led it from its founding. | data/countries/BGR/parties.json |
| party | `bgr.ndsv` National Movement for Stability and Progress (National Movement Simeon II until 2007) (NDSV) | Add the date Simeon Sakskoburggotski stopped leading the NDSV (recorded as open-ended). | data/countries/BGR/parties.json |
| party | `bgr.dsb` Democrats for a Strong Bulgaria (DSB) | Leader dates come from Wikidata only; confirm the July 2026 return of Radan Kanev against a Wikipedia or official source. | data/countries/BGR/parties.json |
| party | `bgr.rzs` Order, Law and Justice (RZS) | Check RZS's ideology (recorded as national_conservative), the start of Yane Yanev's leadership and whether/when the party dissolved. | data/countries/BGR/parties.json |
| party | `bgr.abv` Alternative for Bulgarian Revival (ABV) | Parvanov's leadership is open-ended because the end date was not found; Wikidata lists Rumen Petkov as chairman from 19 May 2018. | data/countries/BGR/parties.json |
| party | `bgr.ismv` Stand Up.BG! We are coming! (ISMV) | Check ISMV's ideology (recorded as left_populist). | data/countries/BGR/parties.json |
| party | `bgr.velichie` Velichie (Greatness) (Velichie) | Check Velichie's ideology (recorded as right_populist) and when Ivelin Mihaylov became its leader. | data/countries/BGR/parties.json |
| party | `bgr.mech` Morality, Unity, Honour (MECh) | Check MECh's ideology (recorded as right_populist). | data/countries/BGR/parties.json |
| party | `bgr.aps` Alliance for Rights and Freedoms (APS) | Sources disagree on APS's leader (Chakarov in the election infobox, Hayri Sadakov in Wikidata). | data/countries/BGR/parties.json |

### BIH — Bosnia and Herzegovina (18)

| kind | record | what to check | file |
|---|---|---|---|
| chamber | `house_of_peoples` House of Peoples | Party composition of the House of Peoples on 1 January 2000 not researched; check and replace the 'appointed' placeholder. | data/countries/BIH/country.json |
| office | `bih.high_representative` High Representative for Bosnia and Herzegovina | The July 2026 change (Schmidt's term ending on 1 July 2026 and Louis Crishock acting) comes from a Wikipedia article on a recent event; confirm with the OHR and check whether a permanent successor was appointed after July 2026. | data/countries/BIH/country.json |
| person | `bih.svetozar_mihajlovic` Svetozar Mihajlović (b. 1949) | Wikipedia and Wikidata give only the birth year (1949); party (Serb National Alliance) taken from his 2002 candidacy. | data/countries/BIH/people.json |
| person | `bih.spasoje_tusevljak` Spasoje Tuševljak (b. 1952) | Wikidata gives only the birth year (1952); party affiliation not recorded (the timeline colours him SDS). | data/countries/BIH/people.json |
| person | `bih.branko_dokic` Branko Dokić (b. 1949) | No English Wikipedia article; Wikidata gives only a birth year and gender, not cross-checked. | data/countries/BIH/people.json |
| person | `bih.bakir_hadziomerovic` Bakir Hadžiomerović (b. 1972) | No English Wikipedia article; Wikidata gives only a birth year and gender, not cross-checked. | data/countries/BIH/people.json |
| person | `bih.mirsad_hadzikadic` Mirsad Hadžikadić (b. 1955) | Wikidata records his gender as undisclosed; the Wikipedia article refers to him as "he". Check before relying on the gender field. | data/countries/BIH/people.json |
| person | `bih.vojin_mijatovic` Vojin Mijatović (b. 1979) | Wikidata gives only the birth year (1979); check the Wikipedia article for a full date. | data/countries/BIH/people.json |
| person | `bih.zdenko_lucic` Zdenko Lučić (b. 1967) | Wikidata gives only the birth year (1967); stood as an independent in 2026. | data/countries/BIH/people.json |
| person | `bih.dragan_kalinic` Dragan Kalinić (b. 1948) | No English Wikipedia article; birth date and gender from Wikidata only. Listed as SDS leader at the 1998 and 2002 elections. | data/countries/BIH/people.json |
| person | `bih.drasko_stanivukovic` Draško Stanivuković (b. 1993) | Wikidata gives only the birth year (1993). PDP president; led the Safe Srpska Movement (PSS) list in 2026. | data/countries/BIH/people.json |
| party | `bih.sds` Serb Democratic Party (SDS) | Leader dates are only the election years at which each was listed as leader; check the party's list of presidents. | data/countries/BIH/parties.json |
| party | `bih.hdz_bih` Croatian Democratic Union of Bosnia and Herzegovina (HDZ BiH) | Check when Dragan Čović became HDZ BiH president (2005 assumed). | data/countries/BIH/parties.json |
| party | `bih.snsd` Alliance of Independent Social Democrats (SNSD) | Confirm that Milorad Dodik has led SNSD since its foundation in 1996. | data/countries/BIH/parties.json |
| election | `presidency_bosniak_2026` presidential 2026-10-04 | Preliminary results; replace with the CEC's certified figures. | data/countries/BIH/elections.json |
| election | `presidency_croat_2026` presidential 2026-10-04 | Preliminary results; replace with the CEC's certified figures. | data/countries/BIH/elections.json |
| election | `presidency_serb_2026` presidential 2026-10-04 | Preliminary results; replace with the CEC's certified figures. | data/countries/BIH/elections.json |
| election | `hor_2026` legislative 2026-10-04 | Preliminary results; replace with the CEC's certified figures. | data/countries/BIH/elections.json |

### BLR — Belarus (13)

| kind | record | what to check | file |
|---|---|---|---|
| chamber | `house_of_representatives` House of Representatives | The party breakdown of the 1996-2000 House (first convocation) was not found in the fetched sources, so all 110 seats are recorded as 'others'. Find the faction composition on 1 January 2000 (most deputies were non-partisan supporters of the President, with Communist and Agrarian groups). | data/countries/BLR/country.json |
| chamber | `council_of_the_republic` Council of the Republic | Confirm that the Council had 64 members (56 elected + 8 appointed) on 1 January 2000 and record its party composition; the 56 regionally elected members are entered as 'others'. | data/countries/BLR/country.json |
| person | `blr.stanislau_bahdankevich` Stanislau Bahdankevich (b. 1937) | Wikidata gives 1 January 1937 at day precision; confirm the birth date (a 1 January date can be a placeholder). | data/countries/BLR/people.json |
| party | `blr.kpb` Communist Party of Belarus (KPB) | The leader in 2000 is not recorded: Wikidata lists Ihar Karpienka (no dates) and Aliaksiej Sokal from 14 May 2017. Confirm the chairs from 1996 to 2017. | data/countries/BLR/parties.json |
| party | `blr.agrarian` Belarusian Agrarian Party (BAP) | No leader with dates was found (the infobox names Mikhail Rusy as the last leader; founder Syamyon Sharetski). Add the leader history. | data/countries/BLR/parties.json |
| party | `blr.rpts` Republican Party of Labour and Justice (RPTS) | Wikidata lists Vasily Zadnepryany and Aliaksandr Sciapanau as earlier chairs without dates; confirm who led the party in 2000. | data/countries/BLR/parties.json |
| party | `blr.ldpb` Liberal Democratic Party of Belarus (LDPB) | Wikidata lists Sergei Gaidukevich and Oleg Gaidukevich (the current infobox leader) as chairs without dates; the start (founding date) and the handover date need confirming. | data/countries/BLR/parties.json |
| party | `blr.belaya_rus` Belaya Rus (PBR) | The infobox names Oleg Romanov as current chairman, which Wikidata does not record; confirm when Davydzka's chairmanship ended. | data/countries/BLR/parties.json |
| party | `blr.bpp` Belarusian Patriotic Party (BPP) | Chairman Nikolai Ulakhovich (Wikidata, no dates; 2015 presidential candidate) and founder Anatoly Barankevich are not recorded as people; add the leader history. | data/countries/BLR/parties.json |
| party | `blr.ucp` United Civic Party (UCP) | Bahdankevich is the founder and a Wikidata chair without dates; Lebedko 2000-2018 is from Wikidata. Confirm the 2000 handover date. Later chair Mikalai Kazlou is not recorded as a person. | data/countries/BLR/parties.json |
| party | `blr.bpf` BPF Party (PBNF) | The leader on 1 January 2000 is not recorded (founder Zianon Pazniak left to form the Conservative Christian Party - BPF in 1999 per Wikidata); add the chairs before 2017. | data/countries/BLR/parties.json |
| party | `blr.pkb` Belarusian Left Party "A Just World" (Party of Communists of Belarus) (PKB) | Kalyakin is the infobox leader without dates; the start shown is the 2009 renaming. Confirm when he became leader (he headed the party's faction in 1996). | data/countries/BLR/parties.json |
| party | `blr.bsdp_h` Belarusian Social Democratic Party (Hramada) (BSDP (H)) | No leader history with dates was found; the party's presidential candidates were Alyaksandr Kazulin (2006) and Mikola Statkevich (2010), and Tatsiana Karatkevich (2015) was a member. Add chairs. | data/countries/BLR/parties.json |

### CHE — Switzerland (8)

| kind | record | what to check | file |
|---|---|---|---|
| person | `che.philipp_matthias_bregy` Philipp Matthias Bregy (b. 1978) | Confirm the date Bregy became president of The Centre, and his CVP membership years. | data/countries/CHE/people.json |
| party | `che.fdp` FDP.The Liberals (FDP) | Add Franz Steinegger (FDP president 1989-2001) and Christiane Langenberger (2002-2004) once their birth data is sourced. | data/countries/CHE/parties.json |
| party | `che.cvp` Christian Democratic People's Party of Switzerland (CVP) | Add Adalbert Durrer (CVP president 1997-2001) and Philipp Stähelin (2001-2004) once their birth data is sourced. | data/countries/CHE/parties.json |
| party | `che.the_centre` The Centre (Mitte) | Gerhard Pfister's end year and Philipp Matthias Bregy's start year (2025) are not given in the fetched sources; the infobox names Bregy as the current president. | data/countries/CHE/parties.json |
| party | `che.greens` Green Party of Switzerland (GPS) | Add Ruedi Baumann (president 1997-2001) and Patrice Mugny (co-president 2001-2004) once their birth data is sourced. | data/countries/CHE/parties.json |
| election | `referendum_2010_03_01_1` referendum 2010-03-01 | The 2010 article lists the March topics (pension funds, animal protection, a constitutional amendment) without labelling the table rows or giving the day; confirm which question this row is (by its double majority it is a constitutional vote, likely the constitutional amendment) and the date. | data/countries/CHE/elections.json |
| election | `referendum_2010_03_01_2` referendum 2010-03-01 | Row label inferred from the article's topic list (rejected with a cantonal vote, consistent with the animal-protection initiative); confirm the question and the date. | data/countries/CHE/elections.json |
| election | `referendum_2010_03_01_3` referendum 2010-03-01 | Row label inferred from the article's topic list (no cantonal vote, consistent with a law); confirm the question and the date. | data/countries/CHE/elections.json |

### CHN — China (4)

| kind | record | what to check | file |
|---|---|---|---|
| chamber | `npc` National People's Congress | The 9th NPC article gives 2,979 deputies and 2,130 CCP deputies, but a single figure of 460 for the eight other parties plus independents together, which leaves 389 deputies unaccounted for (2,130 + 460 = 2,590). Only the China Democratic League's own count (77) was found. The 772 'others' are every non-CCP deputy except the CDL: the other seven parties, non-party deputies and the unexplained remainder. The election results table in the list of presidents gives 2,983 total seats instead of 2,979. Check an official NPC source for the total and the per-party breakdown. | data/countries/CHN/country.json |
| person | `chn.sang_guowei` Sang Guowei (b. 1941) | Birth date 1941-11-11 and death date 2023-12-07 come from Wikidata only; no birth or death date was found in the Wikipedia infobox. Confirm both. | data/countries/CHN/people.json |
| party | `chn.rcck` Revolutionary Committee of the Chinese Kuomintang (RCCK) | The Wikipedia chair table ends Wan Exiang's term on 18 March 2018 and starts Zheng Jianbang on 10 December 2022, leaving a gap; Wikidata shows Wan Exiang as chair from December 2012 with no end. Wan is recorded here until Zheng took over. Confirm who chaired the RCCK from 2018 to 2022. | data/countries/CHN/parties.json |
| party | `chn.cdp` China Democracy Party (CDP) | The article says the party's history and founding date are unclear because several groups founded it along different paths; the infobox date (28 June 1998) is used. Leaders are left empty for Pass B. Confirm the founding date and whether to list its founders. | data/countries/CHN/parties.json |

### CYP — Cyprus (7)

| kind | record | what to check | file |
|---|---|---|---|
| party | `cyp.ecologists` Movement of Ecologists – Citizens' Cooperation (KOSP) | Leadership dates are taken from election infoboxes only; check when Perdikes, Panayiotou, Theopemptou and Papadouris led the party. | data/countries/CYP/parties.json |
| party | `cyp.adik` Fighting Democratic Movement (ADIK) | Check ADIK's ideology (recorded as national_conservative); leader not recorded. | data/countries/CYP/parties.json |
| party | `cyp.evroko` European Party (EVROKO) | Check EVROKO's ideology (recorded as national_conservative) and the end of Syllouris's leadership. | data/countries/CYP/parties.json |
| party | `cyp.solidarity` Solidarity Movement (Solidarity) | Check Solidarity's ideology (recorded as national_conservative). | data/countries/CYP/parties.json |
| party | `cyp.elam` National Popular Front (ELAM) | Check when Christos Christou became ELAM leader (recorded from 2008). | data/countries/CYP/parties.json |
| party | `cyp.alma` ALMA – Citizens for Cyprus (ALMA) | Check ALMA's ideology (recorded as centrist_liberal). | data/countries/CYP/parties.json |
| party | `cyp.direct_democracy` Direct Democracy Cyprus (Direct Democracy) | Check the party's ideology (recorded as big_tent) and the start of Panayiotou's leadership. | data/countries/CYP/parties.json |

### CZE — Czech Republic (7)

| kind | record | what to check | file |
|---|---|---|---|
| party | `cze.spr_rsc` Rally for the Republic – Republican Party of Czechoslovakia (SPR-RSČ) | Leadership after 2000 and founding/dissolution years rest on Wikidata only; check the party article. | data/countries/CZE/parties.json |
| party | `cze.sz` Green Party (SZ) | Leader history is from Wikidata only; cross-check against the party's Wikipedia article. | data/countries/CZE/parties.json |
| party | `cze.auto` Motorists for Themselves (AUTO) | The year Macinka became leader was not in the fetched sources; 2025 (the year he is first documented as leader) is a placeholder. Check the party article. | data/countries/CZE/parties.json |
| election | `senate_2002` legislative_upper 2002-10-25 | Post-election Senate composition (seats) is derived from the last three elections' seats won, not taken from a source; check the Senate composition after November 2002 (party switches and by-elections are not reflected). | data/countries/CZE/elections.json |
| election | `senate_2004` legislative_upper 2004-11-05 | Post-election Senate composition (seats) is derived from seats won in 2000-2004, not taken from a source; check the composition after November 2004. | data/countries/CZE/elections.json |
| election | `senate_2012` legislative_upper 2012-10-12 | Post-election Senate composition (seats) is derived from seats won in 2008-2012, not taken from a source; check the composition after October 2012. | data/countries/CZE/elections.json |
| election | `senate_2014` legislative_upper 2014-10-10 | Post-election Senate composition (seats) is derived from seats won in 2010-2014, not taken from a source; check the composition after October 2014. | data/countries/CZE/elections.json |

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

### EST — Estonia (7)

| kind | record | what to check | file |
|---|---|---|---|
| party | `est.koonderakond` Estonian Coalition Party (KMÜ) | Find the party chairman on 1 January 2000 (Mart Siimann or Tiit Vähi) with dates. | data/countries/EST/parties.json |
| party | `est.rahvaliit` People's Union of Estonia (ERL) | Check when Reiljan's chairmanship ended and Tuiksoo's began (Tuiksoo is listed as leader for the March 2007 election), and the leaders after her. | data/countries/EST/parties.json |
| party | `est.eurp` Estonian United People's Party (EÜRP) | Find the party chairman on 1 January 2000. | data/countries/EST/parties.json |
| party | `est.res_publica` Res Publica Party (RP) | Check the year Veskimägi succeeded Parts as chairman (the article says only that Veskimägi led the party at the 2006 merger). | data/countries/EST/parties.json |
| party | `est.greens` Estonian Greens (EER) | Leader history is incomplete: confirm Lotman's dates as leader and his successors. | data/countries/EST/parties.json |
| party | `est.ekre` Conservative People's Party of Estonia (EKRE) | Confirm the 2012-2013 chairman and the exact date Martin Helme took over in 2020. | data/countries/EST/parties.json |
| party | `est.free_party` Estonian Free Party (EVA) | Add Herkel's end date and later chairmen. | data/countries/EST/parties.json |

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

### GEO — Georgia (17)

| kind | record | what to check | file |
|---|---|---|---|
| office | `geo.prime_minister` Prime Minister of Georgia | Check whether outgoing Prime Ministers stayed on as caretakers in the short gaps of November 2003, June 2018, September 2019 and January-February 2024 (recorded as vacancies because the sources list no holder). | data/countries/GEO/country.json |
| person | `geo.vazha_lortkipanidze` Vazha Lortkipanidze (b. 1949) | Party taken from the colour coding of the Wikipedia list of heads of government (Union of Citizens); confirm. | data/countries/GEO/people.json |
| person | `geo.giorgi_arsenishvili` Giorgi Arsenishvili (b. 1942) | Party membership not confirmed by a fetched source (assumed from the government he served); confirm. | data/countries/GEO/people.json |
| person | `geo.lado_gurgenidze` Lado Gurgenidze (b. 1970) | Party affiliation not checked. | data/countries/GEO/people.json |
| person | `geo.grigol_mgaloblishvili` Grigol Mgaloblishvili (b. 1973) | Party affiliation not checked. | data/countries/GEO/people.json |
| person | `geo.nika_gilauri` Nika Gilauri (b. 1975) | Party affiliation not checked. | data/countries/GEO/people.json |
| person | `geo.jumber_patiashvili` Jumber Patiashvili (b. 1940) | Birth year uncertain (Wikidata gives 1939 and 1940); 1940 recorded. | data/countries/GEO/people.json |
| person | `geo.david_gamkrelidze` David Gamkrelidze (b. 1964) | Birth year uncertain: Wikidata holds 2 April 1964 and 2 April 1965. | data/countries/GEO/people.json |
| person | `geo.zurab_japaridze` Zurab Japaridze (b. 1976) | Wikidata gives 1 January 1976, a common placeholder, so only the year is recorded; confirm. | data/countries/GEO/people.json |
| party | `geo.industrialists` Industry Will Save Georgia (Industrialists) | Gogi Topadze is named as leader in the infobox; Wikidata records his death on 16 February 2025. Check when his leadership ended and who succeeded him. | data/countries/GEO/parties.json |
| party | `geo.labour` Georgian Labour Party (Labour) | Check that Natelashvili has led the party continuously since its founding in 1995. | data/countries/GEO/parties.json |
| party | `geo.new_rights` New Rights Party (New Rights) | Gamkrelidze is shown as leader in the 2003 and 2004 election infoboxes; check the start and end of his leadership and when Katsitadze took over. | data/countries/GEO/parties.json |
| party | `geo.republican` Republican Party of Georgia (Republicans) | Add the chairs since 2000 with dates (Usupashvili and successors), and confirm the party ran in the National Democratic Alliance list in 1999. | data/countries/GEO/parties.json |
| party | `geo.patriots` Alliance of Patriots of Georgia (APG) | The party has joint leaders; check Inashvili's formal title and dates, and Tarkhan-Mouravi's chairmanship. | data/countries/GEO/parties.json |
| party | `geo.european_georgia` European Georgia (EG) | Add the end of Bakradze's chairmanship and the later chairs (Bokeria, Tsereteli) as person records. | data/countries/GEO/parties.json |
| party | `geo.aghmashenebeli` Strategy Aghmashenebeli (SA) | Add Giorgi Vashadze (leader) as a person with fetched dates. | data/countries/GEO/parties.json |
| party | `geo.citizens` Citizens (Citizens) | Add the leader, Aleko Elisashvili, as a person with fetched dates. | data/countries/GEO/parties.json |

### GRC — Greece (4)

| kind | record | what to check | file |
|---|---|---|---|
| party | `grc.golden_dawn` Golden Dawn (XA) | Check the start of Michaloliakos's leadership and the party's status in 2000 (recorded as extra-parliamentary). | data/countries/GRC/parties.json |
| party | `grc.spartans` Spartans (Spartans) | Check the Spartans' ideology (recorded as ethno_nationalist). | data/countries/GRC/parties.json |
| party | `grc.niki` Democratic Patriotic Popular Movement "Niki" (Victory) (NIKI) | Check Niki's ideology classification (christian_conservative). | data/countries/GRC/parties.json |
| party | `grc.plefsi` Course of Freedom (Plefsi) | Check Course of Freedom's ideology (recorded as left_populist). | data/countries/GRC/parties.json |

### HRV — Croatia (7)

| kind | record | what to check | file |
|---|---|---|---|
| chamber | `sabor` Chamber of Representatives (Croatian Parliament) | seats_2000 is the October 1995 result as shown in the election infobox (HDZ 75; HSS–IDS–HNS–HKDU–SBHS alliance 18, recorded under HSS; HSLS 12; SDP 10; HSP 4), with one second-round seat for IDS, the Serb People's Party (2) and Social Democratic Action (1) as others, and four minority members as independents. How the four joint-list seats were split between the infobox totals was inferred; mid-term changes up to 1 January 2000 were not checked. | data/countries/HRV/country.json |
| party | `hrv.hsls` Croatian Social Liberal Party (HSLS) | Check the year Đurđa Adlešič became HSLS president (2006 assumed) and the end dates of the Čehok and Adlešič leaderships. | data/countries/HRV/parties.json |
| party | `hrv.hsp` Croatian Party of Rights (HSP) | Check the year Anto Đapić became party leader (1993 assumed). | data/countries/HRV/parties.json |
| party | `hrv.sdss` Independent Democratic Serb Party (SDSS) | Check the year Milorad Pupovac became party president (2019 assumed between the 2016 and 2020 elections). | data/countries/HRV/parties.json |
| party | `hrv.most` The Bridge (Most) (Most) | Check the year Nikola Grmoja succeeded Božo Petrov as party president (2022 assumed). | data/countries/HRV/parties.json |
| party | `hrv.zivi_zid` Human Shield (Živi zid) (ŽZ) | Check the merger date (3 February or 3 March 2024) and the start of Sinčić's leadership. | data/countries/HRV/parties.json |
| party | `hrv.mozemo` We Can! – Political Platform (Možemo) | Check Sandra Benčić's formal party role and dates (the party uses co-presidents). | data/countries/HRV/parties.json |

### HUN — Hungary (4)

| kind | record | what to check | file |
|---|---|---|---|
| party | `hun.kdnp` Christian Democratic People's Party (KDNP) | Leaders on 1 January 2000 and until 2003 (Giczy, Varga) are missing; check the party's leader list. | data/countries/HUN/parties.json |
| party | `hun.egyutt` Together (Együtt) | Leaders (including Gordon Bajnai and Péter Juhász) and dates are not recorded; check the party article. | data/countries/HUN/parties.json |
| party | `hun.dk` Democratic Coalition (DK) | When Gyurcsány stepped down and Dobrev became leader is unknown here; Dobrev's entry is dated only to 2026, the year she resigned. Check the DK leadership history. | data/countries/HUN/parties.json |
| party | `hun.momentum` Momentum Movement (Momentum) | Fekete-Győr's term dates and later leaders are not recorded; check the party's leadership history. | data/countries/HUN/parties.json |

### IRL — Ireland (1)

| kind | record | what to check | file |
|---|---|---|---|
| person | `irl.michael_collins` Michael Collins (b. 1968) | Birth year conflict (Wikidata 1958-07-15 vs Wikipedia 1968-02-26, unsourced there); confirm from an official biography. | data/countries/IRL/people.json |

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

### ISL — Iceland (1)

| kind | record | what to check | file |
|---|---|---|---|
| election | `president_2000` presidential 2000-08-01 | Wikipedia gives no date for the 2000 election (only that it was scheduled and uncontested). Check the date on which Ólafur Ragnar Grímsson was declared elected; 1 August 2000 (start of term) is used as a placeholder. | data/countries/ISL/elections.json |

### ISR — Israel (7)

| kind | record | what to check | file |
|---|---|---|---|
| chamber | `knesset` Knesset | Seats are the 1999 election result. Check the 15th Knesset faction strengths on 1 January 2000 (e.g. the Knesset website), the 1999 threshold (1.5% recorded) and the seat formula (D'Hondt-type, Bader-Ofer, recorded as dhondt). | data/countries/ISR/country.json |
| party | `isr.centre_party` Centre Party (Merkaz) | Check who led the party after Yitzhak Mordechai left politics in 2000, and its exact dissolution date. | data/countries/ISR/parties.json |
| party | `isr.nrp` National Religious Party (NRP) | Leader years are inferred from the leaders listed in the infobox, the list leaders at the 1999 (Levy) and 2003 (Eitam) elections and Eitam's suspension as chairman in February 2005; confirm the year of each leadership change. | data/countries/ISR/parties.json |
| party | `isr.utj` United Torah Judaism (UTJ) | Leader years are the list leaders at Knesset elections (1999 Porush; 2003-2020 Litzman; 2021 Gafni; 2022 Goldknopf), not formal leadership dates. The September 2026 change to Ya'akov Asher rests on one cited report (ynet, 5 September 2026). | data/countries/ISR/parties.json |
| party | `isr.ual` United Arab List (Ra'am) (Ra'am) | Leader years are inferred from list leaders at Knesset elections (1999-2003 Dehamshe; 2006-2013 Sarsur; April 2019 onward Mansour Abbas); confirm formal leadership dates. | data/countries/ISR/parties.json |
| party | `isr.taal` Ta'al (Arab Movement for Renewal) (Ta'al) | Wikipedia dates the founding to the run-up to the 1996 election with a citation-needed tag; confirm the founding year. | data/countries/ISR/parties.json |
| party | `isr.gil` Gil (Pensioners of Israel) (Gil) | The infobox gives the founding only as '1990s'; 1996 is the first election it contested. Confirm the founding year and leadership dates. | data/countries/ISR/parties.json |

### ITA — Italy (4)

| kind | record | what to check | file |
|---|---|---|---|
| chamber | `camera` Chamber of Deputies | seats_2000 is the April 1996 election result, mapped to the parties existing in 2000 (PDS -> DS; the Populars for Prodi list -> PPI, incl. 5 UD and 2 PRI deputies; CCD-CDU split 19/11 as given in the source). The real group composition on 1 January 2000 differed substantially after mid-term splits (PdCI from PRC in 1998, UDEUR, The Democrats, SDI). Check the parliamentary group composition of the XIII legislature on that date. 'others' = The Network 3, Ladin Autonomist Union 1, Southern Action League 1, Aosta Valley 1. | data/countries/ITA/country.json |
| chamber | `senato` Senate of the Republic | The 315 elected seats are the April 1996 result mapped to 2000 parties (PDS -> DS; Progressives -> PRC; SVP-PATT -> SVP); mid-term splits before 1 January 2000 are not reflected. 'appointed' = 9 senators for life on that date (former Presidents Leone, Cossiga and Scalfaro; appointed senators Bo, Bobbio, Agnelli, Andreotti, De Martino and Taviani). 'others' = The Network, Venetian Autonomy League, Sardinian Action Party, Pannella-Sgarbi List and Aosta Valley, 1 each. Check the group composition on 1 January 2000. | data/countries/ITA/country.json |
| person | `ita.benedetto_della_vedova` Benedetto Della Vedova (b. 1962) | Birth year conflicts within the Wikipedia article: the infobox gives 3 April 1963, the lead and categories 3 April 1962. Check an official source (Senate/Chamber biography) and add birth_date. | data/countries/ITA/people.json |
| party | `ita.si` Italian Left (SI) | Confirm the founding date: Wikidata gives 7 November 2015, while Fratoianni's article dates his first term as secretary from 19 February 2017. The secretary between June 2019 and February 2021 is not recorded. | data/countries/ITA/parties.json |

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

### KOR — South Korea (15)

| kind | record | what to check | file |
|---|---|---|---|
| chamber | `national_assembly` National Assembly | seats_2000 is the last 1999 row (29 December 1999) of the Korean Wikipedia seat-change table: GNP 130, NCNP 103, ULD 55, independents 11 (total 299). The table's running totals are not fully consistent with its +/- labels; check against National Assembly records. The 3% list threshold is the current rule; confirm the threshold in force in 1996-2000. | data/countries/KOR/country.json |
| party | `kor.mdp` Millennium Democratic Party (MDP) | Leader history is incomplete: only Kim Dae-jung (party president until 2002) was found. Add the party's chairs 2000-2007 (e.g. Cho Soon-hyung, who led it into the 2004 election). | data/countries/KOR/parties.json |
| party | `kor.uri` Uri Party (Uri) | Leader history is incomplete: only Chung Dong-young (chairman at the 2004 election) is recorded, without exact dates. The party had several chairs (e.g. Shin Ki-nam, who resigned on 19 August 2004); the English Wikipedia article has no dated leader list (founding date 1 November 2003 confirmed from its infobox). | data/countries/KOR/parties.json |
| party | `kor.undp` Grand Unified Democratic New Party (UNDP) | Leader history is incomplete: earlier leaders (2007) are missing and Sohn Hak-kyu's start date is unknown. | data/countries/KOR/parties.json |
| party | `kor.uld` United Liberal Democrats (ULD) | Leader dates are years only and incomplete. The merger into the Grand National Party in 2006 is inferred from Kim Jong-pil's Wikidata party record; confirm it against the ULD article. | data/countries/KOR/parties.json |
| party | `kor.dlp` Democratic Labor Party (DLP) | Leader history is incomplete: only Kwon Young-ghil (leader at the 2004 election) is listed, with a year only. | data/countries/KOR/parties.json |
| party | `kor.upp` Unified Progressive Party (UPP) | Leader history is empty; add Lee Jung-hee and other co-leaders with dates. | data/countries/KOR/parties.json |
| party | `kor.justice` Justice Party (JP) | Leader history is incomplete: only Sim Sang-jung's 2019 election is recorded; add her end date and the party's other leaders. | data/countries/KOR/parties.json |
| party | `kor.lfp` Liberty Forward Party (LFP) | Lee Hoi-chang's end date as leader and the later leaders (e.g. Lee In-je) are missing. | data/countries/KOR/parties.json |
| party | `kor.pro_park` Pro-Park Alliance (PPA) | Suh Chung-won's end date as leader is missing (the infobox names Rho Cheol-rae as the last leader). | data/countries/KOR/parties.json |
| party | `kor.ckp` Creative Korea Party (CKP) | Moon Kook-hyun is listed as party leader from the founding date; confirm his start and end dates (the infobox names Han Myeon-hee as the last leader). | data/countries/KOR/parties.json |
| party | `kor.people_2016` People Party (2016) (PP) | Leader history is incomplete (only Ahn Cheol-soo, without an end date). | data/countries/KOR/parties.json |
| party | `kor.bareun` Bareun Party (Bareun) | Leader history is incomplete; the infobox lists Yoo Seong-min among its leaders without dates. | data/countries/KOR/parties.json |
| party | `kor.people_2020` People Party (2020) (PP) | The infobox gives no founding date; only the year 2020 is recorded. | data/countries/KOR/parties.json |
| party | `kor.reform` Reform Party (Reform) | Leader history has gaps: the leader(s) between 19 May 2024 and 27 July 2025 and after 26 August 2026 are not recorded (the article has no dated leader list). | data/countries/KOR/parties.json |

### KOS — Kosovo (14)

| kind | record | what to check | file |
|---|---|---|---|
| office | `kos.srsg` Special Representative of the UN Secretary-General for Kosovo (head of UNMIK) | Five acting or current SRSGs (Brayshaw, Sorenson, Freeman, Shin, Due) are recorded as null holders because no birth data was found; Caroline Ziadeh's end date is uncited in the source. | data/countries/KOS/country.json |
| person | `kos.soren_jessen_petersen` Søren Jessen-Petersen (b. 1945) | Wikidata gives only the birth year; check for a full date. | data/countries/KOS/people.json |
| person | `kos.steven_schook` Steven P. Schook (b. 1953) | Wikidata gives only the birth year; check for a full date. | data/countries/KOS/people.json |
| person | `kos.farid_zarif` Farid Zarif (b. 1951) | Wikidata gives only the birth year; check for a full date. | data/countries/KOS/people.json |
| person | `kos.caroline_ziadeh` Caroline Ziadeh (b. 1974) | Birth year 1974 from the Wikipedia list of SRSGs; Wikidata gives 2000, which is clearly wrong. Check. | data/countries/KOS/people.json |
| person | `kos.bedri_hamza` Bedri Hamza (b. 1963) | Wikidata gives only the birth year; check for a full date. | data/countries/KOS/people.json |
| person | `kos.enver_hoxhaj` Enver Hoxhaj (b. 1969) | Wikidata gives only the birth year; check for a full date. | data/countries/KOS/people.json |
| person | `kos.goran_rakic` Goran Rakić (b. 1971) | Wikidata gives only the birth year; check for a full date. | data/countries/KOS/people.json |
| person | `kos.ardian_gjini` Ardian Gjini (b. 1971) | Wikidata gives only the birth year; check for a full date. | data/countries/KOS/people.json |
| party | `kos.ldk` Democratic League of Kosovo (LDK) | Check LDK leaders and dates after 2006 (Sejdiu 2006, Mustafa 2010, Abdixhiku 2025 assumed; intervening leaders not recorded). | data/countries/KOS/parties.json |
| party | `kos.aak` Alliance for the Future of Kosovo (AAK) | Check when Ardian Gjini replaced Ramush Haradinaj as chairman (2026 assumed). | data/countries/KOS/parties.json |
| party | `kos.lvv` Vetëvendosje (Self-Determination Movement) (LVV) | Kurti is recorded as leader since the 2005 foundation; check whether anyone else chaired the movement in between. | data/countries/KOS/parties.json |
| party | `kos.sl` Serb List (SL) | Check the years Goran Rakić led the party (2017 assumed) and add Zlatan Elek if biographical data can be found. | data/countries/KOS/parties.json |
| election | `president_2026` indirect_presidential 2026-10-06 | Very recent event (October 2026) sourced only from Wikipedia; confirm the vote count and inauguration date with an official source. | data/countries/KOS/elections.json |

### LIE — Liechtenstein (5)

| kind | record | what to check | file |
|---|---|---|---|
| party | `lie.vu` Patriotic Union (VU) | Party presidents since 2000 are not researched (the infobox names Mario Wohlwend as current president); leader_history is empty. | data/countries/LIE/parties.json |
| party | `lie.fbp` Progressive Citizens' Party (FBP) | Party presidents since 2000 are not researched (the infobox names Alexander Batliner as current president); leader_history is empty. | data/countries/LIE/parties.json |
| party | `lie.du` The Independents (DU) | The 2013 election article shows DU contesting the February 2013 election while the infobox gives foundation in 2013; confirm whether the group formed in 2012. Quaderer's leadership dates are not sourced (recorded as lead candidate from 2013). | data/countries/LIE/parties.json |
| party | `lie.dpl` Democrats for Liechtenstein (DpL) | Rehak's start as leader is set to the founding date; confirm. | data/countries/LIE/parties.json |
| election | `referendum_2009_12_06` referendum 2009-12-06 | The article text says the 2008 law was approved by 57%, but its results template is captioned 'Overturning the 2008 environmental protection law'; confirm what a 'yes' vote meant. | data/countries/LIE/elections.json |

### LUX — Luxembourg (2)

| kind | record | what to check | file |
|---|---|---|---|
| party | `lux.adr` Alternative Democratic Reform Party (ADR) | Add Jean Schoos (ADR president 2013-2022) once a birth year is documented; the list gives Fernand Kartheiser for 2013 only and no exact handover dates. | data/countries/LUX/parties.json |
| party | `lux.greng` The Greens (Greens) | No fetched source gives a dated list of the Greens' spokespersons since 2000; add the leader history (e.g. from the party's own records). | data/countries/LUX/parties.json |

### MCO — Monaco (6)

| kind | record | what to check | file |
|---|---|---|---|
| party | `mco.und` National and Democratic Union (from 2008 Rally & Issues) (UND) | Leadership is only partly documented: Campora is recorded from his presidency of the National Council (1993-2003) and as UND list leader in 2003, but no formal party-leader list was found, and Laurent Nouvion's start as Rally & Issues leader is undated. Confirm the dissolution year (Wikipedia: 'c. 2020'). | data/countries/MCO/parties.json |
| party | `mco.unam` National Union for the Future of Monaco (UNAM) | No leader is documented in the sources fetched, and the founding year (1998) comes only from the article's category. The UNAM article dates its merger into Union Monégasque to 2013, while the Union Monégasque article gives 2003; check both. | data/countries/MCO/parties.json |
| party | `mco.um` Union for Monaco / Union Monégasque (UM) | Identity is ambiguous in the sources: check whether the 2003-2008 Union for Monaco alliance (led by Valeri) and the party Union Monégasque (led by Robillon from 2011) should be separate records. | data/countries/MCO/parties.json |
| party | `mco.hm` Horizon Monaco (HM) | Nouvion is listed as leader without dates; the 2012 start (party founding) and the absence of an end date need checking. | data/countries/MCO/parties.json |
| party | `mco.renaissance` Renaissance (Renaissance) | Leaders are not recorded: the party article names Eric Elena as leader, while the 2013 election article names Jean-Michel Rapaire as list leader. Neither gives dates. | data/countries/MCO/parties.json |
| party | `mco.primo` Priorité Monaco (Primo!) | No dated leader list exists in the sources: Valeri's leadership has no end date (he left the National Council presidency in October 2022), and Boccone-Pagès is recorded as head of the 2023 joint list, not as formal party leader. | data/countries/MCO/parties.json |

### MDA — Moldova (12)

| kind | record | what to check | file |
|---|---|---|---|
| party | `mda.pcrm` Party of Communists of the Republic of Moldova (PCRM) | Voronin (the founder) is recorded from 1998, the earliest fetched evidence; confirm his start date. The handover to Diana Caraman on 6 June 2026 is from Wikidata; the fetched Wikipedia infobox confirms Caraman as party president but gives no date. | data/countries/MDA/parties.json |
| party | `mda.cdm` Democratic Convention of Moldova (CDM) | Electoral bloc led by Mircea Snegur in 1998 (it included the Party of Rebirth and Conciliation and the Christian-Democratic People's Party). Wikidata gives 1997-1999 as its lifespan although its deputies sat until 2001; confirm when the bloc dissolved and its composition. | data/countries/MDA/parties.json |
| party | `mda.pdm` Democratic Party of Moldova (PDM) | Diacov (founder; 1998 leader of For a Democratic and Prosperous Moldova), Lupu (leader at the 2009-2014 elections) and Plahotniuc (2019) are taken from election infoboxes; confirm the chairmanship dates. The party now operates as the European Social Democratic Party (PSDE); confirm the renaming date. | data/countries/MDA/parties.json |
| party | `mda.pfd` Party of Democratic Forces (PFD) | Matei led the party at the 1998 election; confirm his tenure. | data/countries/MDA/parties.json |
| party | `mda.braghis` Braghiș Alliance (BeAB) | Formed by Prime Minister Braghiș to contest the February 2001 election; the exact founding date (possibly late 2000) is not in the fetched source, so 2001 is used. Confirm. | data/countries/MDA/parties.json |
| party | `mda.amn` Our Moldova Alliance (AMN) | Wikidata dates Urechean's chairmanship from July 2005 (month precision); he led the Democratic Moldova bloc in March 2005. Confirm the start of his leadership. | data/countries/MDA/parties.json |
| party | `mda.pl` Liberal Party (PL) | Leader dates from Wikidata (year precision); Dorin Chirtoaca (2018-2021) is not recorded as a person. Confirm. | data/countries/MDA/parties.json |
| party | `mda.psrm` Party of Socialists of the Republic of Moldova (PSRM) | Dodon led the 2014 list and Greceanîi the 2019 list (election infoboxes); Wikidata lists Greceanîi without dates and Dodon from 23 March 2024. Confirm the chairmanship dates. | data/countries/MDA/parties.json |
| party | `mda.sor` Șor Party (Șor) | Wikidata: founded 13 June 1998 (contested 2005 as the Republican Movement 'Equality'), chaired by Valerii Klimenko 1998-2016 (not recorded as a person) and Ilan Shor 2016-2023; dissolved 19 June 2023. Confirm. | data/countries/MDA/parties.json |
| party | `mda.pn` Our Party (PN) | Wikidata gives the 1994 inception (under an earlier name) and Usatii as chairman from 2015; confirm the party's 1998-2000 identity and status. | data/countries/MDA/parties.json |
| party | `mda.ppda` Democracy at Home Party (PPDA) | Wikidata lists Costiuc as chairman without dates; 2025 is the election at which the fetched infobox names him as leader. Confirm when he became chairman. | data/countries/MDA/parties.json |
| election | `presidential_2009_nov` indirect_presidential 2009-11-10 | Add Lupu's vote totals in each round (the fetched article does not give them). | data/countries/MDA/elections.json |

### MKD — Macedonia (6)

| kind | record | what to check | file |
|---|---|---|---|
| person | `mkd.zidi_xhelili` Zidi Xhelili (b. 1961) | No English Wikipedia article; Wikidata gives only a birth year (1961) and gender, not cross-checked. | data/countries/MKD/people.json |
| person | `mkd.ljubomir_frckoski` Ljubomir Frčkoski (b. 1957) | Wikidata holds two birth dates (2 February and 12 December 1957); check the Wikipedia article. | data/countries/MKD/people.json |
| person | `mkd.imer_selmani` Imer Selmani (b. 1968) | No English Wikipedia article; birth date and gender are from Wikidata only and were not cross-checked. | data/countries/MKD/people.json |
| person | `mkd.agron_buxhaku` Agron Buxhaku (b. 1957) | No English Wikipedia article; birth date and gender are from Wikidata only and were not cross-checked. | data/countries/MKD/people.json |
| party | `mkd.aa` Alliance for Albanians (AA) | Check when Arben Taravari became leader (2020 assumed) and the party's 2024 alliance. | data/countries/MKD/parties.json |
| party | `mkd.vlen` VLEN Coalition (VLEN) | The article dates the conversion into a party only as 2026 (after June 2026 by the article's edit history); check the date and the member parties. | data/countries/MKD/parties.json |

### MLT — Malta (1)

| kind | record | what to check | file |
|---|---|---|---|
| party | `mlt.ad` Democratic Alternative (AD) | The chair on 1 January 2000 (Harry Vassallo) is missing from leader_history because no birth year was found for him; add him if a source gives one. Confirm whether Vassallo became chair in 1998 or 1999. | data/countries/MLT/parties.json |

### MNE — Montenegro (7)

| kind | record | what to check | file |
|---|---|---|---|
| person | `mne.dragan_kujovic` Dragan Kujović (b. 1948) | Wikidata gives only the birth year (1948); acting President for three days in May 2003. | data/countries/MNE/people.json |
| person | `mne.bozidar_bojovic` Božidar Bojović (b. 1938) | Wikidata gives only the years of birth (1938) and death (2021); founder of the Serb People's Party. | data/countries/MNE/people.json |
| party | `mne.sdp` Social Democratic Party of Montenegro (SDP) | Check the years Ranko Krivokapić (2001 assumed) and Draginja Vuksanović (2019 assumed) led the party. | data/countries/MNE/parties.json |
| party | `mne.lscg` Liberal Alliance of Montenegro (LSCG) | Check whether and when the Liberal Alliance dissolved (2005 assumed from the end of its leader list). | data/countries/MNE/parties.json |
| party | `mne.df` Democratic Front (DF) | Collective leadership: list leaders are recorded as leaders; check dates. | data/countries/MNE/parties.json |
| party | `mne.ura` United Reform Action (URA) | Check when Dritan Abazović became URA president (2017 assumed). | data/countries/MNE/parties.json |
| party | `mne.bs` Bosniak Party (BS) | Check when Ervin Ibrahimović became party president (2023 assumed). | data/countries/MNE/parties.json |

### MNG — Mongolia (8)

| kind | record | what to check | file |
|---|---|---|---|
| person | `mng.dendeviin_terbishdagva` Dendeviin Terbishdagva (b. 1955) | Party conflict: MPRP (2010) per the Wikipedia list of prime ministers versus the Democratic Party per Wikidata. Birth year (1955) has only Wikidata as source. | data/countries/MNG/people.json |
| party | `mng.msdp` Mongolian Social Democratic Party (MSDP) | Leader history is empty: the party's chairman in 2000 was not found in the fetched sources. | data/countries/MNG/parties.json |
| party | `mng.mtup` Mongolian Traditional United Party (MTUP) | Leader history is empty: the party's leaders since 2000 were not found with dates. | data/countries/MNG/parties.json |
| party | `mng.motherland` Motherland Party (Motherland) | Leader history is empty (founder Badarchiin Erdenebat has no person record). Check whether the party existed under this name in 1996 and its status on 1 January 2000; 'extra_parliamentary' is assumed. | data/countries/MNG/parties.json |
| party | `mng.civil_will` Civil Will Party (CWP) | Oyun is the founder and is described as the party's leader, but her leadership dates are not given; the founding-to-merger span is an assumption. | data/countries/MNG/parties.json |
| party | `mng.cwgp` Civil Will–Green Party (CWGP) | Leader history is empty: chair dates (including Batyn Batbaatar's) were not found. | data/countries/MNG/parties.json |
| party | `mng.republican` Republican Party (MRP) | Confirm that Jargalsaikhan has chaired the party since its 2004 refounding and who led it in 2000. | data/countries/MNG/parties.json |
| party | `mng.hun` HUN Party (HUN) | Leader history is empty: the dates of its chairs (Badrakhyn Naidalaa, then Togmidyn Dorjkhand) were not found. | data/countries/MNG/parties.json |

### NCY — Northern Cyprus (6)

| kind | record | what to check | file |
|---|---|---|---|
| office | `ncy.prime_minister` Prime Minister of the Turkish Republic of Northern Cyprus | Who headed the government between 23 October and 9 December 2020 (Tatar's premiership is extended to 9 December per Wikidata; the Wikipedia list shows a gap). | data/countries/NCY/country.json |
| party | `ncy.dp` Democratic Party (DP) | Add the DP leader between 2000 and December 2002 and Serdar Denktaş's successor from 2019; check the ideology classification. | data/countries/NCY/parties.json |
| party | `ncy.tkp` Communal Liberation Party (TKP) | Leader history empty (1998 leader Alpay Durduran has no source entry); check what became of the party in 2007. | data/countries/NCY/parties.json |
| party | `ncy.bdh` Peace and Democracy Movement (BDH) | Check the founding date (2003 is the year of its first election) and what became of the movement in 2007. | data/countries/NCY/parties.json |
| party | `ncy.orp` Freedom and Reform Party (ÖRP) | Check ÖRP's ideology (recorded as liberal_conservative). | data/countries/NCY/parties.json |
| party | `ncy.ydp` Rebirth Party (YDP) | Check YDP's ideology (recorded as right_populist). | data/countries/NCY/parties.json |

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

### PMR — Transnistria (5)

| kind | record | what to check | file |
|---|---|---|---|
| chamber | `supreme_council` Supreme Council | The party composition of the 1995-2000 Supreme Council was not found (there is no English Wikipedia article on the 1995 election); all 67 seats are recorded as 'others'. The chamber size also changed to 43 (December 2000) and 33 (2020), which the schema cannot express. | data/countries/PMR/country.json |
| person | `pmr.pyotr_stepanov` Pyotr Stepanov (b. 1959) | Wikidata gives two birth dates (24 December 1959 and 2 January 1959); the Wikipedia list gives only the year 1959. Confirm the date. | data/countries/PMR/people.json |
| party | `pmr.obnovlenie` Republican Party "Obnovlenie" (Renewal) (Obnovlenie) | Shevchuk is the founder and was leader at the 2005 election; Kaminski (2010), Burla (2015) and Korshunov (2020) are the leaders named in the election infoboxes. Exact tenures are not in the fetched sources; the infobox names Galina Antyufeeva as current chairperson. | data/countries/PMR/parties.json |
| party | `pmr.republic` Republic (Respublika) (Respublika) | Wikipedia gives a 1990 foundation and 2007 registration and names Smirnov as leader without dates (2005 is the election at which the source shows him leading it). Confirm its status on 1 January 2000 and Smirnov's leadership dates. | data/countries/PMR/parties.json |
| party | `pmr.proriv` Proriv (Proriv) | Soin is the infobox leader without dates; confirm he led it from founding. | data/countries/PMR/parties.json |

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

### PRK — North Korea (8)

| kind | record | what to check | file |
|---|---|---|---|
| office | `prk.premier` Premier of the Cabinet | The date of the change from Kim Tok-hun to Pak Thae-song differs within Wikipedia (24, 27 or 29 December 2024). Check the KCNA report. | data/countries/PRK/country.json |
| person | `prk.kim_jong_un` Kim Jong Un (b. 1982) | Birth year is disputed: 1982 (North Korean sources, Wikidata), 1983 (South Korean intelligence) or 1984 (US government). | data/countries/PRK/people.json |
| person | `prk.ri_son_gwon` Ri Son-gwon (b. 1960) | Birth year is approximate: Wikidata gives about 1960 and Wikipedia gives none. Also confirm his party membership (Wikidata lists the WPK while he chairs the KSDP). | data/countries/PRK/people.json |
| party | `prk.ksdp` Korean Social Democratic Party (KSDP) | The chairman from September 2022 to February 2026 is not known from the fetched sources. | data/countries/PRK/parties.json |
| party | `prk.chondoist_chongu` Chondoist Chongu Party (CCP) | Leader history is empty: Ryu Mi-yong's term as chairwoman and the dates of later chairs (Ri Myong-chol) were not found. | data/countries/PRK/parties.json |
| election | `spa_presidium_2003` indirect_presidential 2003-09-03 | His re-election at this session is inferred from his unbroken tenure and the convocation date; confirm with the KCNA report of the session. | data/countries/PRK/elections.json |
| election | `spa_presidium_2009` indirect_presidential 2009-04-09 | His re-election at this session is inferred from his unbroken tenure and the convocation date; confirm with the KCNA report of the session. | data/countries/PRK/elections.json |
| election | `spa_presidium_2014` indirect_presidential 2014-04-09 | His re-election at this session is inferred from his unbroken tenure and the convocation date; confirm with the KCNA report of the session. | data/countries/PRK/elections.json |

### PSE — Palestine (4)

| kind | record | what to check | file |
|---|---|---|---|
| chamber | `plc` Palestinian Legislative Council | Sources disagree on Fatah's 1996 seats: the 1996 election infobox gives Fatah 50 and independents 35 (plus FIDA 1 and two other lists with 1 each, recorded as 'others'); the Legislative Council article says Fatah won 62 of 88, and the 2006 election article says Fatah held 68 of 88 before 2006 (counting Fatah-aligned independents). | data/countries/PSE/country.json |
| party | `pse.ppp` Palestinian People's Party (PPP) | Leadership dates are not given in the fetched sources: confirm who was general secretary on 1 January 2000 (Bashir Barghouti, who died in September 2000, or Mustafa Barghouti) and when Bassam al-Salhi took over (recorded as 2005, the year of his presidential candidacy). | data/countries/PSE/parties.json |
| party | `pse.fida` Palestinian Democratic Union (FIDA) (FIDA) | No dated leadership list was found; confirm FIDA's leader on 1 January 2000 and the dates of later leaders (Saleh Ra'fat). | data/countries/PSE/parties.json |
| party | `pse.pij` Palestinian Islamic Jihad (PIJ) | The founding year (1981) is taken from the start of Fathi Shaqaqi's leadership in the infobox; confirm. | data/countries/PSE/parties.json |

### ROU — Romania (3)

| kind | record | what to check | file |
|---|---|---|---|
| party | `rou.psdr` Romanian Social Democratic Party (PSDR) | Check Sergiu Cunescu's tenure as PSDR leader (recorded from the party's founding to its merger) and the PSDR's 1996 vote estimate. | data/countries/ROU/parties.json |
| party | `rou.punr` Romanian National Unity Party (PUNR) | The fetched article does not give leadership dates, so leader_history is empty; check who led the PUNR on 1 January 2000 and add them. | data/countries/ROU/parties.json |
| party | `rou.sos` S.O.S. Romania (SOS RO) | Check the date Diana Șoșoacă became president of S.O.S. Romania (recorded from 2024 only). | data/countries/ROU/parties.json |

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

### SVK — Slovakia (6)

| kind | record | what to check | file |
|---|---|---|---|
| party | `svk.kss` Communist Party of Slovakia (KSS) | Leader history is incomplete: Ševc's tenure (recorded from 2002, the election at which he led the list) and the leader on 1 January 2000 were not checked. | data/countries/SVK/parties.json |
| party | `svk.sdku` Slovak Democratic and Christian Union – Democratic Party (SDKÚ-DS) | Exact dates of the 2012 leadership change (Dzurinda to Frešo) were not in the fetched text; check the party history. | data/countries/SVK/parties.json |
| party | `svk.most_hid` Most–Híd (Bridge) (Most–Híd) | Bugár's end date as chairman and later chairs are not recorded; check the party's leader list. | data/countries/SVK/parties.json |
| party | `svk.sme_rodina` We Are Family (Sme rodina) | Kollár is the leader per the infobox; the start year 2015 (Wikidata founding year of the party in its current form) is unchecked. | data/countries/SVK/parties.json |
| party | `svk.zl` For the People (ZĽ) | The date Remišová succeeded Kiska is not in the fetched sources; 2021 is a placeholder. | data/countries/SVK/parties.json |
| election | `referendum_2010` referendum 2010-09-18 | The individual questions and their number were not checked; only the first question's figures were read from the source. | data/countries/SVK/elections.json |

### SVN — Slovenia (10)

| kind | record | what to check | file |
|---|---|---|---|
| person | `svn.france_arhar` France Arhar (b. 1948) | No English Wikipedia article; birth date and gender are from Wikidata only and were not cross-checked. | data/countries/SVN/people.json |
| person | `svn.sabina_sencar` Sabina Senčar (b. 1970) | No English Wikipedia article; birth date and gender are from Wikidata only and were not cross-checked. | data/countries/SVN/people.json |
| person | `svn.marjan_podobnik` Marjan Podobnik (b. 1960) | No English Wikipedia article; birth date and gender are from Wikidata only and were not cross-checked. | data/countries/SVN/people.json |
| person | `svn.franc_zagozen` Franc Zagožen (b. 1942) | No English Wikipedia article; birth date and gender are from Wikidata only and were not cross-checked. | data/countries/SVN/people.json |
| party | `svn.smc` Modern Centre Party (SMC) | Check the date Zdravko Počivalšek succeeded Miro Cerar as party president (2019 assumed from his later role; not stated in the fetched article). | data/countries/SVN/parties.json |
| election | `ref_regions_2008` referendum 2008-06-22 | National yes/no totals are not in the fetched article; check the State Election Commission (DVK) report. | data/countries/SVN/elections.json |
| election | `ref_parliamentary_inquiry_2026` referendum 2026-10-11 | Recent event (October 2026) taken from a short Wikipedia article that calls all four questions non-binding; confirm the figures and the binding status with the State Election Commission (DVK). | data/countries/SVN/elections.json |
| election | `ref_social_assistance_2026` referendum 2026-10-11 | Recent event (October 2026); confirm with the State Election Commission (DVK). | data/countries/SVN/elections.json |
| election | `ref_local_voting_2026` referendum 2026-10-11 | Recent event (October 2026); confirm with the State Election Commission (DVK). | data/countries/SVN/elections.json |
| election | `ref_rtv_fee_2026` referendum 2026-10-11 | Recent event (October 2026); confirm with the State Election Commission (DVK). | data/countries/SVN/elections.json |

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

### TWN — Taiwan (5)

| kind | record | what to check | file |
|---|---|---|---|
| chamber | `legislative_yuan` Legislative Yuan | seats_2000 is the December 1998 election result (others: Democratic Union of Taiwan 4, Democratic Non-Partisan Alliance 3, New Nation Alliance 1, Taiwan Independence Party 1), not the composition on 1 January 2000. Check the split of district and list seats in 1998 and the list-seat threshold then in force. | data/countries/TWN/country.json |
| person | `twn.chang_po_ya` Chang Po-ya (b. 1942) | Her NPSU leadership dates were not found. | data/countries/TWN/people.json |
| person | `twn.shu_chin_chiang` Shu Chin-chiang (b. 1953) | His party affiliation on 1 January 2000, before he joined the TSU in 2001, was not found. | data/countries/TWN/people.json |
| party | `twn.tsu` Taiwan Solidarity Union (TSU) | The current chair, Chou Ni-an (since 29 January 2024), has no person record because no Wikipedia or Wikidata entry was found; add one if a source is found. | data/countries/TWN/parties.json |
| party | `twn.npsu` Non-Partisan Solidarity Union (NPSU) | The English Wikipedia article only names election leaders (Chang Po-ya for 2004-2005 and 2016, Lin Pin-kuan for later elections; the infobox names Lin Pin-kuan as current leader) and has no dated leader list. Confirm Chang Po-ya's chairmanship dates and add Lin Pin-kuan. | data/countries/TWN/parties.json |

### UKR — Ukraine (22)

| kind | record | what to check | file |
|---|---|---|---|
| person | `ukr.hennadiy_udovenko` Hennadiy Udovenko (b. 1931) | Confirm the dates of Udovenko's chairmanship of Rukh (from 1999); not in the fetched Wikidata chair list. | data/countries/UKR/people.json |
| person | `ukr.viktor_medvedchuk` Viktor Medvedchuk (b. 1954) | Confirm the dates Medvedchuk chaired SDPU(o); the 2002 election infobox names him as its leader, the 1998 infobox names Leonid Kravchuk. | data/countries/UKR/people.json |
| party | `ukr.kpu` Communist Party of Ukraine (KPU) | Confirm the start of Symonenko's leadership (the fetched sources show him as leader from the 1998 election through 2012). The party was banned by a court on 16 December 2015 (ban upheld 6 July 2022); the schema has no 'banned' date, so dissolved is set to the court ban. | data/countries/UKR/parties.json |
| party | `ukr.rukh` People's Movement of Ukraine (Rukh) | Udovenko is recorded as leader from 1999 because he was Rukh's 1999 presidential candidate after the death of Viacheslav Chornovil (Rukh's leader at the 1998 election); confirm his chairmanship dates. Later leaders (Vasyl Kuybida until 2017, Viktor Kryvenko 2017-2021, Andriy Kornat) are not recorded as people in this file. | data/countries/UKR/parties.json |
| party | `ukr.spu` Socialist Party of Ukraine (SPU) | Moroz (the founder) is recorded from 1998, the earliest fetched evidence; confirm his tenure and when it ended (Wikidata lists Mykola Rudkovsky 2013-2015 and Illia Kyva 2018-2019). The party was banned on 15 June 2022. | data/countries/UKR/parties.json |
| party | `ukr.ndp` People's Democratic Party (NDP) | Matviyenko (founder) led the 1998 list; confirm who chaired the party on 1 January 2000 (Prime Ministers Pustovoitenko and Yushchenko are both associated with the NDP in the Wikipedia PM list). Current leader Liudmyla Suprun is not recorded as a person. | data/countries/UKR/parties.json |
| party | `ukr.hromada` Hromada (Hromada) | Lazarenko led the 1998 list and is the infobox leader; confirm leadership dates (Wikidata gives a start of 2018). | data/countries/UKR/parties.json |
| party | `ukr.greens` Party of Greens of Ukraine (PZU) | Kononov led the 1998 list; confirm his tenure (Wikidata dates his chairmanship from 2014, the infobox names Tetyana Bodun as current leader). | data/countries/UKR/parties.json |
| party | `ukr.sdpuo` Social Democratic Party of Ukraine (united) (SDPU(o)) | Kravchuk headed the 1998 list and Medvedchuk is the party leader in the 2002 election infobox; confirm the chairmanship dates. | data/countries/UKR/parties.json |
| party | `ukr.peoples_party` People's Party (Agrarian Party of Ukraine) (NP) | Lytvyn is the infobox and Wikidata leader with no dates; 2004 is an assumed start (he led the party's Lytvyn Bloc at the 2006 and 2007 elections). Confirm when he became chairman and who led the Agrarian Party in 2000. | data/countries/UKR/parties.json |
| party | `ukr.prp` Reforms and Order Party (PRP) | Pynzenyk is listed as a chairman in Wikidata without dates; the infobox names Serhiy Sobolev as the later leader. Confirm the tenure. | data/countries/UKR/parties.json |
| party | `ukr.regions` Party of Regions (PR) | Yanukovych led the party at the 2006 and 2007 elections and Azarov at the 2012 election (per the election infoboxes; Wikidata lists Azarov and Oleksandr Yefremov without dates). Confirm the exact chairmanship dates and who led the party in 2000. | data/countries/UKR/parties.json |
| party | `ukr.batkivshchyna` All-Ukrainian Union "Fatherland" (Batkivshchyna) (Batkivshchyna) | Tymoshenko is the current infobox leader; confirm she has led the party continuously since its founding on 9 July 1999. | data/countries/UKR/parties.json |
| party | `ukr.our_ukraine` Our Ukraine (NU) | Covers the Viktor Yushchenko Bloc 'Our Ukraine' (2002), the Our Ukraine bloc (2006) and the Our Ukraine-People's Self-Defense bloc (2007) as well as the Our Ukraine party founded on 5 March 2005. 2002 is used as the founding year because the bloc first contested that election; confirm the bloc's registration date. List leaders were Yuriy Yekhanurov (2006) and Yuriy Lutsenko (2007). | data/countries/UKR/parties.json |
| party | `ukr.svoboda` All-Ukrainian Union "Svoboda" (Svoboda) | Tyahnybok is the infobox leader; 2004 is the year the party adopted the Svoboda name. Confirm when he became leader. | data/countries/UKR/parties.json |
| party | `ukr.european_solidarity` European Solidarity (Petro Poroshenko Bloc "Solidarity") (YeS) | Lutsenko (2014-2015) and Klitschko (from 28 August 2015) are from Wikidata; Poroshenko is recorded from 2019, when he led the European Solidarity list. Confirm when Klitschko's chairmanship ended. status_2000 is not_yet_founded although Wikipedia dates the party (as Solidarity) to May 2000; it held no seats on 1 January 2000. | data/countries/UKR/parties.json |
| party | `ukr.self_reliance` Self Reliance (Samopomich) | Sadovyi is chairman from 29 December 2012 per Wikidata (no end date); the infobox names Oksana Syroyid as current leader. Confirm when the leadership changed. | data/countries/UKR/parties.json |
| party | `ukr.opposition_bloc` Opposition Bloc (OB) | Boyko led the 2014 list; Wikidata also lists Yevhenii Muraiev, Borys Kolesnikov and Vadym Novynskyi as chairs without dates. Confirm the leadership. | data/countries/UKR/parties.json |
| party | `ukr.radical` Radical Party of Oleh Liashko (RPL) | Liashko is leader per Wikipedia and Wikidata (no dates); confirm whether he has led it since its founding. | data/countries/UKR/parties.json |
| party | `ukr.opzzh` Opposition Platform - For Life (OPZZh) | Boyko headed the 2019 list; confirm his formal title and dates (the infobox lists separate leader and political-council chair posts). | data/countries/UKR/parties.json |
| party | `ukr.servant` Servant of the People (SN) | Razumkov headed the party and its 2019 list; later chairs (including Oleksandr Korniienko, elected 17 December 2025 per the infobox) are not recorded as people here. Confirm the chair dates. | data/countries/UKR/parties.json |
| party | `ukr.holos` Voice (Holos) (Holos) | Vakarchuk founded the party and led its 2019 list; the infobox names Kira Rudik as the current leader. Confirm when Vakarchuk stepped down. | data/countries/UKR/parties.json |

### USA — United States (2)

| kind | record | what to check | file |
|---|---|---|---|
| party | `usa.green` Green Party of the United States (GPUS) | Founding date conflicts: Wikipedia says formally formed on 30 July 2001, Wikidata gives April 2001. Check which date marks the FEC recognition/rename from the ASGP. | data/countries/USA/parties.json |
| party | `usa.constitution` Constitution Party (CP) | Founding year conflicts: Wikipedia infobox gives 1990, Wikidata gives 1991. Confirm the founding year. | data/countries/USA/parties.json |

### YUG — Federal Republic of Yugoslavia (8)

| kind | record | what to check | file |
|---|---|---|---|
| chamber | `chamber_of_citizens` Chamber of Citizens (Federal Assembly) | 1996 result; party realignments in Montenegro after the 1997 DPS split are not reflected. Check the chamber's composition on 1 January 2000. | data/countries/YUG/country.json |
| chamber | `chamber_of_republics` Chamber of Republics (Federal Assembly) | Party composition of the Chamber of Republics on 1 January 2000 not researched; replace the 'appointed' placeholder. | data/countries/YUG/country.json |
| person | `yug.srdjan_milivojevic` Srđan Milivojević (b. 1965) | Wikidata gives only the birth year (1965); check the Wikipedia article for a full date. | data/countries/YUG/people.json |
| party | `yug.svm` Alliance of Vojvodina Hungarians (SVM) | Check the years István Pásztor (2008 assumed) and Bálint Pásztor (2023 assumed) became party president. | data/countries/YUG/parties.json |
| party | `yug.dveri` Serbian Movement Dveri (Dveri) | Check when Boško Obradović became party president (2016 assumed) and whether he still leads it. | data/countries/YUG/parties.json |
| party | `yug.ssz` Serbian Party Oathkeepers (SSZ) | Check when Milica Đurđević Stamenkovski became party president (2022 assumed). | data/countries/YUG/parties.json |
| party | `yug.zlf` Green–Left Front (ZLF) | Check the party's leadership (co-leaders) and Radomir Lazović's role. | data/countries/YUG/parties.json |
| party | `yug.mi_gin` We – Voice from the People (MI–GIN) | Check the founding date and ideology (right populist assumed). | data/countries/YUG/parties.json |
