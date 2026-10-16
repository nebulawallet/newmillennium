"""Dated historical events, 2000-2026 (Phase 13).

Every candidate names the Wikipedia article that documents it. The pipeline:
  1. python -I -X utf8 scripts/dev/gen-events-history.py candidates   -> .cache/event-candidates.json
  2. npx tsx scripts/research/verify-events.ts .cache/event-candidates.json .cache/event-verified.json
  3. python -I -X utf8 scripts/dev/gen-events-history.py build         -> data/events/history_*.json
Only candidates whose date was found in the article are written. Descriptions state the date and what
happened, nothing more; effects are gameplay estimates from a few templates.
"""
import json, sys

ACC = "2026-10-15"
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
T = lambda m, v, d=730: {"add_timed_modifier": {"modifier": m, "value": v, "days": d}}
IG = lambda g, v: {"add_interest_group_approval": {"group": g, "value": v}}
# (x or 0.0) turns -0.0 into 0.0: JSON saves -0 as 0, so a save would not round-trip exactly
SHOCK = lambda g, months, u=0.0, i=0.0: {"economic_shock": {k: (v or 0.0) for k, v in {"growth": round(g, 3), "months": months, "unemployment": round(u, 3), "inflation": round(i, 3)}.items() if v or k in ("growth", "months")}}


def opt(id, name, effects, ai=1):
    o = {"id": id, "name": name, "effects": effects}
    if ai != 1:
        o["ai_weight"] = ai
    return o


# ------------------------------------------------------------------ effect templates

def tpl(kind, p):
    s = p.get("sev", 1.0)
    if kind == "attack":  # terrorist attack
        return [
            opt("security", "Tighten security", [{"add_stability": round(-0.02 * s, 3)}, {"add_war_support": round(0.04 * s, 3)}, IG("security_services", 4), T("internal_security", 0.05 * s, 730), T("civil_liberties", -0.03, 730)], 2),
            opt("liberties", "Defend open society", [{"add_stability": round(-0.03 * s, 3)}, IG("youth_students", 2), IG("media", 2)]),
        ]
    if kind == "disaster":  # natural or industrial disaster
        return [opt("relief", "Organise relief and rebuilding", [SHOCK(-p.get("g", 0.5), p.get("m", 6)), {"add_stability": round(-0.02 * s, 3)}, T("construction_speed", 0.05, 365)])]
    if kind == "crisis":  # financial or economic crisis
        return [
            opt("stimulus", "Support the economy", [SHOCK(-p.get("g", 1.5), p.get("m", 12), p.get("u", 1.0)), {"set_budget": {"spending": 1.0}}, IG("labour_unions", 2)], 2),
            opt("austerity", "Restore confidence", [SHOCK(-p.get("g", 1.5) * 1.2, p.get("m", 12), p.get("u", 1.0) * 1.2), {"set_budget": {"spending": -1.0}}, IG("business", 3), {"add_unrest": 0.03}]),
        ]
    if kind == "boom":  # positive economic news
        return [opt("welcome", "Welcome the news", [{"add_economic_mood": 0.05 * s}, T("foreign_investment", 0.02, 365)])]
    if kind == "treaty":  # agreement signed or in force
        return [opt("ratify", "Honour the agreement", [T("diplomatic_reputation", 0.03, 1095), T("bloc_integration", 0.03, 1095)] + p.get("extra", []))]
    if kind == "climate":
        return [
            opt("commit", "Commit to the targets", [T("renewable_output", 0.05, 3650), T("emissions", -0.03, 3650), IG("youth_students", 2), IG("business", -1)], 2),
            opt("cautious", "Move cautiously", [T("diplomatic_reputation", -0.02, 730)]),
        ]
    if kind == "protest":  # mass protests
        return [
            opt("concede", "Meet the protesters halfway", [{"add_unrest": -0.02}, {"add_stability": -0.02}, IG(p.get("group", "youth_students"), 4), {"add_political_power": -20}]),
            opt("firm", "Hold firm", [{"add_unrest": 0.04}, IG(p.get("group", "youth_students"), -5), IG("security_services", 3)], 2),
        ]
    if kind == "sport":  # host a major sporting event
        return [opt("host", "Host the games", [{"add_stability": 0.02}, T("international_opinion", 0.03, 730), T("construction_speed", 0.03, 365)])]
    if kind == "science":  # space or science milestone
        return [opt("celebrate", "Celebrate the achievement", [{"add_stability": 0.01}, T("research_speed", 0.02, 730), T("international_opinion", 0.02, 730)])]
    if kind == "reform":  # domestic reform or institutional change
        return [opt("implement", "Carry it through", [{"add_political_power": -10}, {"add_stability": 0.01}] + p.get("extra", []))]
    if kind == "politics":  # political turning point
        return [opt("note", "A new chapter", [{"add_stability": p.get("stab", -0.02)}] + p.get("extra", []))]
    if kind == "currency":  # currency changeover or euro adoption
        return [opt("adopt", "Complete the changeover", [IG("business", 3), T("trade_efficiency", 0.03, 1825), T("interest_rate", -0.003, 1825)])]
    if kind == "conflict":  # armed conflict nearby or involving the country
        return [opt("respond", "Respond", [{"add_war_support": 0.04 * s}, IG("military", 3), {"add_stability": round(-0.02 * s, 3)}, SHOCK(-0.3 * s, 6)])]
    if kind == "tension":  # diplomatic crisis or test
        return [opt("respond", "Respond firmly", [{"add_war_support": 0.03}, IG("military", 2), T("diplomatic_reputation", -0.01, 365)])]
    if kind == "energy":  # energy price or supply shock
        return [opt("respond", "Manage the shock", [SHOCK(-p.get("g", 0.5), p.get("m", 9), 0, p.get("i", 1.5)), T("energy_cost", p.get("e", 0.05), 730)])]
    raise ValueError(kind)


C = []


def E(id, date, countries, page, title, desc, kind, major=False, any_path=True, dynamic=False, also=None, **p):
    C.append(dict(id=id, date=date, countries=countries, page=page, title=title, desc=desc, kind=kind, major=major, any_path=any_path, dynamic=dynamic, also=also or [], p=p))


EU15 = ["AUT", "BEL", "DNK", "FIN", "FRA", "DEU", "GRC", "IRL", "ITA", "LUX", "NLD", "PRT", "ESP", "SWE", "GBR"]
EUROZONE_2002 = ["AUT", "BEL", "FIN", "FRA", "DEU", "GRC", "IRL", "ITA", "LUX", "NLD", "PRT", "ESP"]
NATO_WEST = ["USA", "GBR", "FRA", "DEU", "ITA", "ESP", "NLD", "POL", "TUR", "CAN"]

# ================================================================== 2000-2004
E("dotcom_crash", "2000-03-10", ["USA", "GBR", "DEU", "JPN", "FRA", "SWE"], "Dot-com bubble", "The dot-com peak", "On 10 March 2000 the NASDAQ Composite index peaked; the dot-com bubble then burst.", "crisis", g=1.0, m=18, u=0.8, major=True)
E("rus_kursk", "2000-08-12", ["RUS"], "Russian submarine Kursk (K-141)", "The Kursk", "The Russian submarine Kursk sank in the Barents Sea on 12 August 2000 during a naval exercise.", "disaster", g=0.0, sev=1.5)
E("concorde_crash", "2000-07-25", ["FRA"], "Air France Flight 4590", "Concorde crash", "Air France Flight 4590, a Concorde, crashed shortly after take-off from Paris on 25 July 2000.", "disaster", g=0.05, m=2)
E("uss_cole", "2000-10-12", ["USA"], "USS Cole bombing", "USS Cole bombing", "The destroyer USS Cole was attacked in the harbour of Aden, Yemen, on 12 October 2000.", "attack", sev=0.6)
E("second_intifada", "2000-09-28", ["ISR", "PSE"], "Second Intifada", "Second Intifada", "The Second Intifada began in late September 2000.", "conflict", also=["2000"], sev=1.5)
E("yug_bulldozer_revolution", "2000-10-05", ["YUG"], "Overthrow of Slobodan Milošević", "Protests in Belgrade", "Mass protests in Belgrade on 5 October 2000 led to the fall of Slobodan Milošević.", "protest", group="urban_middle_class", any_path=False)
E("gujarat_earthquake", "2001-01-26", ["IND"], "2001 Gujarat earthquake", "Gujarat earthquake", "An earthquake struck Gujarat, India, on 26 January 2001.", "disaster", g=0.4, dynamic=True)
E("hainan_incident", "2001-04-01", ["USA", "CHN"], "Hainan Island incident", "Hainan Island incident", "A United States Navy surveillance aircraft and a Chinese fighter collided near Hainan Island on 1 April 2001.", "tension")
E("bamiyan", "2001-03-12", ["AFG"], "Buddhas of Bamiyan", "The Buddhas of Bamiyan", "The Taliban destroyed the Buddhas of Bamiyan in March 2001.", "politics", also=["2001"], stab=0.0)
E("tur_crisis_2001", "2001-02-19", ["TUR"], "2001 Turkish economic crisis", "Financial crisis", "A financial crisis hit Turkey in February 2001.", "crisis", g=4.0, m=12, u=2.0, also=["2001"])
E("arg_corralito", "2001-12-01", ["ARG"], "Corralito", "The corralito", "On 1 December 2001 Argentina restricted cash withdrawals from bank accounts (the corralito).", "crisis", g=5.0, m=18, u=4.0)
E("anthrax_2001", "2001-09-18", ["USA"], "2001 anthrax attacks", "Anthrax letters", "Letters containing anthrax spores were mailed to news media offices and two senators from 18 September 2001.", "attack", sev=0.6)
E("usa_patriot_act", "2001-10-26", ["USA"], "USA PATRIOT Act", "The Patriot Act", "President George W. Bush signed the USA PATRIOT Act into law on 26 October 2001.", "reform", any_path=False, extra=[T("internal_security", 0.08, 3650), T("civil_liberties", -0.05, 3650), IG("security_services", 5)])
E("chn_wto_member", "2001-11-10", ["CHN"], "China and the World Trade Organization", "WTO accession approved", "The WTO Ministerial Conference approved China's accession on 10 November 2001.", "treaty", also=["WTO"])
E("icc_statute", "2002-07-01", ["DEU", "FRA", "GBR", "ITA", "ESP", "NLD", "POL"], "Rome Statute of the International Criminal Court", "International Criminal Court", "The Rome Statute of the International Criminal Court entered into force on 1 July 2002.", "treaty")
E("au_launch", "2002-07-09", ["ZAF", "NGA", "EGY", "ETH", "KEN"], "African Union", "The African Union", "The African Union was launched in Durban on 9 July 2002, replacing the Organisation of African Unity.", "treaty")
E("bali_bombings", "2002-10-12", ["IDN", "AUS"], "2002 Bali bombings", "Bali bombings", "Bombs exploded in the tourist district of Kuta, Bali, on 12 October 2002.", "attack", sev=1.2)
E("moscow_theatre", "2002-10-23", ["RUS"], "Moscow theater hostage crisis", "Moscow theatre siege", "Armed militants seized a Moscow theatre on 23 October 2002 and took the audience hostage.", "attack", sev=1.2)
E("timor_independence", "2002-05-20", ["TLS", "IDN", "PRT", "AUS"], "East Timor", "Independence of East Timor", "East Timor became independent on 20 May 2002.", "politics", stab=0.0, also=["2002"])
E("sars_outbreak", "2003-03-12", ["CHN", "TWN", "SGP", "CAN"], "2002–2004 SARS outbreak", "SARS", "The World Health Organization issued a global alert about a severe atypical pneumonia, later named SARS, on 12 March 2003.", "disaster", g=0.6, m=6, dynamic=True)
E("columbia_disaster", "2003-02-01", ["USA"], "Space Shuttle Columbia disaster", "Columbia disaster", "The Space Shuttle Columbia broke up on re-entry on 1 February 2003.", "disaster", g=0.0, sev=0.8)
E("shenzhou_5", "2003-10-15", ["CHN"], "Shenzhou 5", "First Chinese crewed spaceflight", "Shenzhou 5 carried Yang Liwei into orbit on 15 October 2003, the first Chinese crewed spaceflight.", "science")
E("european_heatwave_2003", "2003-08-01", ["FRA", "ITA", "ESP", "DEU", "PRT", "GBR"], "2003 European heatwave", "Summer heatwave", "A heatwave struck Europe in the summer of 2003.", "disaster", g=0.1, also=["2003"], dynamic=True)
E("northeast_blackout", "2003-08-14", ["USA", "CAN"], "Northeast blackout of 2003", "Northeast blackout", "A power outage hit the northeastern United States and Ontario on 14 August 2003.", "disaster", g=0.1, m=2)
E("rose_revolution", "2003-11-23", ["GEO"], "Rose Revolution", "Rose Revolution", "Mass protests in Georgia led to the resignation of President Eduard Shevardnadze on 23 November 2003.", "protest", group="urban_middle_class", any_path=False)
E("istanbul_bombings", "2003-11-15", ["TUR"], "2003 Istanbul bombings", "Istanbul bombings", "Truck bombs exploded in Istanbul on 15 and 20 November 2003.", "attack")
E("saddam_captured", "2003-12-13", ["USA", "IRQ"], "Capture of Saddam Hussein", "Capture of Saddam Hussein", "United States forces captured Saddam Hussein near Tikrit on 13 December 2003.", "politics", stab=0.02, extra=[{"add_war_support": 0.03}])
E("bam_earthquake", "2003-12-26", ["IRN"], "2003 Bam earthquake", "Bam earthquake", "An earthquake destroyed much of the city of Bam, Iran, on 26 December 2003.", "disaster", g=0.3, sev=1.5, dynamic=True)
E("madrid_bombings", "2004-03-11", ["ESP"], "2004 Madrid train bombings", "Madrid train bombings", "Bombs exploded on commuter trains in Madrid on 11 March 2004, three days before the general election.", "attack", sev=1.8, major=True)
E("beslan", "2004-09-01", ["RUS"], "Beslan school siege", "Beslan school siege", "Armed militants seized a school in Beslan, North Ossetia, on 1 September 2004.", "attack", sev=1.8, major=True)
E("orange_revolution", "2004-11-22", ["UKR"], "Orange Revolution", "Orange Revolution", "Mass protests over the presidential election runoff began in Ukraine in late November 2004.", "protest", group="urban_middle_class", any_path=False, also=["2004"])
E("indian_ocean_tsunami", "2004-12-26", ["IDN", "LKA", "IND", "THA", "MDV", "SOM", "MYS"], "2004 Indian Ocean earthquake and tsunami", "Indian Ocean tsunami", "An undersea earthquake off Sumatra on 26 December 2004 caused tsunamis around the Indian Ocean.", "disaster", g=1.0, m=12, sev=2.0, dynamic=True, major=True)
E("athens_olympics", "2004-08-13", ["GRC"], "2004 Summer Olympics", "Athens Olympics", "Athens hosted the Summer Olympics from 13 to 29 August 2004.", "sport")
E("van_gogh_killing", "2004-11-02", ["NLD"], "Theo van Gogh (film director)", "Murder of Theo van Gogh", "Film director Theo van Gogh was murdered in Amsterdam on 2 November 2004.", "attack", sev=0.6)
E("jpn_chuetsu_quake", "2004-10-23", ["JPN"], "2004 Chūetsu earthquake", "Chūetsu earthquake", "An earthquake struck Niigata Prefecture, Japan, on 23 October 2004.", "disaster", g=0.1, dynamic=True)

