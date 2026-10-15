"""Dev audit helper: summarise a drafted country folder for review.
Usage: python -I -X utf8 scripts/dev/audit-country.py TAG
"""
import json, sys
t = sys.argv[1]
d = f"data/countries/{t}"
L = lambda f: json.load(open(f"{d}/{f}", encoding="utf8"))
c, pe, pa, el = L("country.json"), L("people.json")["people"], L("parties.json")["parties"], L("elections.json")
print(f"== {t} {c['name']['en']} gov={c['government']['type']} exec={c['government']['effective_executive']} conf={c['confidence']}")
for o in c["offices"]:
    print(f"  office {o['id']} ({o['role']}, {o['selection']}):", " | ".join(f"{h['person']} {h['from']}..{h.get('to','')}{' acting' if h.get('acting') else ''}" for h in o["holders"]))
for ch in (c.get("legislature") or {}).get("chambers", []):
    print(f"  chamber {ch['id']} {ch['seats']} {ch['system']['type']} seats_2000={ch['seats_2000']}")
print("  ruling", c["start_2000"]["ruling_parties"], "c&s", c["start_2000"].get("confidence_and_supply"))
print(f"  people {len(pe)} parties {len(pa)} elections {len(el['elections'])} rules {[ (r['kind'], r.get('chamber') or r.get('office'), r['every_years'], r.get('system')) for r in el['rules']]}")
for e in el["elections"][-4:]:
    h = e["historical"]
    print(f"  last {e['id']} {e['date']} winner={h.get('winner')} conf={h['confidence']} note={str(h.get('note',''))[:160]}")
nr = [x for x in pe + pa if x["confidence"] == "needs_review"] + [e for e in el["elections"] if e["historical"]["confidence"] == "needs_review"]
print(f"  needs_review: {len(nr)}")
for x in nr[:12]:
    print("   -", x.get("id"), (x.get("review_note") or x.get("historical", {}).get("review_note", ""))[:150])
txt = open(f"{d}/country.json", encoding="utf8").read() + open(f"{d}/elections.json", encoding="utf8").read()
import re
late = sorted(set(re.findall(r"20(?:26)-(?:0[7-9]|1[0-2])-\d\d", txt)))
print("  dates after June 2026:", late)
print("  sample births:", [(p["id"], p.get("birth_date", p["birth_year"])) for p in pe[:6]])
