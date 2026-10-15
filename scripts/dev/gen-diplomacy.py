"""Generate data/diplomacy/blocs.json and un.json from membership lists checked against Wikipedia
(see the source entries). Run: python -I -X utf8 scripts/dev/gen-diplomacy.py"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
countries = json.load(open(os.path.join(ROOT, "data/world/countries.json"), encoding="utf8"))
countries = countries.get("countries", countries)
TAGS = {c["tag"] for c in countries}
BY_NAME = {c["name"]: c["tag"] for c in countries}
ALIAS = {
    "Islamic Republic of Afghanistan": "AFG", "Brunei": "BRN", "Federated States of Micronesia": "FSM", "Marshall Islands": "MHL",
    "Solomon Islands": "SLB", "Timor-Leste": "TLS", "Bosnia and Herzegovina": "BIH", "Czech Republic": "CZE", "Montenegro": "MNE",
    "North Macedonia": "MKD", "Serbia": "YUG", "Antigua and Barbuda": "ATG", "The Bahamas": "BHS", "Dominican Republic": "DOM",
    "Saint Kitts and Nevis": "KNA", "Saint Lucia": "LCA", "Saint Vincent and the Grenadines": "VCT", "Trinidad and Tobago": "TTO",
    "Cape Verde": "CPV", "Central African Republic": "CAF", "Democratic Republic of the Congo": "COD", "Republic of the Congo": "COG",
    "Equatorial Guinea": "GNQ", "Eswatini": "SWZ", "The Gambia": "GMB", "Ivory Coast": "CIV", "São Tomé and Príncipe": "STP",
    "South Sudan": "SSD", "United Arab Emirates": "ARE", "North Korea": "PRK", "South Korea": "KOR", "Papua New Guinea": "PNG",
    "United Kingdom": "GBR", "United States": "USA", "New Zealand": "NZL", "San Marino": "SMR", "Saudi Arabia": "SAU", "Sri Lanka": "LKA",
    "South Africa": "ZAF", "Sierra Leone": "SLE", "Burkina Faso": "BFA", "Guinea-Bissau": "GNB", "Costa Rica": "CRI", "El Salvador": "SLV",
}


def tag(name):
    t = ALIAS.get(name) or BY_NAME.get(name)
    assert t in TAGS, name
    return t


def tags(names):
    return [tag(n.strip()) for n in names.split(",")]


def wiki(page, title=None):
    return {"url": "https://en.wikipedia.org/wiki/" + page.replace(" ", "_"), "title": "Wikipedia: " + (title or page), "accessed": "2026-10-15"}


NATO_2000 = ["BEL", "CAN", "DNK", "FRA", "ISL", "ITA", "LUX", "NLD", "NOR", "PRT", "GBR", "USA", "GRC", "TUR", "DEU", "ESP", "CZE", "HUN", "POL"]
EU_2000 = ["AUT", "BEL", "DNK", "FIN", "FRA", "DEU", "GRC", "IRL", "ITA", "LUX", "NLD", "PRT", "ESP", "SWE", "GBR"]
CIS_2000 = ["ARM", "AZE", "BLR", "GEO", "KAZ", "KGZ", "MDA", "RUS", "TJK", "UZB"]
CST_2000 = ["ARM", "BLR", "KAZ", "KGZ", "RUS", "TJK"]
ASEAN_2000 = ["BRN", "KHM", "IDN", "LAO", "MYS", "MMR", "PHL", "SGP", "THA", "VNM"]
ARAB_2000 = ["DZA", "BHR", "COM", "DJI", "EGY", "IRQ", "JOR", "KWT", "LBN", "LBY", "MRT", "MAR", "OMN", "PSE", "QAT", "SAU", "SOM", "SDN", "SYR", "TUN", "ARE", "YEM"]
OAU_2000 = tags("Algeria,Burundi,Cameroon,Central African Republic,Chad,Republic of the Congo,Democratic Republic of the Congo,Benin,Egypt,Ethiopia,Gabon,Ghana,Guinea,Ivory Coast,Liberia,Libya,Madagascar,Mali,Mauritania,Niger,Nigeria,Rwanda,Senegal,Sierra Leone,Somalia,Sudan,Tanzania,Togo,Tunisia,Uganda,Burkina Faso,Kenya,Malawi,Zambia,The Gambia,Botswana,Lesotho,Mauritius,Eswatini,Equatorial Guinea,Guinea-Bissau,Angola,Cape Verde,Comoros,Mozambique,São Tomé and Príncipe,Seychelles,Djibouti,Zimbabwe,Namibia,Eritrea,South Africa") + ["ESH"]
assert len(OAU_2000) == 53, len(OAU_2000)

blocs = {
    "note": "International blocs on 1 January 2000. Memberships are sourced; the gameplay values (opinion, growth, accession days) are estimates. Later enlargements are historical events in data/events/blocs.json.",
    "blocs": [
        {"id": "nato", "color": "#3a6fd8", "name": "NATO", "kind": "military", "defensive": True, "opinion": 20, "trade_growth": 0, "accession_days": 1095, "rival": "cst",
         "description": "The North Atlantic alliance: an armed attack on one member is considered an attack on all (Article 5).",
         "join_trigger": {"all": [{"not": {"in_bloc": "cst"}}, {"not": {"at_war": True}}]},
         "members_2000": NATO_2000, "source": [wiki("Member states of NATO")], "confidence": "verified"},
        {"id": "eu", "color": "#e8c547", "name": "European Union", "kind": "economic", "defensive": False, "opinion": 15, "trade_growth": 0.4, "accession_days": 1460,
         "description": "Single market, customs union and common institutions of fifteen European states in 2000.",
         "join_trigger": {"all": [{"not": {"at_war": True}}, {"not": {"in_bloc": "cis"}}]},
         "members_2000": EU_2000, "source": [wiki("Member state of the European Union")], "confidence": "verified"},
        {"id": "cis", "color": "#b0563b", "name": "Commonwealth of Independent States", "kind": "political", "defensive": False, "opinion": 10, "trade_growth": 0.1, "accession_days": 365,
         "description": "Organisation of post-Soviet states. Ukraine and Turkmenistan took part without ratifying the Charter, so they are not counted as members.",
         "join_trigger": {"not": {"in_bloc": "eu"}},
         "members_2000": CIS_2000, "source": [wiki("Commonwealth of Independent States")], "confidence": "verified"},
        {"id": "cst", "color": "#c2302a", "name": "Collective Security Treaty", "kind": "military", "defensive": True, "opinion": 15, "trade_growth": 0, "accession_days": 730, "rival": "nato",
         "description": "Post-Soviet mutual defence treaty (the Tashkent Treaty); an aggression against one signatory is an aggression against all. Azerbaijan, Georgia and Uzbekistan withdrew in 1999.",
         "join_trigger": {"all": [{"not": {"in_bloc": "nato"}}, {"not": {"at_war": True}}]},
         "members_2000": CST_2000, "source": [wiki("Collective Security Treaty Organization")], "confidence": "verified"},
        {"id": "asean", "color": "#3fa37a", "name": "ASEAN", "kind": "economic", "defensive": False, "opinion": 10, "trade_growth": 0.2, "accession_days": 1095,
         "description": "Association of Southeast Asian Nations; Cambodia became the tenth member on 30 April 1999.",
         "members_2000": ASEAN_2000, "source": [wiki("ASEAN")], "confidence": "verified"},
        {"id": "arab_league", "color": "#2f8f4e", "name": "Arab League", "kind": "political", "defensive": False, "opinion": 10, "trade_growth": 0.05, "accession_days": 365,
         "description": "League of Arab States: twenty-two members in 2000.",
         "members_2000": ARAB_2000, "source": [wiki("Member states of the Arab League")], "confidence": "verified"},
        {"id": "oau", "color": "#a87b3c", "name": "Organisation of African Unity", "kind": "political", "defensive": False, "opinion": 8, "trade_growth": 0.05, "accession_days": 365,
         "renamed": [{"date": "2002-07-09", "name": "African Union", "source": [wiki("African Union")], "confidence": "verified"}],
         "description": "Fifty-three African states; Morocco left in 1984 after the admission of the Sahrawi Republic. Replaced by the African Union on 9 July 2002.",
         "members_2000": OAU_2000, "source": [wiki("Organisation of African Unity")], "confidence": "verified"},
        {"id": "mercosur", "color": "#4ab0c9", "name": "Mercosur", "kind": "economic", "defensive": False, "opinion": 10, "trade_growth": 0.25, "accession_days": 1095,
         "description": "Southern Common Market of Argentina, Brazil, Paraguay and Uruguay.",
         "members_2000": ["ARG", "BRA", "PRY", "URY"], "source": [wiki("Mercosur")], "confidence": "verified"},
        {"id": "nafta", "color": "#7a68d8", "name": "NAFTA", "kind": "economic", "defensive": False, "opinion": 10, "trade_growth": 0.3, "accession_days": 1460,
         "description": "North American Free Trade Agreement between Canada, Mexico and the United States.",
         "members_2000": ["CAN", "MEX", "USA"], "source": [wiki("North American Free Trade Agreement")], "confidence": "verified"},
        {"id": "sco", "color": "#d07a3a", "name": "Shanghai Cooperation Organisation", "kind": "political", "defensive": False, "opinion": 10, "trade_growth": 0.05, "accession_days": 730,
         "description": "Founded on 15 June 2001 by the Shanghai Five (China, Kazakhstan, Kyrgyzstan, Russia, Tajikistan) and Uzbekistan.",
         "members_2000": [], "source": [wiki("Shanghai Cooperation Organisation")], "confidence": "verified"},
    ],
}

groups_src = {
    "african": "Algeria,Angola,Benin,Botswana,Burkina Faso,Burundi,Cape Verde,Cameroon,Central African Republic,Chad,Comoros,Democratic Republic of the Congo,Djibouti,Egypt,Equatorial Guinea,Eritrea,Eswatini,Ethiopia,Gabon,The Gambia,Ghana,Guinea,Guinea-Bissau,Ivory Coast,Kenya,Lesotho,Liberia,Libya,Madagascar,Malawi,Mali,Mauritania,Mauritius,Morocco,Mozambique,Namibia,Niger,Nigeria,Republic of the Congo,Rwanda,São Tomé and Príncipe,Senegal,Seychelles,Sierra Leone,Somalia,South Africa,South Sudan,Sudan,Tanzania,Togo,Tunisia,Uganda,Zambia,Zimbabwe",
    "asia_pacific": "Islamic Republic of Afghanistan,Bahrain,Bangladesh,Bhutan,Brunei,Cambodia,China,Cyprus,Federated States of Micronesia,Fiji,India,Indonesia,Iran,Iraq,Japan,Jordan,Kazakhstan,Kiribati,Kuwait,Kyrgyzstan,Laos,Lebanon,Malaysia,Maldives,Marshall Islands,Mongolia,Myanmar,Nauru,Nepal,North Korea,Oman,Pakistan,Palau,Papua New Guinea,Philippines,Qatar,Samoa,Saudi Arabia,Singapore,Solomon Islands,South Korea,Sri Lanka,Syria,Tajikistan,Thailand,Timor-Leste,Tonga,Turkmenistan,Tuvalu,United Arab Emirates,Uzbekistan,Vanuatu,Vietnam,Yemen",
    "eastern_european": "Albania,Armenia,Azerbaijan,Belarus,Bosnia and Herzegovina,Bulgaria,Croatia,Czech Republic,Estonia,Georgia,Hungary,Latvia,Lithuania,Moldova,Montenegro,North Macedonia,Poland,Romania,Russia,Serbia,Slovakia,Slovenia,Ukraine",
    "latin_american": "Antigua and Barbuda,Argentina,The Bahamas,Barbados,Belize,Bolivia,Brazil,Chile,Colombia,Costa Rica,Cuba,Dominica,Dominican Republic,Ecuador,El Salvador,Grenada,Guatemala,Guyana,Haiti,Honduras,Jamaica,Mexico,Nicaragua,Panama,Paraguay,Peru,Saint Kitts and Nevis,Saint Lucia,Saint Vincent and the Grenadines,Suriname,Trinidad and Tobago,Uruguay,Venezuela",
    # Turkey takes part in both WEOG and the Asia-Pacific Group; it is listed under WEOG for elections. The US is a WEOG observer counted for elections.
    "western_european_and_others": "Andorra,Australia,Austria,Belgium,Canada,Denmark,Finland,France,Germany,Greece,Iceland,Ireland,Israel,Italy,Liechtenstein,Luxembourg,Malta,Monaco,Netherlands,New Zealand,Norway,Portugal,San Marino,Spain,Sweden,Switzerland,Turkey,United Kingdom,United States",
}
un = {
    "note": "UN Security Council in 2000 and the regional groups that elect its non-permanent members. Elections from 2002 on are simulated within each group. Resolution and voting values are gameplay estimates.",
    "permanent": ["CHN", "FRA", "RUS", "GBR", "USA"],
    "seats": {"african": 3, "asia_pacific": 2, "eastern_european": 1, "latin_american": 2, "western_european_and_others": 2},
    "groups": {k: tags(v) for k, v in groups_src.items()},
    "elected": [
        {"tags": ["ARG", "CAN", "MYS", "NAM", "NLD"], "from": "1999-01-01", "until": "2000-12-31"},
        {"tags": ["BGD", "JAM", "MLI", "TUN", "UKR"], "from": "2000-01-01", "until": "2001-12-31"},
        {"tags": ["COL", "IRL", "MUS", "NOR", "SGP"], "from": "2001-01-01", "until": "2002-12-31"},
    ],
    "source": [wiki("List of members of the United Nations Security Council"), wiki("United Nations Regional Groups")],
    "confidence": "verified",
}
os.makedirs(os.path.join(ROOT, "data/diplomacy"), exist_ok=True)
for name, obj in (("blocs", blocs), ("un", un)):
    with open(os.path.join(ROOT, f"data/diplomacy/{name}.json"), "w", encoding="utf8", newline="\n") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write("\n")
print("wrote", sum(len(b["members_2000"]) for b in blocs["blocs"]), "memberships;", sum(len(v) for v in un["groups"].values()), "UN group entries")