# ================================================================== 2005-2009
E("kyoto_in_force", "2005-02-16", ["DEU", "FRA", "GBR", "JPN", "ITA", "ESP", "NLD", "SWE", "POL", "RUS", "NOR", "DNK"], "Kyoto Protocol", "Kyoto Protocol in force", "The Kyoto Protocol on greenhouse gas emissions entered into force on 16 February 2005.", "climate")
E("lbn_hariri", "2005-02-14", ["LBN", "SYR"], "Assassination of Rafic Hariri", "Assassination of Rafic Hariri", "Former Lebanese Prime Minister Rafic Hariri was killed by a bomb in Beirut on 14 February 2005.", "attack", sev=1.2)
E("cedar_revolution", "2005-03-14", ["LBN"], "Cedar Revolution", "Cedar Revolution", "Mass demonstrations in Beirut on 14 March 2005 called for the withdrawal of Syrian troops from Lebanon.", "protest", group="urban_middle_class")
E("tulip_revolution", "2005-03-24", ["KGZ"], "Tulip Revolution", "Tulip Revolution", "Protesters took over government buildings in Bishkek on 24 March 2005 and President Askar Akayev fled.", "protest", group="urban_middle_class", any_path=False)
E("pope_john_paul_ii", "2005-04-02", ["ITA", "POL", "VAT"], "Pope John Paul II", "Death of Pope John Paul II", "Pope John Paul II died on 2 April 2005.", "politics", stab=-0.01, also=["2 April 2005"])
E("fra_eu_constitution_no", "2005-05-29", ["FRA"], "2005 French European Constitution referendum", "Referendum on the European Constitution", "French voters rejected the Treaty establishing a Constitution for Europe in a referendum on 29 May 2005.", "politics", any_path=False, stab=-0.02, extra=[T("bloc_integration", -0.05, 1095)])
E("nld_eu_constitution_no", "2005-06-01", ["NLD"], "2005 Dutch European Constitution referendum", "Referendum on the European Constitution", "Dutch voters rejected the Treaty establishing a Constitution for Europe in a referendum on 1 June 2005.", "politics", any_path=False, stab=-0.02, extra=[T("bloc_integration", -0.05, 1095)])
E("london_bombings", "2005-07-07", ["GBR"], "7 July 2005 London bombings", "London bombings", "Suicide bombers attacked London's public transport on 7 July 2005.", "attack", sev=1.5, major=True)
E("hurricane_katrina", "2005-08-29", ["USA"], "Hurricane Katrina", "Hurricane Katrina", "Hurricane Katrina made landfall on the Gulf Coast of the United States on 29 August 2005; New Orleans was flooded.", "disaster", g=0.5, m=9, sev=1.5, dynamic=True, major=True)
E("isr_gaza_disengagement", "2005-08-15", ["ISR", "PSE"], "Israeli disengagement from Gaza", "Disengagement from Gaza", "Israel began withdrawing its settlers and forces from the Gaza Strip in August 2005.", "politics", any_path=False, also=["2005"], stab=-0.03)
E("kashmir_earthquake", "2005-10-08", ["PAK", "IND"], "2005 Kashmir earthquake", "Kashmir earthquake", "An earthquake struck Kashmir on 8 October 2005.", "disaster", g=0.5, sev=1.5, dynamic=True)
E("fra_riots_2005", "2005-10-27", ["FRA"], "2005 French riots", "Riots in the suburbs", "Riots broke out in the suburbs of Paris on 27 October 2005 and spread to other French cities.", "protest", group="minorities")
E("deu_merkel_chancellor", "2005-11-22", ["DEU"], "Angela Merkel", "First woman Chancellor", "Angela Merkel became Chancellor of Germany on 22 November 2005, the first woman in the office.", "politics", any_path=False, stab=0.02)
E("russia_ukraine_gas_2006", "2006-01-01", ["UKR", "RUS", "DEU", "ITA", "POL", "HUN", "SVK", "CZE"], "2005–2006 Russia–Ukraine gas dispute", "Gas cut to Ukraine", "Russia cut gas supplies to Ukraine on 1 January 2006 in a dispute over prices.", "energy", g=0.2, m=3, i=0.5, e=0.03)
E("cartoons_protests", "2006-02-03", ["DNK"], "Jyllands-Posten Muhammad cartoons controversy", "Cartoons controversy", "Protests over the Jyllands-Posten cartoons of Muhammad spread across many countries in early 2006.", "tension", also=["2006"])
E("montenegro_referendum", "2006-05-21", ["YUG", "MNE"], "2006 Montenegrin independence referendum", "Montenegrin independence referendum", "Montenegro voted for independence in a referendum on 21 May 2006.", "politics", any_path=False, stab=-0.01, also=["21 May 2006"])
E("fifa_world_cup_2006", "2006-06-09", ["DEU"], "2006 FIFA World Cup", "World Cup in Germany", "Germany hosted the FIFA World Cup from 9 June to 9 July 2006.", "sport")
E("north_korea_nuclear_test_2006", "2006-10-09", ["PRK", "KOR", "JPN", "USA", "CHN"], "2006 North Korean nuclear test", "North Korean nuclear test", "North Korea conducted its first nuclear test on 9 October 2006.", "tension", major=True)
E("thai_coup_2006", "2006-09-19", ["THA"], "2006 Thai coup d'état", "Coup in Thailand", "The Royal Thai Army overthrew the government of Prime Minister Thaksin Shinawatra on 19 September 2006.", "politics", any_path=False, stab=-0.05)
E("mumbai_trains_2006", "2006-07-11", ["IND"], "2006 Mumbai train bombings", "Mumbai train bombings", "Bombs exploded on suburban trains in Mumbai on 11 July 2006.", "attack", sev=1.2)
E("svn_euro", "2007-01-01", ["SVN"], "Eurozone", "Slovenia adopts the euro", "Slovenia adopted the euro on 1 January 2007.", "currency")
E("estonia_bronze_night", "2007-04-26", ["EST", "RUS"], "Bronze Night", "Bronze Night", "Riots broke out in Tallinn over the relocation of the Bronze Soldier of Tallinn in late April 2007, followed by cyberattacks on Estonia.", "tension", also=["2007"])
E("lisbon_treaty_signed", "2007-12-13", EU15 + ["POL", "CZE", "HUN", "SVK", "SVN", "EST", "LVA", "LTU", "CYP", "MLT", "BGR", "ROU"], "Treaty of Lisbon", "Treaty of Lisbon signed", "The leaders of the European Union signed the Treaty of Lisbon on 13 December 2007.", "treaty")
E("benazir_bhutto", "2007-12-27", ["PAK"], "Assassination of Benazir Bhutto", "Assassination of Benazir Bhutto", "Former Prime Minister Benazir Bhutto was assassinated in Rawalpindi on 27 December 2007.", "attack", sev=1.5)
E("kenya_crisis", "2007-12-30", ["KEN"], "2007–2008 Kenyan crisis", "Post-election crisis", "Violence broke out in Kenya after the presidential election result was announced on 30 December 2007.", "protest", group="minorities")
E("subprime_crisis", "2007-08-09", ["USA", "GBR", "DEU", "FRA"], "2007–2008 financial crisis", "Credit crunch", "Interbank lending markets froze in August 2007 as losses on US subprime mortgages spread.", "crisis", g=0.5, m=12, u=0.3, also=["August 2007"])
E("northern_rock", "2007-09-14", ["GBR"], "Northern Rock", "Run on Northern Rock", "Depositors queued to withdraw their savings from Northern Rock from 14 September 2007.", "crisis", g=0.4, m=9, u=0.2)
E("kosovo_independence", "2008-02-17", ["KOS", "YUG", "USA", "GBR", "FRA", "DEU", "RUS"], "2008 Kosovo declaration of independence", "Kosovo declares independence", "The Assembly of Kosovo declared independence from Serbia on 17 February 2008.", "tension", major=True)
E("tibet_unrest_2008", "2008-03-14", ["CHN"], "2008 Tibetan unrest", "Unrest in Tibet", "Riots and protests broke out in Lhasa and other Tibetan areas in March 2008.", "protest", group="minorities", also=["2008"])
E("cyclone_nargis", "2008-05-02", ["MMR"], "Cyclone Nargis", "Cyclone Nargis", "Cyclone Nargis struck Myanmar on 2 May 2008.", "disaster", g=1.5, sev=2.0, dynamic=True)
E("sichuan_earthquake", "2008-05-12", ["CHN"], "2008 Sichuan earthquake", "Sichuan earthquake", "An earthquake struck Sichuan province, China, on 12 May 2008.", "disaster", g=0.4, sev=1.8, dynamic=True, major=True)
E("oil_price_peak_2008", "2008-07-11", ["USA", "DEU", "JPN", "FRA", "ITA", "ESP", "GBR", "CHN", "IND", "KOR"], "2000s energy crisis", "Oil at record prices", "The price of oil reached a record high in July 2008.", "energy", g=0.4, m=6, i=1.5, e=0.08, also=["2008"])
E("mumbai_attacks_2008", "2008-11-26", ["IND", "PAK"], "2008 Mumbai attacks", "Mumbai attacks", "Militants carried out coordinated shooting and bombing attacks across Mumbai from 26 November 2008.", "attack", sev=1.8, major=True)
E("iceland_banks", "2008-10-06", ["ISL"], "2008–2011 Icelandic financial crisis", "Icelandic banking collapse", "Iceland's three largest banks collapsed in October 2008.", "crisis", g=6.0, m=24, u=5.0, also=["2008"])
E("gaza_war_2008", "2008-12-27", ["ISR", "PSE"], "Gaza War (2008–2009)", "Gaza War", "Israel began a military operation in the Gaza Strip on 27 December 2008.", "conflict", any_path=False, sev=1.2)
E("russia_ukraine_gas_2009", "2009-01-01", ["UKR", "RUS", "BGR", "SVK", "HUN", "DEU", "ITA", "AUT", "CZE"], "2009 Russia–Ukraine gas dispute", "Gas crisis", "Russia stopped gas supplies to Ukraine on 1 January 2009; supplies to several European countries were cut off for about two weeks.", "energy", g=0.3, m=3, i=0.5, e=0.04)
E("slovakia_euro", "2009-01-01", ["SVK"], "Eurozone", "Slovakia adopts the euro", "Slovakia adopted the euro on 1 January 2009.", "currency")
E("swine_flu", "2009-06-11", ["MEX", "USA"], "2009 swine flu pandemic", "Swine flu pandemic", "The World Health Organization declared the H1N1 swine flu outbreak a pandemic on 11 June 2009.", "disaster", g=0.2, m=6, dynamic=True)
E("iran_green_movement", "2009-06-13", ["IRN"], "2009 Iranian presidential election protests", "Election protests", "Mass protests against the announced result of the presidential election broke out in Iran from 13 June 2009.", "protest", any_path=False, major=True)
E("laquila_earthquake", "2009-04-06", ["ITA"], "2009 L'Aquila earthquake", "L'Aquila earthquake", "An earthquake struck L'Aquila, Italy, on 6 April 2009.", "disaster", g=0.1, dynamic=True)
E("lisbon_in_force", "2009-12-01", EU15 + ["POL", "CZE", "HUN", "SVK", "SVN", "EST", "LVA", "LTU", "CYP", "MLT", "BGR", "ROU"], "Treaty of Lisbon", "Treaty of Lisbon in force", "The Treaty of Lisbon entered into force on 1 December 2009.", "treaty")
E("copenhagen_summit", "2009-12-07", ["DNK", "USA", "CHN", "IND", "DEU", "GBR", "FRA", "BRA", "ZAF"], "2009 United Nations Climate Change Conference", "Copenhagen climate summit", "The United Nations climate conference opened in Copenhagen on 7 December 2009.", "climate")
E("greek_debt_crisis", "2009-10-20", ["GRC"], "Greek government-debt crisis", "Greek debt crisis", "In October 2009 the new Greek government revealed that the budget deficit was far larger than reported.", "crisis", g=3.0, m=36, u=4.0, also=["2009"], major=True)
E("burj_khalifa", "2010-01-04", ["ARE"], "Burj Khalifa", "The world's tallest building", "The Burj Khalifa in Dubai opened on 4 January 2010.", "boom", sev=0.4)

# ================================================================== 2010-2014
E("haiti_earthquake", "2010-01-12", ["HTI"], "2010 Haiti earthquake", "Haiti earthquake", "An earthquake struck near Port-au-Prince, Haiti, on 12 January 2010.", "disaster", g=5.0, m=24, sev=3.0, dynamic=True, major=True)
E("chile_earthquake", "2010-02-27", ["CHL"], "2010 Chile earthquake", "Chile earthquake", "An earthquake struck central Chile on 27 February 2010.", "disaster", g=0.8, dynamic=True)
E("smolensk_crash", "2010-04-10", ["POL"], "Smolensk air disaster", "Smolensk air disaster", "A Polish Air Force plane carrying President Lech Kaczyński and many senior officials crashed near Smolensk, Russia, on 10 April 2010.", "politics", any_path=True, stab=-0.05, major=True)
E("eyjafjallajokull", "2010-04-14", ["ISL", "GBR", "DEU", "FRA", "NLD", "NOR"], "2010 eruptions of Eyjafjallajökull", "Volcanic ash cloud", "An eruption of Eyjafjallajökull in Iceland from 14 April 2010 spread ash across Europe and grounded flights.", "disaster", g=0.05, m=2, dynamic=True)
E("greece_bailout_2010", "2010-05-02", ["GRC", "DEU", "FRA"], "Greek government-debt crisis", "First Greek bailout", "On 2 May 2010 the eurozone and the International Monetary Fund agreed a loan package for Greece.", "crisis", g=1.0, m=12, u=1.0)
E("deepwater_horizon", "2010-04-20", ["USA"], "Deepwater Horizon oil spill", "Deepwater Horizon", "An explosion on the Deepwater Horizon drilling rig in the Gulf of Mexico on 20 April 2010 caused a major oil spill.", "disaster", g=0.1, m=6)
E("usa_affordable_care_act", "2010-03-23", ["USA"], "Affordable Care Act", "Affordable Care Act", "President Barack Obama signed the Affordable Care Act into law on 23 March 2010.", "reform", any_path=False, extra=[T("health_outcomes", 0.03, 3650), T("welfare_cost", 0.01, 3650), IG("business", -2)])
E("cheonan_sinking", "2010-03-26", ["KOR", "PRK"], "ROKS Cheonan sinking", "Sinking of the Cheonan", "The South Korean corvette Cheonan sank in the Yellow Sea on 26 March 2010.", "tension")
E("yeonpyeong", "2010-11-23", ["KOR", "PRK"], "Bombardment of Yeonpyeong", "Bombardment of Yeonpyeong", "North Korean artillery shelled Yeonpyeong Island on 23 November 2010.", "tension")
E("ireland_bailout", "2010-11-21", ["IRL"], "Post-2008 Irish banking crisis", "Irish bailout", "Ireland requested financial assistance from the European Union and the International Monetary Fund in November 2010.", "crisis", g=1.5, m=24, u=2.0, also=["2010"])
E("world_cup_2010", "2010-06-11", ["ZAF"], "2010 FIFA World Cup", "World Cup in South Africa", "South Africa hosted the FIFA World Cup from 11 June to 11 July 2010.", "sport")
E("arab_spring_tunisia", "2010-12-17", ["TUN"], "Tunisian revolution", "Revolution in Tunisia", "Protests began in Tunisia on 17 December 2010; President Zine El Abidine Ben Ali fled the country on 14 January 2011.", "protest", group="youth_students", major=True)
E("arab_spring_egypt", "2011-01-25", ["EGY"], "Egyptian revolution of 2011", "Revolution in Egypt", "Mass protests began in Egypt on 25 January 2011; President Hosni Mubarak resigned on 11 February 2011.", "protest", group="youth_students", major=True)
E("libya_civil_war_2011", "2011-02-15", ["LBY"], "Libyan civil war (2011)", "Uprising in Libya", "An uprising against Muammar Gaddafi began in Libya in February 2011.", "conflict", also=["2011"], sev=2.0)
E("unsc_1973", "2011-03-17", ["FRA", "GBR", "USA", "ITA"], "United Nations Security Council Resolution 1973", "Resolution 1973", "The UN Security Council authorised measures to protect civilians in Libya on 17 March 2011.", "conflict", sev=0.5)
E("syria_uprising", "2011-03-15", ["SYR"], "Syrian civil war", "Uprising in Syria", "Protests against the government began in Syria in March 2011 and turned into a civil war.", "conflict", also=["2011"], sev=2.0, major=True)
E("tohoku_earthquake", "2011-03-11", ["JPN"], "2011 Tōhoku earthquake and tsunami", "Tōhoku earthquake and tsunami", "A magnitude 9 earthquake off the coast of Tōhoku on 11 March 2011 caused a devastating tsunami.", "disaster", g=1.0, m=12, sev=2.0, dynamic=True, major=True)
E("deu_nuclear_exit_2011", "2011-05-30", ["DEU"], "Nuclear power in Germany", "Nuclear phase-out by 2022", "After the Fukushima accident, the German government decided in 2011 to shut down all nuclear plants by 2022.", "reform", any_path=False, also=["2011"], extra=[{"change_law": {"category": "energy_policy", "law": "nuclear_phaseout"}}, T("nuclear_output", -0.3, 3650), T("renewable_output", 0.1, 3650)])
E("bin_laden_killed", "2011-05-02", ["USA", "PAK"], "Killing of Osama bin Laden", "Death of Osama bin Laden", "United States special forces killed Osama bin Laden in Abbottabad, Pakistan, on 2 May 2011.", "politics", stab=0.03, extra=[{"add_war_support": 0.02}], major=True)
E("norway_attacks", "2011-07-22", ["NOR"], "2011 Norway attacks", "Attacks in Oslo and Utøya", "A far-right terrorist bombed government buildings in Oslo and attacked a youth camp on Utøya on 22 July 2011.", "attack", sev=1.8, major=True)
E("south_sudan_independence", "2011-07-09", ["SSD", "SDN"], "South Sudan", "Independence of South Sudan", "South Sudan became independent on 9 July 2011.", "politics", stab=0.0, also=["9 July 2011"])
E("england_riots", "2011-08-06", ["GBR"], "2011 England riots", "Riots in England", "Riots spread across London and other English cities from 6 August 2011.", "protest", group="youth_students")
E("us_credit_downgrade", "2011-08-05", ["USA"], "United States debt-ceiling crisis of 2011", "Credit rating downgrade", "Standard & Poor's downgraded the credit rating of the United States on 5 August 2011.", "crisis", g=0.3, m=6, u=0.1)
E("occupy_wall_street", "2011-09-17", ["USA"], "Occupy Wall Street", "Occupy Wall Street", "The Occupy Wall Street protest began in New York on 17 September 2011.", "protest", group="youth_students")
E("estonia_euro", "2011-01-01", ["EST"], "Eurozone", "Estonia adopts the euro", "Estonia adopted the euro on 1 January 2011.", "currency")
E("thailand_floods_2011", "2011-07-25", ["THA"], "2011 Thailand floods", "Floods in Thailand", "Severe floods hit Thailand from July 2011.", "disaster", g=1.0, also=["2011"], dynamic=True)
E("kim_jong_il_death", "2011-12-17", ["PRK", "KOR"], "Kim Jong Il", "Death of Kim Jong Il", "North Korean leader Kim Jong Il died on 17 December 2011.", "politics", stab=-0.02)
E("costa_concordia", "2012-01-13", ["ITA"], "Costa Concordia disaster", "Costa Concordia", "The cruise ship Costa Concordia capsized off the island of Giglio on 13 January 2012.", "disaster", g=0.0, m=1, sev=0.5)
E("greece_second_bailout", "2012-02-21", ["GRC"], "Greek government-debt crisis", "Second Greek bailout", "The eurozone agreed a second rescue package for Greece in February 2012.", "crisis", g=1.0, m=12, u=1.5, also=["2012"])
E("draghi_whatever_it_takes", "2012-07-26", EUROZONE_2002 + ["SVK", "SVN", "EST"], "Mario Draghi", "\"Whatever it takes\"", "On 26 July 2012 European Central Bank President Mario Draghi said the bank would do \"whatever it takes\" to preserve the euro.", "boom", sev=0.8)
E("london_olympics", "2012-07-27", ["GBR"], "2012 Summer Olympics", "London Olympics", "London hosted the Summer Olympics from 27 July to 12 August 2012.", "sport")
E("hurricane_sandy", "2012-10-29", ["USA"], "Hurricane Sandy", "Hurricane Sandy", "Hurricane Sandy made landfall in New Jersey on 29 October 2012.", "disaster", g=0.2, m=6, dynamic=True)
E("jpn_abenomics", "2013-01-22", ["JPN"], "Abenomics", "Abenomics", "The Bank of Japan adopted a 2% inflation target in January 2013 as part of the economic policies of Prime Minister Shinzō Abe.", "reform", any_path=False, also=["2013"], extra=[{"add_economic_mood": 0.05}, T("interest_rate", -0.005, 1825)])
E("boston_marathon", "2013-04-15", ["USA"], "Boston Marathon bombing", "Boston Marathon bombing", "Two bombs exploded near the finish line of the Boston Marathon on 15 April 2013.", "attack", sev=0.8)
E("rana_plaza", "2013-04-24", ["BGD"], "2013 Rana Plaza factory collapse", "Rana Plaza collapse", "The Rana Plaza garment factory building collapsed near Dhaka on 24 April 2013.", "disaster", g=0.2)
E("croatia_eu_note", "2013-07-01", ["HRV"], "Croatia", "Croatia in the Union", "Croatia joined the European Union on 1 July 2013.", "boom", sev=0.6)
E("gezi_protests", "2013-05-28", ["TUR"], "Gezi Park protests", "Gezi Park protests", "Protests over plans for Gezi Park in Istanbul began on 28 May 2013 and spread across Turkey.", "protest", any_path=False)
E("egypt_coup_2013", "2013-07-03", ["EGY"], "2013 Egyptian coup d'état", "Change of power in Egypt", "The Egyptian army removed President Mohamed Morsi from office on 3 July 2013.", "politics", any_path=False, stab=-0.05)
E("snowden_revelations", "2013-06-05", ["USA", "DEU", "GBR"], "Global surveillance disclosures (2013–present)", "Surveillance disclosures", "Newspapers began publishing classified documents on mass surveillance leaked by Edward Snowden on 5 June 2013.", "tension")
E("typhoon_haiyan", "2013-11-08", ["PHL"], "Typhoon Haiyan", "Typhoon Haiyan", "Typhoon Haiyan struck the central Philippines on 8 November 2013.", "disaster", g=1.0, sev=2.0, dynamic=True)
E("euromaidan", "2013-11-21", ["UKR"], "Euromaidan", "Euromaidan", "Protests began in Kyiv on 21 November 2013 after the government suspended the signing of an association agreement with the European Union.", "protest", group="youth_students", major=True)
E("latvia_euro", "2014-01-01", ["LVA"], "Eurozone", "Latvia adopts the euro", "Latvia adopted the euro on 1 January 2014.", "currency")
E("sochi_olympics", "2014-02-07", ["RUS"], "2014 Winter Olympics", "Sochi Winter Olympics", "Sochi hosted the Winter Olympics from 7 to 23 February 2014.", "sport")
E("mh370", "2014-03-08", ["MYS", "CHN"], "Malaysia Airlines Flight 370", "Flight MH370 disappears", "Malaysia Airlines Flight 370 disappeared on 8 March 2014 on its way from Kuala Lumpur to Beijing.", "disaster", g=0.0, m=1, sev=0.5)
E("donbas_war", "2014-04-06", ["UKR", "RUS"], "War in Donbas", "War in Donbas", "Armed conflict broke out in the Donbas region of eastern Ukraine in April 2014.", "conflict", also=["2014"], sev=1.5)
E("mh17", "2014-07-17", ["NLD", "MYS", "UKR", "RUS", "AUS"], "Malaysia Airlines Flight 17", "Flight MH17 shot down", "Malaysia Airlines Flight 17 was shot down over eastern Ukraine on 17 July 2014.", "tension", major=True)
E("eu_sanctions_russia_2014", "2014-07-29", ["DEU", "FRA", "ITA", "GBR", "POL", "ESP", "NLD"], "International sanctions during the Russo-Ukrainian War", "Sanctions on Russia", "The European Union agreed economic sanctions on Russia in July 2014.", "tension", also=["2014"])
E("isis_caliphate", "2014-06-29", ["IRQ", "SYR"], "Islamic State", "Islamic State declares a caliphate", "The Islamic State declared a worldwide caliphate on 29 June 2014.", "conflict", sev=2.0, major=True)
E("scottish_referendum", "2014-09-18", ["GBR"], "2014 Scottish independence referendum", "Scottish independence referendum", "Scotland voted to remain in the United Kingdom in a referendum on 18 September 2014.", "politics", any_path=False, stab=0.01)
E("ebola_west_africa", "2014-03-23", ["GIN", "LBR", "SLE"], "Western African Ebola virus epidemic", "Ebola epidemic", "The World Health Organization reported an outbreak of Ebola in Guinea in March 2014; it spread to Liberia and Sierra Leone.", "disaster", g=2.0, m=18, also=["2014"], dynamic=True)
E("oil_price_crash_2014", "2014-11-27", ["RUS", "SAU", "IRN", "VEN", "NGA", "NOR"], "2010s oil glut", "Oil price collapse", "Oil prices fell sharply in late 2014 after OPEC decided not to cut production.", "crisis", g=1.5, m=18, u=0.5, also=["2014"])
E("ruble_crisis", "2014-12-16", ["RUS"], "Russian financial crisis (2014–2016)", "Ruble crisis", "The Russian ruble fell sharply in December 2014.", "crisis", g=2.0, m=18, u=0.5, also=["2014"])
E("hong_kong_umbrella", "2014-09-28", ["CHN"], "Umbrella Movement", "Umbrella Movement", "Protesters occupied central Hong Kong from 28 September 2014.", "protest", any_path=False)

# ================================================================== 2015-2019
E("lithuania_euro", "2015-01-01", ["LTU"], "Eurozone", "Lithuania adopts the euro", "Lithuania adopted the euro on 1 January 2015.", "currency")
E("charlie_hebdo", "2015-01-07", ["FRA"], "Charlie Hebdo shooting", "Charlie Hebdo shooting", "Gunmen attacked the offices of the satirical weekly Charlie Hebdo in Paris on 7 January 2015.", "attack", sev=1.3, major=True)
E("nepal_earthquake", "2015-04-25", ["NPL"], "April 2015 Nepal earthquake", "Nepal earthquake", "An earthquake struck Nepal on 25 April 2015.", "disaster", g=2.0, sev=2.0, dynamic=True)
E("minsk_ii", "2015-02-12", ["UKR", "RUS", "DEU", "FRA"], "Minsk agreements", "Minsk II", "The leaders of Russia, Ukraine, France and Germany agreed a package of measures in Minsk on 12 February 2015.", "treaty", also=["February 2015"])
E("greek_referendum_2015", "2015-07-05", ["GRC"], "2015 Greek bailout referendum", "Bailout referendum", "Greek voters rejected the bailout conditions in a referendum on 5 July 2015.", "crisis", g=1.5, m=12, u=1.0)
E("china_stock_crash", "2015-06-12", ["CHN"], "2015–2016 Chinese stock market turbulence", "Stock market crash", "The Chinese stock market bubble burst in June 2015.", "crisis", g=0.8, m=12, u=0.2, also=["2015"])
E("refugee_crisis", "2015-09-04", ["DEU", "AUT", "HUN", "SWE", "GRC", "ITA", "TUR"], "2015 European migrant crisis", "Refugee crisis", "In September 2015 Germany and Austria opened their borders to refugees stranded in Hungary.", "politics", stab=-0.03, also=["2015"], extra=[T("immigration", 0.05, 1095), IG("minorities", 2)], major=True)
E("rus_syria_intervention", "2015-09-30", ["RUS", "SYR"], "Russian intervention in the Syrian civil war", "Intervention in Syria", "Russia began air strikes in Syria on 30 September 2015.", "conflict", any_path=False, sev=0.5)
E("paris_attacks_2015", "2015-11-13", ["FRA", "BEL"], "November 2015 Paris attacks", "Paris attacks", "Coordinated terrorist attacks struck Paris and Saint-Denis on 13 November 2015.", "attack", sev=2.0, major=True)
E("tur_rus_jet", "2015-11-24", ["TUR", "RUS"], "2015 Russian Sukhoi Su-24 shootdown", "Russian jet shot down", "A Turkish F-16 shot down a Russian Su-24 near the Syrian–Turkish border on 24 November 2015.", "tension", major=True)
E("paris_agreement", "2015-12-12", ["FRA", "USA", "CHN", "IND", "DEU", "GBR", "JPN", "BRA", "RUS"], "Paris Agreement", "Paris Agreement", "The Paris Agreement on climate change was adopted on 12 December 2015.", "climate", major=True)
E("brussels_bombings", "2016-03-22", ["BEL"], "2016 Brussels bombings", "Brussels bombings", "Suicide bombers attacked Brussels Airport and a metro station on 22 March 2016.", "attack", sev=1.5)
E("panama_papers", "2016-04-03", ["ISL", "PAN"], "Panama Papers", "Panama Papers", "Leaked documents from the law firm Mossack Fonseca were published from 3 April 2016.", "politics", stab=-0.02)
E("nice_attack", "2016-07-14", ["FRA"], "2016 Nice truck attack", "Nice truck attack", "A truck was driven into crowds on the Promenade des Anglais in Nice on 14 July 2016.", "attack", sev=1.5)
E("rio_olympics", "2016-08-05", ["BRA"], "2016 Summer Olympics", "Rio Olympics", "Rio de Janeiro hosted the Summer Olympics from 5 to 21 August 2016.", "sport")
E("colombia_peace", "2016-11-24", ["COL", "FAR"], "Colombian peace process", "Peace agreement with the FARC", "The Colombian government and the FARC signed a revised peace agreement on 24 November 2016.", "treaty", also=["2016"])
E("berlin_truck_attack", "2016-12-19", ["DEU"], "2016 Berlin truck attack", "Berlin Christmas market attack", "A truck was driven into a Christmas market in Berlin on 19 December 2016.", "attack", sev=1.2)
E("korea_impeachment", "2017-03-10", ["KOR"], "Impeachment of Park Geun-hye", "Constitutional Court ruling", "The Constitutional Court upheld the impeachment of President Park Geun-hye on 10 March 2017, removing her from office.", "politics", any_path=False, stab=-0.03)
E("usa_paris_withdrawal", "2017-06-01", ["USA"], "United States withdrawal from the Paris Agreement", "Leaving the Paris Agreement", "On 1 June 2017 President Donald Trump announced that the United States would withdraw from the Paris Agreement.", "politics", any_path=False, stab=0.0, extra=[T("diplomatic_reputation", -0.03, 1460)])
E("manchester_bombing", "2017-05-22", ["GBR"], "Manchester Arena bombing", "Manchester Arena bombing", "A suicide bomber attacked a concert at Manchester Arena on 22 May 2017.", "attack", sev=1.2)
E("qatar_blockade", "2017-06-05", ["QAT", "SAU", "ARE", "BHR", "EGY"], "Qatar diplomatic crisis", "Blockade of Qatar", "Saudi Arabia, the United Arab Emirates, Bahrain and Egypt cut diplomatic ties with Qatar on 5 June 2017.", "tension")
E("catalan_referendum", "2017-10-01", ["ESP"], "2017 Catalan independence referendum", "Catalan referendum", "A referendum on Catalan independence, declared illegal by the Constitutional Court, was held on 1 October 2017.", "protest", group="minorities", any_path=False, major=True)
E("north_korea_icbm_2017", "2017-07-04", ["PRK", "USA", "JPN", "KOR"], "Hwasong-14", "North Korean ICBM test", "North Korea tested an intercontinental ballistic missile, the Hwasong-14, on 4 July 2017.", "tension")
E("hurricane_maria", "2017-09-20", ["USA", "DMA"], "Hurricane Maria", "Hurricane Maria", "Hurricane Maria struck Dominica and Puerto Rico in September 2017.", "disaster", g=0.2, also=["2017"], dynamic=True)
E("chn_term_limits", "2018-03-11", ["CHN"], "2018 amendment to the Constitution of China", "Constitutional amendment", "On 11 March 2018 the National People's Congress removed the term limits on the presidency.", "reform", any_path=False, extra=[{"add_stability": 0.02}, T("political_power_gain", 0.05, 3650)])
E("skripal_poisoning", "2018-03-04", ["GBR", "RUS"], "Poisoning of Sergei and Yulia Skripal", "Salisbury poisoning", "Sergei and Yulia Skripal were poisoned with a nerve agent in Salisbury on 4 March 2018.", "tension")
E("inter_korean_summit_2018", "2018-04-27", ["KOR", "PRK"], "April 2018 inter-Korean summit", "Inter-Korean summit", "The leaders of North and South Korea met at Panmunjom on 27 April 2018.", "treaty")
E("us_china_trade_war", "2018-07-06", ["USA", "CHN"], "China–United States trade war", "US-China trade war", "The United States imposed tariffs on Chinese goods on 6 July 2018, and China retaliated.", "crisis", g=0.4, m=18, u=0.1)
E("singapore_summit", "2018-06-12", ["USA", "PRK"], "2018 North Korea–United States Singapore Summit", "Singapore summit", "President Donald Trump and Kim Jong Un met in Singapore on 12 June 2018.", "treaty")
E("yellow_vests", "2018-11-17", ["FRA"], "Yellow vests protests", "Yellow vests", "The yellow vests protests began in France on 17 November 2018.", "protest", group="rural")
E("turkish_lira_crisis", "2018-08-10", ["TUR"], "Turkish economic crisis (2018–current)", "Lira crisis", "The Turkish lira fell sharply in August 2018.", "crisis", g=2.0, m=18, u=1.5, also=["2018"])
E("christchurch", "2019-03-15", ["NZL"], "Christchurch mosque shootings", "Christchurch mosque shootings", "A terrorist attacked two mosques in Christchurch on 15 March 2019.", "attack", sev=1.5)
E("notre_dame_fire", "2019-04-15", ["FRA"], "Notre-Dame de Paris fire", "Notre-Dame fire", "A fire badly damaged Notre-Dame de Paris on 15 April 2019.", "disaster", g=0.0, m=1, sev=0.5)
E("sri_lanka_easter", "2019-04-21", ["LKA"], "2019 Sri Lanka Easter bombings", "Easter bombings", "Suicide bombers attacked churches and hotels in Sri Lanka on 21 April 2019.", "attack", sev=1.8)
E("hong_kong_protests_2019", "2019-06-09", ["CHN"], "2019–2020 Hong Kong protests", "Hong Kong protests", "Mass protests against an extradition bill began in Hong Kong in June 2019.", "protest", any_path=False, also=["2019"], major=True)
E("abqaiq_attack", "2019-09-14", ["SAU"], "Abqaiq–Khurais attack", "Attack on Saudi oil facilities", "Drones and missiles struck the Abqaiq and Khurais oil facilities in Saudi Arabia on 14 September 2019.", "energy", g=0.3, m=3, i=0.3, e=0.03)
E("australia_bushfires", "2019-09-01", ["AUS"], "2019–20 Australian bushfire season", "Black Summer bushfires", "Severe bushfires burned across Australia in the 2019-20 season.", "disaster", g=0.2, also=["2019"], dynamic=True)
E("india_article_370", "2019-08-05", ["IND", "PAK"], "Revocation of the special status of Jammu and Kashmir", "Article 370", "On 5 August 2019 India revoked the special status of Jammu and Kashmir.", "tension", any_path=False)

# ================================================================== 2020-2026
E("soleimani_killed", "2020-01-03", ["IRN", "USA", "IRQ"], "Assassination of Qasem Soleimani", "Killing of Qasem Soleimani", "A United States drone strike killed Iranian general Qasem Soleimani in Baghdad on 3 January 2020.", "tension", major=True)
E("covid_lockdowns", "2020-03-23", ["GBR", "FRA", "ITA", "ESP", "DEU", "USA", "IND"], "COVID-19 lockdowns", "Lockdowns", "Governments across the world ordered lockdowns to slow the spread of COVID-19 in March 2020.", "crisis", g=3.0, m=12, u=3.0, also=["March 2020"], dynamic=True)
E("oil_negative_2020", "2020-04-20", ["USA", "RUS", "SAU", "NOR", "IRN"], "2020 Russia–Saudi Arabia oil price war", "Oil price collapse", "The price of West Texas Intermediate oil futures fell below zero on 20 April 2020.", "crisis", g=1.0, m=12, u=0.5, also=["April 2020"])
E("beirut_explosion", "2020-08-04", ["LBN"], "2020 Beirut explosion", "Beirut port explosion", "A large amount of ammonium nitrate exploded in the port of Beirut on 4 August 2020.", "disaster", g=2.0, sev=2.0)
E("belarus_protests", "2020-08-09", ["BLR"], "2020–2021 Belarusian protests", "Protests in Belarus", "Mass protests broke out in Belarus after the presidential election of 9 August 2020.", "protest", any_path=False, major=True)
E("hk_security_law", "2020-06-30", ["CHN"], "2020 Hong Kong national security law", "Hong Kong security law", "The Hong Kong national security law took effect on 30 June 2020.", "reform", any_path=False, extra=[T("internal_security", 0.05, 3650), T("international_opinion", -0.05, 1825)])
E("nagorno_karabakh_2020", "2020-09-27", ["ARM", "AZE", "NKR", "TUR", "RUS"], "Second Nagorno-Karabakh War", "War over Nagorno-Karabakh", "Fighting between Azerbaijan and Armenian forces in Nagorno-Karabakh began on 27 September 2020.", "conflict", sev=1.5, major=True)
E("covid_vaccines", "2020-12-08", ["GBR", "USA", "DEU"], "COVID-19 vaccine", "First vaccinations", "The first COVID-19 vaccinations outside trials began in the United Kingdom on 8 December 2020.", "science")
E("brexit_transition_end", "2020-12-31", ["GBR"], "Brexit", "End of the transition period", "The Brexit transition period ended on 31 December 2020.", "politics", any_path=False, stab=-0.01, extra=[T("trade_efficiency", -0.03, 1825)])
E("capitol_attack", "2021-01-06", ["USA"], "January 6 United States Capitol attack", "Attack on the Capitol", "A mob attacked the United States Capitol on 6 January 2021 as Congress met to count the electoral votes.", "politics", stab=-0.05, major=True)
E("myanmar_coup_2021", "2021-02-01", ["MMR"], "2021 Myanmar coup d'état", "Coup in Myanmar", "The military of Myanmar seized power on 1 February 2021.", "politics", any_path=False, stab=-0.08)
E("suez_blockage", "2021-03-23", ["EGY", "NLD", "DEU", "CHN"], "2021 Suez Canal obstruction", "Suez Canal blocked", "The container ship Ever Given blocked the Suez Canal from 23 to 29 March 2021.", "energy", g=0.05, m=2, i=0.1, e=0.01)
E("tokyo_olympics", "2021-07-23", ["JPN"], "2020 Summer Olympics", "Tokyo Olympics", "Tokyo hosted the 2020 Summer Olympics, postponed by the pandemic, from 23 July to 8 August 2021.", "sport")
E("deu_flood_2021", "2021-07-14", ["DEU", "BEL", "NLD"], "2021 European floods", "Floods in western Europe", "Severe floods hit Germany, Belgium and neighbouring countries in July 2021.", "disaster", g=0.2, also=["2021"], dynamic=True)
E("energy_crisis_2021", "2021-10-01", ["DEU", "GBR", "ITA", "ESP", "FRA", "NLD", "POL"], "2021–2023 global energy crisis", "Energy crisis", "Gas and electricity prices in Europe rose to record levels in late 2021.", "energy", g=0.4, m=12, i=2.0, e=0.1, also=["2021"])
E("beijing_winter_olympics", "2022-02-04", ["CHN"], "2022 Winter Olympics", "Beijing Winter Olympics", "Beijing hosted the Winter Olympics from 4 to 20 February 2022.", "sport")
E("sanctions_russia_2022", "2022-02-26", ["DEU", "FRA", "GBR", "ITA", "USA", "JPN", "POL", "ESP", "NLD", "SWE", "NOR"], "International sanctions during the Russo-Ukrainian War", "Sanctions on Russia", "Western countries imposed wide-ranging sanctions on Russia after the invasion of Ukraine in February 2022.", "energy", g=0.4, m=12, i=1.5, e=0.08, also=["2022"])
E("inflation_2022", "2022-06-15", ["USA", "GBR", "DEU", "FRA", "ITA", "ESP", "POL", "TUR"], "2021–2023 inflation surge", "Inflation and rate rises", "Central banks raised interest rates sharply in 2022 as inflation rose to its highest level in decades.", "crisis", g=0.5, m=12, u=0.3, also=["2022"])
E("abe_assassination", "2022-07-08", ["JPN"], "Assassination of Shinzo Abe", "Assassination of Shinzo Abe", "Former Prime Minister Shinzo Abe was shot and killed in Nara on 8 July 2022.", "attack", sev=1.2, major=True)
E("elizabeth_ii_death", "2022-09-08", ["GBR", "CAN", "AUS", "NZL"], "Death and state funeral of Elizabeth II", "Death of Queen Elizabeth II", "Queen Elizabeth II died at Balmoral on 8 September 2022.", "politics", stab=0.0, major=True)
E("nord_stream_sabotage", "2022-09-26", ["DEU", "RUS", "DNK", "SWE"], "Nord Stream pipeline sabotage", "Nord Stream pipelines damaged", "Explosions damaged the Nord Stream gas pipelines in the Baltic Sea on 26 September 2022.", "tension")
E("iran_protests_2022", "2022-09-16", ["IRN"], "Mahsa Amini protests", "Protests in Iran", "Protests broke out across Iran in September 2022.", "protest", group="youth_students", any_path=False, also=["2022"], major=True)
E("world_cup_2022", "2022-11-20", ["QAT"], "2022 FIFA World Cup", "World Cup in Qatar", "Qatar hosted the FIFA World Cup from 20 November to 18 December 2022.", "sport")
E("turkey_syria_earthquake", "2023-02-06", ["TUR", "SYR"], "2023 Turkey–Syria earthquakes", "Turkey–Syria earthquakes", "Two powerful earthquakes struck southern Turkey and northern Syria on 6 February 2023.", "disaster", g=1.0, m=12, sev=2.5, dynamic=True, major=True)
E("svb_collapse", "2023-03-10", ["USA", "CHE"], "Collapse of Silicon Valley Bank", "Bank failures", "Silicon Valley Bank failed on 10 March 2023, followed by other bank failures.", "crisis", g=0.2, m=6, u=0.1)
E("fra_pension_reform_2023", "2023-03-16", ["FRA"], "2023 French pension reform strikes", "Pension reform", "The French government passed a pension reform raising the retirement age in March 2023, prompting strikes and protests.", "protest", group="labour_unions", any_path=False, also=["2023"])
E("finland_joins_note", "2023-04-04", ["RUS"], "Finland–NATO relations", "Finland in NATO", "Finland joined NATO on 4 April 2023, doubling the length of NATO's land border with Russia.", "tension", also=["4 April 2023"])
E("wagner_rebellion", "2023-06-23", ["RUS"], "Wagner Group rebellion", "Wagner rebellion", "The Wagner Group mutinied and marched toward Moscow on 23 and 24 June 2023 before standing down.", "politics", any_path=False, stab=-0.05)
E("october_7_attack", "2023-10-07", ["ISR", "PSE"], "October 7 attacks", "Attacks of 7 October", "Hamas-led militants attacked Israel from the Gaza Strip on 7 October 2023; the Gaza war followed.", "conflict", sev=2.5, major=True)
E("red_sea_attacks", "2023-11-19", ["YEM", "EGY", "SAU"], "Red Sea crisis", "Red Sea shipping attacks", "Houthi forces began attacking shipping in the Red Sea in November 2023.", "energy", g=0.1, m=9, i=0.2, e=0.02, also=["2023"])
E("paris_olympics_2024", "2024-07-26", ["FRA"], "2024 Summer Olympics", "Paris Olympics", "Paris hosted the Summer Olympics from 26 July to 11 August 2024.", "sport")
E("crowdstrike_outage", "2024-07-19", ["USA", "GBR", "DEU", "AUS"], "2024 CrowdStrike-related IT outages", "Global IT outage", "A faulty software update caused computer outages worldwide on 19 July 2024.", "disaster", g=0.05, m=1, sev=0.4)
E("syria_assad_falls", "2024-12-08", ["SYR", "TUR", "RUS", "IRN"], "Fall of the Assad regime", "Fall of the Assad government", "Rebel forces took Damascus on 8 December 2024, ending the rule of Bashar al-Assad.", "politics", stab=-0.02, major=True)
E("kor_martial_law", "2024-12-03", ["KOR"], "2024 South Korean martial law crisis", "Martial law crisis", "President Yoon Suk Yeol declared martial law on 3 December 2024; the National Assembly voted to lift it within hours.", "politics", any_path=False, stab=-0.05)
E("pope_francis_death", "2025-04-21", ["ITA", "VAT", "ARG"], "Death and funeral of Pope Francis", "Death of Pope Francis", "Pope Francis died on 21 April 2025.", "politics", stab=-0.01)
E("iberian_blackout", "2025-04-28", ["ESP", "PRT"], "2025 Iberian Peninsula blackout", "Iberian blackout", "A power outage hit Spain and Portugal on 28 April 2025.", "disaster", g=0.05, m=1)
E("israel_iran_war", "2025-06-13", ["ISR", "IRN", "USA"], "Twelve-Day War", "War between Israel and Iran", "Israel struck targets in Iran on 13 June 2025, beginning a war between the two countries.", "conflict", sev=1.5, major=True)
E("bulgaria_euro_2026", "2026-01-01", ["BGR"], "Eurozone", "Bulgaria adopts the euro", "Bulgaria adopted the euro on 1 January 2026.", "currency")
E("milan_cortina_olympics", "2026-02-06", ["ITA"], "2026 Winter Olympics", "Milan–Cortina Winter Olympics", "Milan and Cortina d'Ampezzo hosted the Winter Olympics from 6 to 22 February 2026.", "sport")
E("world_cup_2026", "2026-06-11", ["USA", "CAN", "MEX"], "2026 FIFA World Cup", "World Cup in North America", "The United States, Canada and Mexico hosted the FIFA World Cup from 11 June 2026.", "sport")


# ================================================================== batch 2
E("isr_leaves_lebanon", "2000-05-24", ["ISR", "LBN"], "South Lebanon conflict (1985–2000)", "Withdrawal from southern Lebanon", "Israel withdrew its forces from southern Lebanon on 24 May 2000.", "politics", any_path=False, stab=0.01)
E("inter_korean_summit_2000", "2000-06-13", ["KOR", "PRK"], "2000 inter-Korean summit", "Inter-Korean summit", "The leaders of South and North Korea met in Pyongyang from 13 to 15 June 2000.", "treaty")
E("fiji_coup_2000", "2000-05-19", ["FJI"], "2000 Fijian coup d'état", "Coup in Fiji", "Armed men seized the Parliament of Fiji on 19 May 2000.", "politics", any_path=False, stab=-0.06)
E("operation_palliser", "2000-05-07", ["GBR", "SLE"], "Operation Palliser", "Operation Palliser", "British forces deployed to Sierra Leone in May 2000.", "conflict", sev=0.4, also=["2000"])
E("iloveyou_virus", "2000-05-04", ["USA", "PHL", "GBR"], "ILOVEYOU", "ILOVEYOU virus", "The ILOVEYOU computer worm spread around the world from 4 May 2000.", "disaster", g=0.02, m=1, sev=0.3)
E("wikipedia_launch", "2001-01-15", ["USA"], "Wikipedia", "Wikipedia launches", "Wikipedia was launched on 15 January 2001.", "science")
E("nepal_royal_massacre", "2001-06-01", ["NPL"], "Nepalese royal massacre", "Royal massacre", "King Birendra and several members of the Nepalese royal family were killed at the palace on 1 June 2001.", "politics", stab=-0.08)
E("genoa_g8", "2001-07-20", ["ITA"], "27th G8 summit", "Genoa G8 summit", "The G8 summit in Genoa from 20 to 22 July 2001 was met by mass protests.", "protest", group="youth_students")
E("massoud_killed", "2001-09-09", ["AFN", "AFG"], "Ahmad Shah Massoud", "Assassination of Ahmad Shah Massoud", "Ahmad Shah Massoud, commander of the Northern Alliance, was killed by suicide bombers on 9 September 2001.", "attack", sev=1.0)
E("enron_bankruptcy", "2001-12-02", ["USA"], "Enron scandal", "Enron bankruptcy", "Enron filed for bankruptcy on 2 December 2001.", "crisis", g=0.2, m=6, u=0.1)
E("indian_parliament_attack", "2001-12-13", ["IND", "PAK"], "2001 Indian Parliament attack", "Attack on the Indian Parliament", "Militants attacked the Parliament of India in New Delhi on 13 December 2001.", "attack", sev=1.2)
E("guantanamo_opens", "2002-01-11", ["USA", "CUB"], "Guantanamo Bay detention camp", "Guantanamo detention camp", "The first detainees arrived at the Guantanamo Bay detention camp on 11 January 2002.", "reform", any_path=False, extra=[T("internal_security", 0.03, 1825), T("international_opinion", -0.02, 1825)])
E("venezuela_coup_attempt", "2002-04-11", ["VEN"], "2002 Venezuelan coup attempt", "Coup attempt in Venezuela", "President Hugo Chávez was briefly removed from power on 11 April 2002 and restored two days later.", "politics", any_path=False, stab=-0.05)
E("fra_le_pen_runoff", "2002-04-21", ["FRA"], "2002 French presidential election", "Shock first round", "In the first round of the presidential election on 21 April 2002, Jean-Marie Le Pen came second and reached the runoff.", "politics", any_path=False, stab=-0.02)
E("prestige_spill", "2002-11-13", ["ESP"], "Prestige oil spill", "Prestige oil spill", "The oil tanker Prestige broke up off the coast of Galicia in November 2002.", "disaster", g=0.05, also=["2002"])
E("casablanca_bombings", "2003-05-16", ["MAR"], "2003 Casablanca bombings", "Casablanca bombings", "Suicide bombers attacked several sites in Casablanca on 16 May 2003.", "attack", sev=1.0)
E("riyadh_bombings_2003", "2003-05-12", ["SAU", "USA"], "Riyadh compound bombings", "Riyadh compound bombings", "Suicide bombers attacked residential compounds in Riyadh on 12 May 2003.", "attack", sev=0.8)
E("human_genome", "2003-04-14", ["USA", "GBR"], "Human Genome Project", "Human Genome Project completed", "The completion of the Human Genome Project was announced in April 2003.", "science", also=["2003"])
E("swe_euro_referendum", "2003-09-14", ["SWE"], "2003 Swedish euro referendum", "Euro referendum", "Swedish voters rejected adopting the euro in a referendum on 14 September 2003.", "politics", any_path=False, stab=0.0)
E("concorde_retired", "2003-10-24", ["GBR", "FRA"], "Concorde", "Concorde retired", "Concorde made its last commercial flight on 24 October 2003.", "politics", stab=0.0, also=["2003"])
E("liberia_taylor_exile", "2003-08-11", ["LBR"], "Second Liberian Civil War", "End of the Liberian civil war", "Charles Taylor resigned as President of Liberia in August 2003 and went into exile.", "politics", any_path=False, stab=0.03, also=["2003"])
E("facebook_launch", "2004-02-04", ["USA"], "Facebook", "Facebook launches", "Facebook was launched on 4 February 2004.", "science")
E("haiti_2004", "2004-02-29", ["HTI"], "2004 Haitian coup d'état", "Aristide leaves Haiti", "President Jean-Bertrand Aristide left Haiti on 29 February 2004.", "politics", any_path=False, stab=-0.05)
E("arafat_death", "2004-11-11", ["PSE"], "Death of Yasser Arafat", "Death of Yasser Arafat", "Yasser Arafat died on 11 November 2004.", "politics", stab=-0.03, major=True)
E("youtube_launch", "2005-02-14", ["USA"], "YouTube", "YouTube launches", "YouTube was founded on 14 February 2005.", "science")
E("pope_benedict", "2005-04-19", ["VAT", "DEU", "ITA"], "Pope Benedict XVI", "Election of Pope Benedict XVI", "Cardinal Joseph Ratzinger was elected Pope on 19 April 2005 and took the name Benedict XVI.", "politics", stab=0.01)
E("andijan", "2005-05-13", ["UZB"], "Andijan massacre", "Andijan unrest", "Security forces opened fire on protesters in Andijan, Uzbekistan, on 13 May 2005.", "protest", any_path=False)
E("sharm_bombings", "2005-07-23", ["EGY"], "2005 Sharm El Sheikh bombings", "Sharm El Sheikh bombings", "Bombs exploded in the Egyptian resort of Sharm El Sheikh on 23 July 2005.", "attack", sev=1.0)
E("amman_bombings", "2005-11-09", ["JOR"], "2005 Amman bombings", "Amman hotel bombings", "Suicide bombers attacked three hotels in Amman on 9 November 2005.", "attack", sev=1.0)
E("bali_2005", "2005-10-01", ["IDN", "AUS"], "2005 Bali bombings", "Second Bali bombings", "Suicide bombers attacked tourist sites in Bali on 1 October 2005.", "attack", sev=0.8)
E("samarra_bombing", "2006-02-22", ["IRQ"], "2006 al-Askari mosque bombing", "Al-Askari mosque bombing", "The al-Askari Shrine in Samarra was bombed on 22 February 2006.", "attack", sev=1.5)
E("twitter_launch", "2006-03-21", ["USA"], "Twitter", "Twitter launches", "The first message was posted on Twitter on 21 March 2006.", "science", also=["March 2006"])
E("java_earthquake", "2006-05-27", ["IDN"], "2006 Yogyakarta earthquake", "Yogyakarta earthquake", "An earthquake struck the Yogyakarta region of Java on 27 May 2006.", "disaster", g=0.3, dynamic=True)
E("mexico_drug_war", "2006-12-11", ["MEX"], "Mexican drug war", "Offensive against the cartels", "The Mexican government deployed troops against drug cartels in Michoacán in December 2006.", "conflict", any_path=False, also=["2006"])
E("litvinenko", "2006-11-23", ["GBR", "RUS"], "Poisoning of Alexander Litvinenko", "Litvinenko poisoning", "Alexander Litvinenko died in London on 23 November 2006 after being poisoned with polonium-210.", "tension")
E("saddam_executed", "2006-12-30", ["IRQ", "USA"], "Execution of Saddam Hussein", "Execution of Saddam Hussein", "Saddam Hussein was executed in Baghdad on 30 December 2006.", "politics", stab=-0.02)
E("iphone", "2007-01-09", ["USA"], "IPhone (1st generation)", "The iPhone", "Apple introduced the iPhone on 9 January 2007.", "science")
E("algiers_bombings_2007", "2007-04-11", ["DZA"], "11 April 2007 Algiers bombings", "Algiers bombings", "Suicide bombers attacked the Prime Minister's office and a police station in Algiers on 11 April 2007.", "attack", sev=0.8)
E("glasgow_airport_attack", "2007-06-30", ["GBR"], "2007 Glasgow Airport attack", "Glasgow Airport attack", "A car loaded with gas canisters was driven into Glasgow Airport on 30 June 2007.", "attack", sev=0.5)
E("saffron_revolution", "2007-08-15", ["MMR"], "2007 Myanmar anti-government protests", "Saffron Revolution", "Protests led by Buddhist monks spread across Myanmar in August and September 2007.", "protest", any_path=False, also=["2007"])
E("pak_emergency_2007", "2007-11-03", ["PAK"], "2007 Pakistani state of emergency", "State of emergency", "President Pervez Musharraf declared a state of emergency in Pakistan on 3 November 2007.", "politics", any_path=False, stab=-0.04)
E("castro_steps_down", "2008-02-19", ["CUB"], "Fidel Castro", "Fidel Castro steps down", "Fidel Castro announced on 19 February 2008 that he would not accept another term as President of Cuba.", "politics", any_path=False, stab=0.0)
E("lhc_start", "2008-09-10", ["CHE", "FRA"], "Large Hadron Collider", "Large Hadron Collider", "The Large Hadron Collider at CERN first circulated a beam on 10 September 2008.", "science")
E("greek_riots_2008", "2008-12-06", ["GRC"], "2008 Greek riots", "Riots in Greece", "Riots broke out in Greece after a teenager was shot by police in Athens on 6 December 2008.", "protest", group="youth_students")
E("zimbabwe_hyperinflation", "2008-11-14", ["ZWE"], "Hyperinflation in Zimbabwe", "Hyperinflation", "Inflation in Zimbabwe reached its peak in November 2008.", "crisis", g=6.0, m=18, u=5.0, also=["2008"])
E("air_france_447", "2009-06-01", ["FRA", "BRA"], "Air France Flight 447", "Air France Flight 447", "Air France Flight 447 from Rio de Janeiro to Paris crashed into the Atlantic Ocean on 1 June 2009.", "disaster", g=0.0, m=1, sev=0.5)
E("sri_lanka_war_ends", "2009-05-18", ["LKA", "TEL"], "Sri Lankan Civil War", "End of the Sri Lankan civil war", "The Sri Lankan government declared victory over the Tamil Tigers in May 2009.", "politics", any_path=False, stab=0.05, also=["May 2009"])
E("north_korea_test_2009", "2009-05-25", ["PRK", "KOR", "JPN", "USA"], "2009 North Korean nuclear test", "Second North Korean nuclear test", "North Korea conducted a second nuclear test on 25 May 2009.", "tension")
E("honduras_coup", "2009-06-28", ["HND"], "2009 Honduran coup d'état", "Coup in Honduras", "The Honduran army removed President Manuel Zelaya from office on 28 June 2009.", "politics", any_path=False, stab=-0.06)
E("urumqi_riots", "2009-07-05", ["CHN"], "July 2009 Ürümqi riots", "Ürümqi riots", "Riots broke out in Ürümqi, Xinjiang, on 5 July 2009.", "protest", group="minorities")
E("kyrgyz_revolution_2010", "2010-04-07", ["KGZ"], "2010 Kyrgyz Revolution", "Revolution in Kyrgyzstan", "Protesters stormed government buildings in Bishkek on 7 April 2010 and President Kurmanbek Bakiyev fled.", "protest", any_path=False)
E("thai_protests_2010", "2010-03-12", ["THA"], "2010 Thai political protests", "Protests in Bangkok", "Anti-government protesters occupied central Bangkok from March to May 2010.", "protest", any_path=False, also=["2010"])
E("russia_wildfires_2010", "2010-07-29", ["RUS"], "2010 Russian wildfires", "Russian wildfires and heatwave", "Hundreds of wildfires burned across Russia in the summer of 2010.", "disaster", g=0.6, also=["2010"], dynamic=True)
E("pakistan_floods_2010", "2010-07-26", ["PAK"], "2010 Pakistan floods", "Pakistan floods", "Monsoon floods inundated large parts of Pakistan from late July 2010.", "disaster", g=1.5, also=["2010"], dynamic=True)
E("chile_miners", "2010-10-13", ["CHL"], "2010 Copiapó mining accident", "Rescue of the trapped miners", "The 33 miners trapped in the San José mine were rescued on 13 October 2010.", "science", also=["33"])
E("cablegate", "2010-11-28", ["USA"], "United States diplomatic cables leak", "Diplomatic cables leak", "WikiLeaks began publishing United States diplomatic cables on 28 November 2010.", "tension")
E("bahrain_uprising", "2011-02-14", ["BHR", "SAU"], "Bahraini uprising of 2011", "Uprising in Bahrain", "Protests began in Bahrain on 14 February 2011.", "protest", any_path=False)
E("spain_15m", "2011-05-15", ["ESP"], "15-M Movement", "15-M movement", "Mass protests against austerity began in Spanish cities on 15 May 2011.", "protest", group="youth_students")
E("portugal_bailout", "2011-04-06", ["PRT"], "2010–2014 Portuguese financial crisis", "Portuguese bailout request", "Portugal requested financial assistance from the European Union in April 2011.", "crisis", g=1.5, m=24, u=2.0, also=["2011"])
E("gaddafi_killed", "2011-10-20", ["LBY"], "Killing of Muammar Gaddafi", "Death of Muammar Gaddafi", "Muammar Gaddafi was captured and killed near Sirte on 20 October 2011.", "politics", stab=-0.02)
E("ita_berlusconi_resigns", "2011-11-12", ["ITA"], "Fourth Berlusconi government", "Government resigns amid debt crisis", "Silvio Berlusconi resigned as Prime Minister on 12 November 2011 during the European debt crisis.", "crisis", g=0.8, m=12, u=0.6)
E("rus_protests_2011", "2011-12-10", ["RUS"], "2011–2013 Russian protests", "Protests in Moscow", "Large protests over the parliamentary election results took place in Moscow on 10 December 2011.", "protest", group="urban_middle_class", any_path=False)
E("iraq_us_withdrawal", "2011-12-18", ["USA", "IRQ"], "Withdrawal of United States troops from Iraq (2007–2011)", "US forces leave Iraq", "The last United States troops left Iraq on 18 December 2011.", "politics", any_path=False, stab=0.02, extra=[{"add_war_support": -0.03}])
E("mali_conflict_2012", "2012-01-17", ["MLI"], "Mali War", "Rebellion in northern Mali", "A rebellion began in northern Mali in January 2012.", "conflict", also=["2012"], sev=1.5)
E("spain_bank_bailout", "2012-06-09", ["ESP"], "2008–2014 Spanish financial crisis", "Bank rescue", "The eurozone agreed in June 2012 to lend Spain money to recapitalise its banks.", "crisis", g=1.0, m=12, u=1.5, also=["2012"])
E("higgs_boson", "2012-07-04", ["CHE", "FRA", "GBR"], "Higgs boson", "Higgs boson discovered", "CERN announced the discovery of a particle consistent with the Higgs boson on 4 July 2012.", "science")
E("curiosity_landing", "2012-08-06", ["USA"], "Curiosity (rover)", "Curiosity lands on Mars", "NASA's Curiosity rover landed on Mars on 6 August 2012.", "science")
E("benghazi_attack", "2012-09-11", ["USA", "LBY"], "2012 Benghazi attack", "Benghazi attack", "The United States diplomatic compound in Benghazi was attacked on 11 September 2012.", "attack", sev=0.6)
E("senkaku_purchase", "2012-09-11", ["JPN", "CHN"], "Senkaku Islands dispute", "Senkaku Islands purchase", "The Japanese government bought three of the Senkaku Islands from a private owner in September 2012, and anti-Japanese protests followed in China.", "tension", also=["2012"])
E("operation_serval", "2013-01-11", ["FRA", "MLI"], "Operation Serval", "Operation Serval", "France began a military intervention in Mali on 11 January 2013.", "conflict", sev=0.5)
E("chelyabinsk_meteor", "2013-02-15", ["RUS"], "Chelyabinsk meteor", "Chelyabinsk meteor", "A meteor exploded over Chelyabinsk, Russia, on 15 February 2013.", "disaster", g=0.0, m=1, sev=0.3)
E("pope_francis_elected", "2013-03-13", ["VAT", "ARG", "ITA"], "Pope Francis", "Election of Pope Francis", "Cardinal Jorge Mario Bergoglio was elected Pope on 13 March 2013 and took the name Francis.", "politics", stab=0.01)
E("cyprus_bailout", "2013-03-25", ["CYP"], "2012–2013 Cypriot financial crisis", "Cypriot bailout", "Cyprus agreed a rescue package with the eurozone on 25 March 2013 that imposed losses on large bank deposits.", "crisis", g=3.0, m=24, u=3.0)
E("ghouta_attack", "2013-08-21", ["SYR", "USA", "FRA", "GBR", "RUS"], "Ghouta chemical attack", "Chemical attack in Ghouta", "A chemical weapons attack struck Ghouta near Damascus on 21 August 2013.", "tension", major=True)
E("westgate_attack", "2013-09-21", ["KEN"], "Westgate shopping mall attack", "Westgate mall attack", "Gunmen attacked the Westgate shopping mall in Nairobi on 21 September 2013.", "attack", sev=1.0)
E("iran_interim_deal", "2013-11-24", ["IRN", "USA", "GBR", "FRA", "DEU", "RUS", "CHN"], "Joint Plan of Action", "Interim nuclear agreement", "Iran and the P5+1 agreed an interim deal on Iran's nuclear programme in Geneva on 24 November 2013.", "treaty")
E("change_3", "2013-12-14", ["CHN"], "Chang'e 3", "Chang'e 3 lands on the Moon", "China's Chang'e 3 landed on the Moon on 14 December 2013.", "science")
E("chibok_kidnapping", "2014-04-14", ["NGA"], "Chibok schoolgirls kidnapping", "Chibok kidnapping", "Boko Haram kidnapped schoolgirls from Chibok, Nigeria, on 14 April 2014.", "attack", sev=1.0)
E("sewol_ferry", "2014-04-16", ["KOR"], "Sinking of MV Sewol", "Sewol ferry disaster", "The ferry Sewol capsized off South Korea on 16 April 2014.", "disaster", g=0.05, m=3, sev=1.0)
E("thai_coup_2014", "2014-05-22", ["THA"], "2014 Thai coup d'état", "Coup in Thailand", "The Royal Thai Armed Forces seized power on 22 May 2014.", "politics", any_path=False, stab=-0.05)
E("gaza_war_2014", "2014-07-08", ["ISR", "PSE"], "2014 Gaza War", "Gaza War", "Israel began a military operation in the Gaza Strip on 8 July 2014.", "conflict", any_path=False, sev=1.2)
E("philae_landing", "2014-11-12", ["DEU", "FRA", "ITA"], "Philae (spacecraft)", "Philae lands on a comet", "The Philae lander touched down on comet 67P on 12 November 2014.", "science")
E("germanwings", "2015-03-24", ["DEU", "FRA", "ESP"], "Germanwings Flight 9525", "Germanwings Flight 9525", "Germanwings Flight 9525 crashed in the French Alps on 24 March 2015.", "disaster", g=0.0, m=1, sev=0.5)
E("sousse_attack", "2015-06-26", ["TUN", "GBR"], "2015 Sousse attacks", "Sousse beach attack", "A gunman attacked tourists at a beach resort near Sousse, Tunisia, on 26 June 2015.", "attack", sev=1.0)
E("tianjin_explosions", "2015-08-12", ["CHN"], "2015 Tianjin explosions", "Tianjin port explosions", "Explosions destroyed part of the port of Tianjin on 12 August 2015.", "disaster", g=0.05, m=3)
E("vw_emissions", "2015-09-18", ["DEU", "USA"], "Volkswagen emissions scandal", "Volkswagen emissions violations", "On 18 September 2015 the United States Environmental Protection Agency issued a notice of violation to Volkswagen over vehicle emissions.", "crisis", g=0.2, m=6, u=0.1)
E("ankara_bombings_2015", "2015-10-10", ["TUR"], "2015 Ankara bombings", "Ankara bombings", "Two suicide bombs exploded at a peace rally in Ankara on 10 October 2015.", "attack", sev=1.3)
E("metrojet_9268", "2015-10-31", ["RUS", "EGY"], "Metrojet Flight 9268", "Metrojet Flight 9268", "A Russian airliner, Metrojet Flight 9268, broke up over the Sinai Peninsula on 31 October 2015.", "attack", sev=1.0)
E("zika_emergency", "2016-02-01", ["BRA"], "2015–2016 Zika virus epidemic", "Zika emergency", "The World Health Organization declared the Zika virus outbreak a public health emergency on 1 February 2016.", "disaster", g=0.2, dynamic=True)
E("alphago", "2016-03-15", ["KOR", "GBR"], "AlphaGo versus Lee Sedol", "AlphaGo defeats Lee Sedol", "The AlphaGo program won its Go match against Lee Sedol in Seoul in March 2016.", "science", also=["March 2016"])
E("istanbul_airport_attack", "2016-06-28", ["TUR"], "2016 Atatürk Airport attack", "Istanbul airport attack", "Suicide bombers attacked Atatürk Airport in Istanbul on 28 June 2016.", "attack", sev=1.3)
E("india_demonetisation", "2016-11-08", ["IND"], "2016 Indian banknote demonetisation", "Demonetisation", "India withdrew its 500 and 1,000 rupee banknotes on 8 November 2016.", "crisis", g=0.8, m=6, u=0.3, also=["500"])
E("ita_referendum_2016", "2016-12-04", ["ITA"], "2016 Italian constitutional referendum", "Constitutional referendum", "Italian voters rejected a constitutional reform in a referendum on 4 December 2016.", "politics", any_path=False, stab=-0.03)
E("usa_travel_ban", "2017-01-27", ["USA"], "Executive Order 13769", "Travel restrictions", "President Donald Trump signed an executive order restricting entry from seven countries on 27 January 2017.", "reform", any_path=False, extra=[T("immigration", -0.05, 1460), T("international_opinion", -0.02, 1460)])
E("westminster_attack", "2017-03-22", ["GBR"], "2017 Westminster attack", "Westminster attack", "An attacker drove into pedestrians on Westminster Bridge and stabbed a police officer at Parliament on 22 March 2017.", "attack", sev=0.8)
E("stockholm_truck_attack", "2017-04-07", ["SWE"], "2017 Stockholm truck attack", "Stockholm truck attack", "A truck was driven into crowds on Drottninggatan in Stockholm on 7 April 2017.", "attack", sev=1.0)
E("wannacry", "2017-05-12", ["GBR", "RUS", "ESP", "CHN"], "WannaCry ransomware attack", "WannaCry attack", "The WannaCry ransomware attack spread worldwide from 12 May 2017.", "disaster", g=0.05, m=2, sev=0.5)
E("grenfell", "2017-06-14", ["GBR"], "Grenfell Tower fire", "Grenfell Tower fire", "A fire destroyed Grenfell Tower in London on 14 June 2017.", "disaster", g=0.0, m=1, sev=0.8)
E("mosul_retaken", "2017-07-10", ["IRQ"], "Battle of Mosul (2016–2017)", "Mosul retaken", "Iraqi forces declared victory over the Islamic State in Mosul in July 2017.", "politics", stab=0.03, also=["July 2017"])
E("barcelona_attack", "2017-08-17", ["ESP"], "2017 Barcelona attacks", "Barcelona attacks", "A van was driven into pedestrians on La Rambla in Barcelona on 17 August 2017.", "attack", sev=1.2)
E("hurricane_harvey", "2017-08-25", ["USA"], "Hurricane Harvey", "Hurricane Harvey", "Hurricane Harvey made landfall in Texas on 25 August 2017.", "disaster", g=0.2, dynamic=True)
E("rohingya_crisis", "2017-08-25", ["MMR", "BGD"], "Rohingya genocide", "Rohingya refugee crisis", "From 25 August 2017 hundreds of thousands of Rohingya fled Myanmar's Rakhine State to Bangladesh.", "tension")
E("zimbabwe_2017", "2017-11-21", ["ZWE"], "2017 Zimbabwean coup d'état", "Mugabe resigns", "Robert Mugabe resigned as President of Zimbabwe on 21 November 2017 after the army took control.", "politics", any_path=False, stab=-0.02)
E("armenia_revolution", "2018-04-23", ["ARM"], "2018 Armenian Revolution", "Velvet Revolution", "Prime Minister Serzh Sargsyan resigned on 23 April 2018 after mass protests in Armenia.", "protest", any_path=False)
E("us_embassy_jerusalem", "2018-05-14", ["USA", "ISR", "PSE"], "Embassy of the United States, Jerusalem", "US embassy moves to Jerusalem", "The United States opened its embassy in Jerusalem on 14 May 2018.", "tension", any_path=False)
E("ethiopia_eritrea_peace", "2018-07-09", ["ETH", "ERI"], "2018 Eritrea–Ethiopia summit", "Ethiopia–Eritrea peace", "Ethiopia and Eritrea declared an end to their state of war on 9 July 2018.", "treaty")
E("genoa_bridge", "2018-08-14", ["ITA"], "Ponte Morandi", "Genoa bridge collapse", "Part of the Ponte Morandi in Genoa collapsed on 14 August 2018.", "disaster", g=0.05, m=3)
E("khashoggi", "2018-10-02", ["SAU", "TUR", "USA"], "Assassination of Jamal Khashoggi", "Killing of Jamal Khashoggi", "Journalist Jamal Khashoggi was killed in the Saudi consulate in Istanbul on 2 October 2018.", "tension")
E("kerch_incident", "2018-11-25", ["UKR", "RUS"], "Kerch Strait incident", "Kerch Strait incident", "Russian forces seized three Ukrainian naval vessels in the Kerch Strait on 25 November 2018.", "tension")
E("venezuela_crisis_2019", "2019-01-23", ["VEN", "USA"], "Venezuelan presidential crisis", "Presidential crisis", "On 23 January 2019 National Assembly leader Juan Guaidó declared himself acting President of Venezuela.", "politics", any_path=False, stab=-0.05)
E("pulwama", "2019-02-14", ["IND", "PAK"], "2019 Pulwama attack", "Pulwama attack", "A suicide bomber attacked a convoy of Indian security personnel in Pulwama on 14 February 2019.", "attack", sev=1.0)
E("balakot", "2019-02-26", ["IND", "PAK"], "2019 Balakot airstrike", "Balakot airstrike", "Indian aircraft struck targets near Balakot, Pakistan, on 26 February 2019.", "tension")
E("ethiopian_302", "2019-03-10", ["ETH", "USA"], "Ethiopian Airlines Flight 302", "Ethiopian Airlines Flight 302", "Ethiopian Airlines Flight 302, a Boeing 737 MAX, crashed after take-off from Addis Ababa on 10 March 2019.", "disaster", g=0.05, m=3, sev=0.5)
E("sudan_bashir_ousted", "2019-04-11", ["SDN"], "Sudanese revolution", "Omar al-Bashir removed", "The Sudanese army removed President Omar al-Bashir from power on 11 April 2019.", "politics", any_path=False, stab=-0.05)
E("inf_withdrawal", "2019-08-02", ["USA", "RUS"], "Intermediate-Range Nuclear Forces Treaty", "End of the INF Treaty", "The United States withdrew from the Intermediate-Range Nuclear Forces Treaty on 2 August 2019.", "tension")
E("chile_protests_2019", "2019-10-18", ["CHL"], "2019–2022 Chilean protests", "Protests in Chile", "Mass protests broke out in Santiago on 18 October 2019.", "protest", group="youth_students")
E("baghdadi_killed", "2019-10-27", ["USA", "SYR"], "Barisha raid", "Death of Abu Bakr al-Baghdadi", "Islamic State leader Abu Bakr al-Baghdadi died during a United States raid in Syria on 27 October 2019.", "politics", stab=0.02)
E("george_floyd_protests", "2020-05-26", ["USA"], "George Floyd protests", "Protests across the United States", "Protests against police brutality spread across the United States from 26 May 2020.", "protest", group="minorities", major=True)
E("abraham_accords", "2020-09-15", ["ISR", "ARE", "BHR", "USA"], "Abraham Accords", "Abraham Accords", "Israel, the United Arab Emirates and Bahrain signed the Abraham Accords in Washington on 15 September 2020.", "treaty", major=True)
E("tigray_war", "2020-11-04", ["ETH"], "Tigray war", "War in Tigray", "Fighting began in the Tigray Region of Ethiopia on 4 November 2020.", "conflict", sev=1.5)
E("rcep_signed", "2020-11-15", ["CHN", "JPN", "KOR", "AUS", "NZL", "IDN", "THA", "VNM", "MYS", "SGP", "PHL"], "Regional Comprehensive Economic Partnership", "RCEP signed", "Fifteen Asia-Pacific countries signed the Regional Comprehensive Economic Partnership on 15 November 2020.", "treaty", extra=[T("trade_efficiency", 0.03, 1825)])
E("eu_uk_trade_deal", "2020-12-24", ["GBR", "DEU", "FRA", "IRL"], "EU–UK Trade and Cooperation Agreement", "EU–UK trade agreement", "The European Union and the United Kingdom concluded a trade and cooperation agreement on 24 December 2020.", "treaty")
E("texas_winter_storm", "2021-02-13", ["USA"], "2021 Texas power crisis", "Texas power crisis", "Winter storms caused a major power failure in Texas in February 2021.", "disaster", g=0.05, m=2, also=["February 2021"], dynamic=True)
E("haiti_moise", "2021-07-07", ["HTI"], "Assassination of Jovenel Moïse", "Assassination of Jovenel Moïse", "President Jovenel Moïse of Haiti was assassinated on 7 July 2021.", "attack", sev=1.5)
E("aukus", "2021-09-15", ["AUS", "GBR", "USA", "FRA"], "AUKUS", "AUKUS", "Australia, the United Kingdom and the United States announced the AUKUS security partnership on 15 September 2021.", "treaty")
E("evergrande", "2021-09-20", ["CHN"], "Evergrande liquidity crisis", "Property crisis", "The Evergrande Group, a large Chinese property developer, ran into a debt crisis in 2021.", "crisis", g=0.8, m=18, u=0.3, also=["2021"])
E("cop26", "2021-10-31", ["GBR", "USA", "CHN", "IND", "DEU", "FRA"], "2021 United Nations Climate Change Conference", "Glasgow climate summit", "The United Nations climate conference COP26 opened in Glasgow on 31 October 2021.", "climate")
E("omicron", "2021-11-26", ["ZAF", "GBR", "USA", "DEU"], "SARS-CoV-2 Omicron variant", "Omicron variant", "The World Health Organization named the Omicron variant of SARS-CoV-2 a variant of concern on 26 November 2021.", "disaster", g=0.3, m=4, dynamic=True)
E("jwst_launch", "2021-12-25", ["USA", "FRA"], "James Webb Space Telescope", "James Webb Space Telescope", "The James Webb Space Telescope was launched on 25 December 2021.", "science")
E("kazakhstan_unrest", "2022-01-02", ["KAZ", "RUS"], "2022 Kazakh unrest", "Unrest in Kazakhstan", "Protests over fuel prices began in Kazakhstan on 2 January 2022.", "protest", any_path=False)
E("sri_lanka_crisis_2022", "2022-07-09", ["LKA"], "2022 Sri Lankan protests", "Protests in Sri Lanka", "Protesters occupied the President's House in Colombo on 9 July 2022.", "protest", any_path=False)
E("pakistan_floods_2022", "2022-06-14", ["PAK"], "2022 Pakistan floods", "Pakistan floods", "Severe monsoon floods hit Pakistan from June 2022.", "disaster", g=2.0, also=["2022"], dynamic=True)
E("pelosi_taiwan", "2022-08-02", ["TWN", "CHN", "USA"], "2022 visit by Nancy Pelosi to Taiwan", "Pelosi visits Taiwan", "United States House Speaker Nancy Pelosi visited Taiwan on 2 August 2022; China held large military exercises around the island.", "tension", major=True)
E("uk_mini_budget", "2022-09-23", ["GBR"], "September 2022 United Kingdom mini-budget", "Mini-budget", "The UK government announced unfunded tax cuts on 23 September 2022, and gilt markets fell sharply.", "crisis", g=0.4, m=6, u=0.1)
E("crimean_bridge", "2022-10-08", ["RUS", "UKR"], "2022 Crimean Bridge explosion", "Crimean Bridge explosion", "An explosion damaged the Crimean Bridge on 8 October 2022.", "tension")
E("seoul_crowd_crush", "2022-10-29", ["KOR"], "Seoul Halloween crowd crush", "Itaewon crowd crush", "A crowd crush in Itaewon, Seoul, during Halloween celebrations on 29 October 2022 killed many people.", "disaster", g=0.0, m=1, sev=0.8)
E("chatgpt", "2022-11-30", ["USA"], "ChatGPT", "ChatGPT released", "OpenAI released ChatGPT on 30 November 2022.", "science")
E("chinese_balloon", "2023-02-04", ["USA", "CHN"], "2023 Chinese balloon incident", "Balloon incident", "A United States fighter shot down a Chinese balloon off South Carolina on 4 February 2023.", "tension")
E("credit_suisse", "2023-03-19", ["CHE"], "Acquisition of Credit Suisse by UBS", "Credit Suisse rescue", "UBS agreed to take over Credit Suisse on 19 March 2023.", "crisis", g=0.3, m=6, u=0.1)
E("sudan_war_2023", "2023-04-15", ["SDN"], "Sudanese civil war (2023–present)", "War in Sudan", "Fighting broke out between the Sudanese army and the Rapid Support Forces on 15 April 2023.", "conflict", sev=2.0, major=True)
E("niger_coup", "2023-07-26", ["NER"], "2023 Nigerien coup d'état", "Coup in Niger", "Members of the presidential guard detained President Mohamed Bazoum of Niger on 26 July 2023.", "politics", any_path=False, stab=-0.06)
E("chandrayaan_3", "2023-08-23", ["IND"], "Chandrayaan-3", "Chandrayaan-3 lands on the Moon", "India's Chandrayaan-3 landed near the lunar south pole on 23 August 2023.", "science")
E("morocco_earthquake", "2023-09-08", ["MAR"], "2023 Marrakesh–Safi earthquake", "Morocco earthquake", "An earthquake struck the Marrakesh–Safi region of Morocco on 8 September 2023.", "disaster", g=0.3, dynamic=True)
E("derna_floods", "2023-09-10", ["LBY"], "2023 Derna dam collapse", "Derna floods", "Two dams collapsed near Derna, Libya, during Storm Daniel in September 2023.", "disaster", g=0.8, sev=1.5, dynamic=True, also=["September 2023"])
E("karabakh_offensive_2023", "2023-09-19", ["AZE", "ARM", "NKR"], "2023 Azerbaijani offensive in Nagorno-Karabakh", "Offensive in Nagorno-Karabakh", "Azerbaijan launched a military offensive in Nagorno-Karabakh on 19 September 2023.", "conflict", sev=1.2)
E("noto_earthquake", "2024-01-01", ["JPN"], "2024 Noto earthquake", "Noto earthquake", "An earthquake struck the Noto Peninsula, Japan, on 1 January 2024.", "disaster", g=0.2, dynamic=True)
E("crocus_attack", "2024-03-22", ["RUS"], "Crocus City Hall attack", "Crocus City Hall attack", "Gunmen attacked the Crocus City Hall concert venue near Moscow on 22 March 2024.", "attack", sev=1.5)
E("baltimore_bridge", "2024-03-26", ["USA"], "Francis Scott Key Bridge collapse", "Baltimore bridge collapse", "The Francis Scott Key Bridge in Baltimore collapsed after a container ship struck it on 26 March 2024.", "disaster", g=0.02, m=3)
E("iran_strikes_israel", "2024-04-13", ["IRN", "ISR"], "April 2024 Iranian strikes against Israel", "Iranian strikes on Israel", "Iran launched drones and missiles at Israel on 13 April 2024.", "tension", major=True)
E("trump_assassination_attempt", "2024-07-13", ["USA"], "Attempted assassination of Donald Trump in Pennsylvania", "Assassination attempt", "Donald Trump was wounded in an assassination attempt at a rally near Butler, Pennsylvania, on 13 July 2024.", "attack", sev=0.8, major=True)
E("bangladesh_2024", "2024-08-05", ["BGD"], "July Revolution (Bangladesh)", "Prime Minister resigns", "Prime Minister Sheikh Hasina resigned and left Bangladesh on 5 August 2024 after mass protests.", "protest", any_path=False)
E("kursk_incursion", "2024-08-06", ["RUS", "UKR"], "2024 Kursk offensive", "Kursk incursion", "Ukrainian forces crossed into Russia's Kursk Oblast on 6 August 2024.", "conflict", sev=1.0)
E("pager_explosions", "2024-09-17", ["LBN", "ISR"], "2024 Lebanon electronic device attacks", "Pager explosions", "Thousands of pagers used by Hezbollah members exploded across Lebanon on 17 September 2024.", "tension")
E("valencia_floods", "2024-10-29", ["ESP"], "2024 Spanish floods", "Valencia floods", "Flash floods struck the province of Valencia on 29 October 2024.", "disaster", g=0.2, sev=1.5, dynamic=True)
E("la_wildfires", "2025-01-07", ["USA"], "January 2025 Southern California wildfires", "Los Angeles wildfires", "Wildfires broke out around Los Angeles from 7 January 2025.", "disaster", g=0.1, dynamic=True)
E("gaza_ceasefire_2025", "2025-01-19", ["ISR", "PSE"], "2025 Gaza war ceasefire", "Gaza ceasefire", "A ceasefire between Israel and Hamas took effect on 19 January 2025.", "treaty")
E("myanmar_earthquake_2025", "2025-03-28", ["MMR", "THA"], "2025 Myanmar earthquake", "Myanmar earthquake", "An earthquake struck central Myanmar on 28 March 2025.", "disaster", g=0.8, sev=1.5, dynamic=True)
E("liberation_day_tariffs", "2025-04-02", ["USA", "CHN", "DEU", "JPN", "KOR", "GBR", "FRA", "ITA"], "Liberation Day tariffs", "\"Liberation Day\" tariffs", "On 2 April 2025 President Donald Trump announced broad tariffs on imports to the United States.", "crisis", g=0.4, m=12, u=0.2, major=True)
E("india_pakistan_2025", "2025-05-07", ["IND", "PAK"], "2025 India–Pakistan conflict", "India–Pakistan conflict", "India struck targets in Pakistan on 7 May 2025, starting a short military conflict.", "conflict", sev=1.0, major=True)
E("pope_leo", "2025-05-08", ["VAT", "USA", "ITA"], "Pope Leo XIV", "Election of Pope Leo XIV", "Cardinal Robert Francis Prevost was elected Pope on 8 May 2025 and took the name Leo XIV.", "politics", stab=0.01)


# ================================================================== batch 3: domestic events of playable countries
E("gbr_foot_and_mouth", "2001-02-19", ["GBR"], "2001 United Kingdom foot-and-mouth outbreak", "Foot-and-mouth outbreak", "An outbreak of foot-and-mouth disease was confirmed in Britain on 19 February 2001.", "disaster", g=0.2, m=9, dynamic=True)
E("nld_fortuyn", "2002-05-06", ["NLD"], "Assassination of Pim Fortuyn", "Assassination of Pim Fortuyn", "Politician Pim Fortuyn was shot dead in Hilversum on 6 May 2002.", "attack", sev=1.0)
E("jpn_kor_world_cup", "2002-05-31", ["JPN", "KOR"], "2002 FIFA World Cup", "World Cup in Japan and Korea", "South Korea and Japan hosted the FIFA World Cup from 31 May to 30 June 2002.", "sport")
E("elbe_floods_2002", "2002-08-12", ["DEU", "CZE", "AUT"], "2002 European floods", "Floods in central Europe", "Severe floods hit central Europe in August 2002.", "disaster", g=0.2, also=["August 2002"], dynamic=True)
E("iran_nuclear_sites_revealed", "2002-08-14", ["IRN", "USA"], "Nuclear program of Iran", "Nuclear sites revealed", "In August 2002 an Iranian opposition group revealed the existence of nuclear facilities at Natanz and Arak.", "tension", also=["2002"])
E("swe_lindh", "2003-09-11", ["SWE"], "Assassination of Anna Lindh", "Assassination of Anna Lindh", "Swedish Foreign Minister Anna Lindh was stabbed in Stockholm on 10 September 2003 and died the next day.", "attack", sev=0.8, also=["2003"])
E("tur_eu_talks", "2005-10-03", ["TUR"], "Accession of Turkey to the European Union", "EU accession talks open", "Accession negotiations between Turkey and the European Union opened on 3 October 2005.", "treaty")
E("gbr_olympics_awarded", "2005-07-06", ["GBR"], "London bid for the 2012 Summer Olympics", "London wins the Olympics", "London was chosen on 6 July 2005 to host the 2012 Summer Olympics.", "boom", sev=0.5)
E("hun_protests_2006", "2006-09-17", ["HUN"], "2006 protests in Hungary", "Protests in Budapest", "Protests broke out in Budapest in September 2006 after a leaked speech by Prime Minister Ferenc Gyurcsány.", "protest", group="urban_middle_class", any_path=False, also=["2006"])
E("ita_world_cup_2006", "2006-07-09", ["ITA"], "2006 FIFA World Cup final", "World champions", "Italy won the FIFA World Cup on 9 July 2006.", "sport")
E("som_icu_mogadishu", "2006-06-05", ["SOM"], "Islamic Courts Union", "Islamic Courts take Mogadishu", "The Islamic Courts Union took control of Mogadishu in June 2006.", "conflict", any_path=False, also=["2006"], sev=1.5)
E("som_ethiopian_intervention", "2006-12-24", ["SOM", "ETH"], "War in Somalia (2006–2009)", "Ethiopian intervention", "Ethiopian forces intervened in Somalia in December 2006.", "conflict", any_path=False, also=["2006"], sev=1.5)
E("usa_tarp", "2008-10-03", ["USA"], "Troubled Asset Relief Program", "Bank rescue", "The Emergency Economic Stabilization Act, creating the Troubled Asset Relief Program, became law on 3 October 2008.", "crisis", g=0.5, m=9, u=0.5)
E("gbr_bank_rescue", "2008-10-08", ["GBR"], "2008 United Kingdom bank rescue package", "Bank rescue package", "The British government announced a rescue package for the banking system on 8 October 2008.", "crisis", g=0.5, m=9, u=0.5)
E("usa_recovery_act", "2009-02-17", ["USA"], "American Recovery and Reinvestment Act of 2009", "Recovery Act", "President Barack Obama signed the American Recovery and Reinvestment Act on 17 February 2009.", "boom", sev=1.0, any_path=False)
E("rus_moscow_metro_2010", "2010-03-29", ["RUS"], "2010 Moscow Metro bombings", "Moscow Metro bombings", "Two suicide bombers attacked the Moscow Metro on 29 March 2010.", "attack", sev=1.0)
E("chn_shanghai_expo", "2010-05-01", ["CHN"], "Expo 2010", "Shanghai Expo", "The World Expo opened in Shanghai on 1 May 2010.", "sport")
E("deu_love_parade", "2010-07-24", ["DEU"], "Love Parade disaster", "Love Parade disaster", "A crowd crush at the Love Parade in Duisburg on 24 July 2010 killed 21 people.", "disaster", g=0.0, m=1, sev=0.5, also=["21"])
E("esp_world_cup_2010", "2010-07-11", ["ESP"], "2010 FIFA World Cup final", "World champions", "Spain won the FIFA World Cup on 11 July 2010.", "sport")
E("fra_pension_protests_2010", "2010-10-12", ["FRA"], "2010 French pension reform strikes", "Pension reform protests", "Strikes and protests against raising the retirement age took place across France in October 2010.", "protest", group="labour_unions", any_path=False, also=["2010"])
E("rus_domodedovo", "2011-01-24", ["RUS"], "Domodedovo International Airport bombing", "Domodedovo airport bombing", "A suicide bomber attacked Domodedovo Airport in Moscow on 24 January 2011.", "attack", sev=1.0)
E("esp_eta_ceasefire", "2011-10-20", ["ESP"], "ETA (separatist group)", "ETA ends its armed campaign", "ETA announced the end of its armed campaign on 20 October 2011.", "politics", stab=0.04)
E("isr_shalit", "2011-10-18", ["ISR", "PSE"], "Gilad Shalit prisoner exchange", "Shalit exchange", "Israeli soldier Gilad Shalit was released on 18 October 2011 in exchange for Palestinian prisoners.", "politics", stab=0.01)
E("som_famine_2011", "2011-07-20", ["SOM"], "2011 East Africa drought", "Famine declared", "The United Nations declared a famine in parts of southern Somalia on 20 July 2011.", "disaster", g=2.0, sev=2.0, dynamic=True)
E("iran_eu_oil_embargo", "2012-07-01", ["IRN"], "Sanctions against Iran", "EU oil embargo", "The European Union's embargo on Iranian oil took effect on 1 July 2012.", "crisis", g=2.0, m=24, u=1.0)
E("pol_ukr_euro_2012", "2012-06-08", ["POL", "UKR"], "UEFA Euro 2012", "Euro 2012", "Poland and Ukraine hosted the UEFA European Championship from 8 June to 1 July 2012.", "sport")
E("chn_belt_and_road", "2013-09-07", ["CHN"], "Belt and Road Initiative", "Belt and Road", "Xi Jinping announced the Silk Road Economic Belt in Kazakhstan in September 2013.", "reform", any_path=False, also=["2013"], extra=[T("foreign_investment", 0.03, 3650), T("trade_efficiency", 0.03, 3650)])
E("usa_shutdown_2013", "2013-10-01", ["USA"], "2013 United States federal government shutdown", "Government shutdown", "The United States federal government shut down from 1 to 16 October 2013.", "crisis", g=0.1, m=3, u=0.0)
E("ita_lampedusa", "2013-10-03", ["ITA"], "2013 Lampedusa migrant shipwreck", "Lampedusa shipwreck", "A boat carrying migrants sank near Lampedusa on 3 October 2013.", "disaster", g=0.0, m=1, sev=0.5)
E("esp_abdication", "2014-06-19", ["ESP"], "Felipe VI", "A new King", "Felipe VI became King of Spain on 19 June 2014 after the abdication of his father, Juan Carlos I.", "politics", stab=0.01, also=["19 June 2014"])
E("deu_minimum_wage", "2015-01-01", ["DEU"], "Minimum wage in Germany", "National minimum wage", "A national minimum wage took effect in Germany on 1 January 2015.", "reform", any_path=False, extra=[IG("labour_unions", 5), IG("business", -3)])
E("usa_obergefell", "2015-06-26", ["USA"], "Obergefell v. Hodges", "Obergefell v. Hodges", "The Supreme Court ruled on 26 June 2015 that the Constitution guarantees same-sex couples the right to marry.", "reform", any_path=False, extra=[T("civil_liberties", 0.03, 3650), IG("youth_students", 3), IG("religious_establishment", -3)])
E("chn_one_child_ends", "2015-10-29", ["CHN"], "One-child policy", "End of the one-child policy", "China announced on 29 October 2015 that it would allow all couples to have two children.", "reform", any_path=False, extra=[T("population_growth", 0.002, 3650)])
E("fra_euro_2016", "2016-06-10", ["FRA"], "UEFA Euro 2016", "Euro 2016", "France hosted the UEFA European Championship from 10 June to 10 July 2016.", "sport")
E("jpn_kumamoto", "2016-04-16", ["JPN"], "2016 Kumamoto earthquakes", "Kumamoto earthquakes", "Earthquakes struck Kumamoto Prefecture, Japan, in April 2016.", "disaster", g=0.1, also=["April 2016"], dynamic=True)
E("ita_amatrice", "2016-08-24", ["ITA"], "2016 Central Italy earthquake", "Amatrice earthquake", "An earthquake struck central Italy near Amatrice on 24 August 2016.", "disaster", g=0.05, dynamic=True)
E("rus_st_petersburg_metro", "2017-04-03", ["RUS"], "2017 Saint Petersburg Metro bombing", "Saint Petersburg Metro bombing", "A bomb exploded on a Saint Petersburg Metro train on 3 April 2017.", "attack", sev=0.8)
E("tur_referendum_2017", "2017-04-16", ["TUR"], "2017 Turkish constitutional referendum", "Constitutional referendum", "Turkish voters approved constitutional amendments creating an executive presidency on 16 April 2017.", "reform", any_path=False, extra=[{"change_law": {"category": "political_freedom", "law": "restricted_elections"}}, T("political_power_gain", 0.05, 3650)])
E("usa_tax_cuts_2017", "2017-12-22", ["USA"], "Tax Cuts and Jobs Act", "Tax Cuts and Jobs Act", "President Donald Trump signed the Tax Cuts and Jobs Act on 22 December 2017.", "reform", any_path=False, extra=[IG("business", 6), T("private_sector_output", 0.02, 2920), {"set_budget": {"revenue": -1.0}}])
E("iran_protests_2017", "2017-12-28", ["IRN"], "2017–2018 Iranian protests", "Economic protests", "Protests over economic conditions began in Iran on 28 December 2017.", "protest", group="urban_middle_class", any_path=False)
E("kor_pyeongchang", "2018-02-09", ["KOR"], "2018 Winter Olympics", "PyeongChang Winter Olympics", "PyeongChang hosted the Winter Olympics from 9 to 25 February 2018.", "sport")
E("svk_kuciak", "2018-02-21", ["SVK"], "Murder of Ján Kuciak", "Murder of Ján Kuciak", "Journalist Ján Kuciak and his fiancée were found shot dead at their home in February 2018; mass protests followed.", "protest", group="urban_middle_class", also=["2018"])
E("rus_world_cup", "2018-06-14", ["RUS"], "2018 FIFA World Cup", "World Cup in Russia", "Russia hosted the FIFA World Cup from 14 June to 15 July 2018.", "sport")
E("fra_world_cup_win", "2018-07-15", ["FRA"], "2018 FIFA World Cup final", "World champions", "France won the FIFA World Cup on 15 July 2018.", "sport")
E("chn_change_4", "2019-01-03", ["CHN"], "Chang'e 4", "Landing on the far side of the Moon", "China's Chang'e 4 made the first landing on the far side of the Moon on 3 January 2019.", "science")
E("jpn_reiwa", "2019-05-01", ["JPN"], "Reiwa", "The Reiwa era", "Naruhito became Emperor of Japan on 1 May 2019, beginning the Reiwa era.", "politics", stab=0.02, also=["1 May 2019"])
E("iran_fuel_protests", "2019-11-15", ["IRN"], "2019–2020 Iranian protests", "Fuel price protests", "Protests broke out across Iran on 15 November 2019 after fuel prices were raised.", "protest", group="urban_middle_class", any_path=False)
E("iran_flight_752", "2020-01-08", ["IRN", "UKR", "CAN"], "Ukraine International Airlines Flight 752", "Flight 752 shot down", "Ukraine International Airlines Flight 752 was shot down after take-off from Tehran on 8 January 2020.", "tension")
E("chn_wuhan_lockdown", "2020-01-23", ["CHN"], "COVID-19 lockdown in Wuhan", "Wuhan lockdown", "The city of Wuhan was placed under lockdown on 23 January 2020.", "crisis", g=2.0, m=6, u=1.0, dynamic=True)
E("ita_lombardy_lockdown", "2020-03-08", ["ITA"], "COVID-19 lockdowns in Italy", "Lockdown in Italy", "Italy placed Lombardy and other northern provinces under quarantine on 8 March 2020, and the whole country on 9 March.", "crisis", g=2.0, m=9, u=1.5, dynamic=True)
E("ind_chn_galwan", "2020-06-15", ["IND", "CHN"], "2020 China–India skirmishes", "Clash in the Galwan Valley", "Indian and Chinese soldiers clashed in the Galwan Valley on 15 June 2020.", "tension")
E("deu_wirecard", "2020-06-25", ["DEU"], "Wirecard scandal", "Wirecard insolvency", "The payments company Wirecard filed for insolvency on 25 June 2020.", "crisis", g=0.05, m=3)
E("rus_constitution_2020", "2020-07-01", ["RUS"], "2020 Russian constitutional referendum", "Constitutional amendments", "Russian voters approved amendments to the constitution in a vote that ended on 1 July 2020.", "reform", any_path=False, extra=[T("political_power_gain", 0.05, 3650), {"add_stability": 0.02}])
E("pol_protests_2020", "2020-10-22", ["POL"], "October 2020 Polish protests", "Protests in Poland", "Mass protests began in Poland after a Constitutional Tribunal ruling on abortion on 22 October 2020.", "protest", group="youth_students", any_path=False)
E("deu_ber_airport", "2020-10-31", ["DEU"], "Berlin Brandenburg Airport", "Berlin Brandenburg Airport opens", "Berlin Brandenburg Airport opened on 31 October 2020.", "boom", sev=0.4)
E("isr_gaza_2021", "2021-05-10", ["ISR", "PSE"], "2021 Israel–Palestine crisis", "Fighting in Gaza", "Fighting between Israel and Hamas broke out on 10 May 2021.", "conflict", sev=1.0)
E("usa_infrastructure_law", "2021-11-15", ["USA"], "Infrastructure Investment and Jobs Act", "Infrastructure law", "President Joe Biden signed the Infrastructure Investment and Jobs Act on 15 November 2021.", "reform", any_path=False, extra=[T("construction_speed", 0.08, 2920), {"set_budget": {"spending": 0.5}}])
E("deu_zeitenwende", "2022-02-27", ["DEU"], "Zeitenwende speech", "Zeitenwende", "On 27 February 2022 Chancellor Olaf Scholz announced a special fund of 100 billion euros for the Bundeswehr.", "reform", any_path=False, also=["100 billion"], extra=[{"add_war_support": 0.05}, IG("military", 6), T("army_org", 0.05, 3650)])
E("pol_ukrainian_refugees", "2022-03-01", ["POL", "DEU", "CZE", "HUN", "SVK", "ROU", "MDA"], "Ukrainian refugee crisis", "Refugees from Ukraine", "Millions of refugees fled Ukraine to neighbouring countries in the weeks after the invasion of February 2022.", "politics", stab=-0.01, also=["2022"], extra=[T("immigration", 0.05, 1095)])
E("usa_chips_act", "2022-08-09", ["USA"], "CHIPS and Science Act", "CHIPS and Science Act", "President Joe Biden signed the CHIPS and Science Act on 9 August 2022.", "reform", any_path=False, extra=[T("research_speed", 0.03, 3650), T("production_efficiency", 0.02, 3650)])
E("usa_inflation_reduction_act", "2022-08-16", ["USA"], "Inflation Reduction Act", "Inflation Reduction Act", "President Joe Biden signed the Inflation Reduction Act on 16 August 2022.", "climate", any_path=False)
E("rus_mobilisation_2022", "2022-09-21", ["RUS"], "2022 Russian mobilization", "Partial mobilisation", "Russia announced a partial mobilisation on 21 September 2022.", "politics", any_path=False, stab=-0.04, extra=[T("manpower_factor", 0.2, 1095), IG("youth_students", -6)])
E("chn_covid_protests", "2022-11-24", ["CHN"], "2022 COVID-19 protests in China", "Protests against lockdowns", "Protests against COVID-19 lockdowns broke out in many Chinese cities in late November 2022.", "protest", any_path=False, also=["November 2022"])
E("isr_judicial_protests", "2023-01-07", ["ISR"], "2023 Israeli judicial reform protests", "Judicial reform protests", "Mass protests against the government's judicial reform plans began in Israel in January 2023.", "protest", group="urban_middle_class", any_path=False, also=["2023"])
E("deu_last_nuclear", "2023-04-15", ["DEU"], "Nuclear power in Germany", "Last nuclear plants close", "Germany shut down its last three nuclear power plants on 15 April 2023.", "reform", any_path=False, extra=[T("nuclear_output", -0.5, 3650), T("energy_cost", 0.03, 1825)])
E("usa_debt_ceiling_2023", "2023-06-03", ["USA"], "Fiscal Responsibility Act of 2023", "Debt ceiling deal", "President Joe Biden signed the Fiscal Responsibility Act, suspending the debt ceiling, on 3 June 2023.", "politics", any_path=False, stab=0.01, extra=[{"set_budget": {"spending": -0.3}}])
E("fra_nahel_riots", "2023-06-27", ["FRA"], "2023 French riots", "Riots in France", "Riots broke out across France after a teenager was shot by police in Nanterre on 27 June 2023.", "protest", group="minorities")
E("rus_prigozhin_crash", "2023-08-23", ["RUS"], "2023 Wagner Group plane crash", "Wagner leaders killed in plane crash", "Yevgeny Prigozhin and other Wagner Group leaders died when their plane crashed north of Moscow on 23 August 2023.", "politics", stab=0.01)
E("iran_raisi_crash", "2024-05-19", ["IRN"], "2024 Varzaqan helicopter crash", "Helicopter crash", "President Ebrahim Raisi died in a helicopter crash in East Azerbaijan Province on 19 May 2024.", "politics", stab=-0.03, major=True)
E("fra_notre_dame_reopens", "2024-12-07", ["FRA"], "Notre-Dame de Paris", "Notre-Dame reopens", "Notre-Dame de Paris reopened on 7 December 2024 after its restoration.", "boom", sev=0.4, also=["7 December 2024"])


# ------------------------------------------------------------------ pipeline

def period(date):
    y = int(date[:4])
    return "2000s" if y < 2010 else "2010s" if y < 2020 else "2020s"


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "candidates"
    ids = [c["id"] for c in C]
    assert len(ids) == len(set(ids)), [i for i in ids if ids.count(i) > 1]
    if mode == "candidates":
        json.dump([{"id": c["id"], "date": c["date"], "page": c["page"], "also": c["also"]} for c in C], open(".cache/event-candidates.json", "w", encoding="utf8"), indent=1)
        print(len(C), "candidates")
        return
    ver = {v["id"]: v for v in json.load(open(".cache/event-verified.json", encoding="utf8"))}
    countries = json.load(open("data/world/countries.json", encoding="utf8"))
    tags = {c["tag"] for c in countries.get("countries", countries)}
    out = {"2000s": [], "2010s": [], "2020s": []}
    dropped = []
    for c in C:
        v = ver.get(c["id"])
        if not v or not v["verified"]:
            dropped.append(c["id"])
            continue
        for t in c["countries"]:
            assert t in tags, (c["id"], t)
        date = c["date"]
        if v.get("precision") == "month":
            y, m, d = (int(x) for x in date.split("-"))
            # only the month is confirmed: the text names the month, not the day
            day_s = f"{d} {MONTHS[m - 1]} {y}"
            for pre in ("on ", "On "):
                c["desc"] = c["desc"].replace(pre + day_s, ("in " if pre == "on " else "In ") + f"{MONTHS[m - 1]} {y}")
            c["desc"] = c["desc"].replace(day_s, f"{MONTHS[m - 1]} {y}")
            date = f"{y:04d}-{m:02d}-01"
        hist = {"date": date, "any_path": c["any_path"], "dynamic_mode": c["dynamic"],
                "source": [{"url": "https://en.wikipedia.org/wiki/" + v["page"].replace(" ", "_"), "title": "Wikipedia: " + v["page"], "accessed": ACC}],
                "confidence": "verified"}
        e = {"id": c["id"], "title": c["title"], "description": c["desc"], "countries": c["countries"]}
        if c["major"]:
            e["major"] = True
        e["historical"] = hist
        e["options"] = tpl(c["kind"], c["p"])
        out[period(c["date"])].append(e)
    for k, evs in out.items():
        evs.sort(key=lambda e: e["historical"]["date"])
        with open(f"data/events/history_{k}.json", "w", encoding="utf8", newline="\n") as f:
            json.dump({"note": f"Dated world events of the {k}, generated by scripts/dev/gen-events-history.py from candidates verified against Wikipedia (scripts/research/verify-events.ts): the date of each was found in the cited article. Descriptions state documented facts only; effects are gameplay estimates from templates. Events fire only for listed countries that exist on the map; natural disasters and pandemics also fire in dynamic mode.", "events": evs}, f, ensure_ascii=False, indent=2)
            f.write("\n")
    print({k: len(v) for k, v in out.items()}, "written;", len(dropped), "dropped:", " ".join(dropped))


if __name__ == "__main__":
    main()
