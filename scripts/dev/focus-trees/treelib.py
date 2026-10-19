"""Shared helpers for focus-tree generators (the Russian model tree's style). Each country script:
    from treelib import *
    T = Tree("irq", "IRQ")
    T.f(...)
    T.write(name, note, sources)
"""
import json

IG = lambda g, v: {"add_interest_group_approval": {"group": g, "value": v}}
IGI = lambda g, v: {"add_interest_group_influence": {"group": g, "value": v}}
MOD = lambda m, v, days=1460: {"add_timed_modifier": {"modifier": m, "value": v, "days": days}}
LAW = lambda c, l: {"change_law": {"category": c, "law": l}}
PP = lambda v: {"add_political_power": v}
STAB = lambda v: {"add_stability": v}
WS = lambda v: {"add_war_support": v}
UNREST = lambda v: {"add_unrest": v}
GROUP = lambda g, v: {"add_ideology_support": {"group": g, "value": v}}
OPN = lambda t, v: {"add_opinion": {"target": t, "value": v, "days": 1825}}
TREAS = lambda v: {"add_treasury": v}
RB = lambda cat, v=0.2, uses=2: {"add_research_bonus": {"category": cat, "value": v, "uses": uses}}
EQUIP = lambda n: {"add_equipment": {"family": "infantry_equipment", "amount": n}}
DIVS = lambda t, n: {"add_divisions": {"template": t, "count": n}}
POP = lambda v: {"add_ruling_party_popularity": v}
CASH = lambda v: {"treasury_above": v}
AFTER = lambda d: {"date_after": d}
BEFORE = lambda d: {"date_before": d}
ALL = lambda *a: {"all": list(a)}
ANY = lambda *a: {"any": list(a)}
NOT = lambda a: {"not": a}
LEAVE = {"leave_history": True}
ALT = ANY({"follows_history": False}, {"is_player": True})
HIST = {"follows_history": True}
SUP = lambda g, v: {"ideology_group_support_above": {"group": g, "value": v}}
HASP = lambda g: {"has_party_of_group": g}
RULED = lambda g: {"ruling_ideology_group": g}
WAR_WITH = lambda t: {"at_war_with": t}
GENERIC_SPIRITS = {"endemic_corruption", "anti_corruption_campaign", "brain_drain", "war_economy", "reconstruction_effort", "professional_civil_service",
                   "digital_government", "austerity", "stimulus", "balanced_budget", "export_led_growth", "sovereign_wealth_fund", "state_planning",
                   "open_society", "mobilised_nation", "military_rule", "religious_revival", "armed_neutrality", "science_drive", "universal_healthcare"}


class Tree:
    def __init__(self, prefix, tag):
        self.p, self.tag, self.F = prefix, tag, []

    def sid(self, s):
        return s if s in GENERIC_SPIRITS or s.startswith(self.p + "_") else f"{self.p}_{s}"

    # spirits
    def SPIRIT(self, s): return {"add_spirit": self.sid(s)}
    def REMOVE(self, s): return {"remove_spirit": self.sid(s)}
    def SWAP(self, a, b): return {"swap_spirit": {"from": self.sid(a), "to": self.sid(b)}}
    def HAS(self, s): return {"has_spirit": self.sid(s)}

    def BUILD(self, b, n, *adm1):
        d = {"building": b, "count": n}
        if adm1: d["regions"] = [{"from": self.tag, "adm1": list(adm1)}]
        return {"add_buildings": d}

    def PRES(self, person, office=None):
        return {"holds_office": {"person": person if "." in person else f"{self.p}.{person}", "office": office or f"{self.p}.president"}}

    def f(self, id, name, desc, x, y, effects, pre=None, excl=None, avail=None, days=70, ai=1):
        q = lambda i: i if i.startswith(self.p + "_") else f"{self.p}_{i}"
        d = {"id": q(id), "name": name, "description": desc, "x": x, "y": y, "days": days}
        if pre: d["prerequisites"] = [[q(p) for p in g.split("|")] for g in pre]
        if excl: d["mutually_exclusive"] = [q(e) for e in excl]
        if avail is not None: d["available"] = avail
        d["effects"] = effects
        if ai != 1: d["ai_weight"] = ai
        self.F.append(d)

    def political_paths(self, x0, root_name, root_desc, hist_name, hist_desc, hist_avail, paths, junta=True):
        """A political branch: a historical node plus alternative paths. `paths` is a list of dicts
        {key, group, start, start_desc, build, gov_name, gov_desc, gov_type?, gate, extra:[(id, name, desc, effects)]}."""
        T = self
        keys = ["steady"] + [p["key"] for p in paths] + (["army_steps_in"] if junta else [])
        ex = lambda me: [k if k != "steady" else "steady_course" for k in keys if k != me]
        n = len(keys)
        T.f("question_of_power", root_name, root_desc, x0 + n, 0, [PP(30)], ai=5)
        T.f("steady_course", hist_name, hist_desc, x0, 1, [STAB(0.04), PP(40)], pre=["question_of_power"], excl=ex("steady"), avail=hist_avail, ai=20)
        x = x0 + 2
        for p in paths:
            k = p["key"]
            T.f(k, p["start"], p["start_desc"], x, 1, [LEAVE, GROUP(p["group"], 0.04)] + p.get("start_fx", []),
                pre=["question_of_power"], excl=ex(k), avail=ALL(ALT, HASP(p["group"]), NOT(RULED(p["group"])), p["gate"]), ai=p.get("ai", 0.3))
            T.f(k + "_build", p["build"][0], p["build"][1], x, 2, [GROUP(p["group"], 0.05)] + p["build"][2], pre=[k])
            inst = {"ideology": p["group"]}
            if p.get("gov_type"): inst["government_type"] = p["gov_type"]
            T.f(k + "_government", p["gov_name"], p["gov_desc"], x, 3, [{"install_government": inst}, STAB(-0.05)] + p.get("gov_fx", []),
                pre=[k + "_build"], avail=SUP(p["group"], p.get("threshold", 0.2)), days=105)
            y = 4
            prev = k + "_government"
            for (eid, ename, edesc, efx) in p.get("extra", []):
                T.f(eid, ename, edesc, x, y, efx, pre=[prev])
                prev, y = eid, y + 1
            x += 2
        if junta:
            T.f("army_steps_in", "The army steps in", "With the state in crisis, the generals prepare to take over.", x, 1,
                [LEAVE, IGI("military", 0.08), IG("military", 5)], pre=["question_of_power"], excl=ex("army_steps_in"),
                avail=ALL(ALT, {"stability_below": 0.3}, ANY({"unrest_above": 0.4}, {"ig_approval_below": {"group": "military", "value": 35}})), ai=0.2)
            T.f("military_council", "Military council", "The armed forces remove the government. The coup may fail.", x, 2,
                [{"trigger_coup": {"by": "military", "success_chance": 0.6}}], pre=["army_steps_in"], days=35)
            T.f("martial_order", "Martial order", "A state of emergency, a curfew and military courts.", x, 3,
                [LAW("civil_rights", "security_state"), self.SPIRIT("military_rule"), UNREST(-0.08)], pre=["military_council"], avail={"government_type": "military_junta"})
            T.f("return_to_barracks", "Return to the barracks", "The council hands power to an elected government.", x, 4,
                [{"set_government_type": "transitional_administration"}, LAW("political_freedom", "free_elections"), self.REMOVE("military_rule"), STAB(0.05)],
                pre=["martial_order"], avail={"government_type": "military_junta"}, days=140, ai=0.5)
            x += 2
        return x

    def write(self, name, note, sources, accessed="2026-10-19"):
        F = self.F
        ids = [x["id"] for x in F]
        assert len(ids) == len(set(ids)), [i for i in ids if ids.count(i) > 1]
        pos = [(x["x"], x["y"]) for x in F]
        assert len(pos) == len(set(pos)), [p for p in pos if pos.count(p) > 1]
        for x in F:
            for g in x.get("prerequisites", []):
                for p in g: assert p in ids, (x["id"], p)
            for m in x.get("mutually_exclusive", []): assert m in ids, (x["id"], m)
        tree = {"id": self.p, "name": name, "countries": [self.tag], "note": note,
                "source": [{"url": "https://en.wikipedia.org/wiki/" + t.replace(" ", "_"), "title": "Wikipedia: " + t, "accessed": accessed} for t in sources],
                "confidence": "verified", "focuses": F}
        path = f"data/focus_trees/{self.p}.json"
        json.dump(tree, open(path, "w", encoding="utf8", newline="\n"), indent=2, ensure_ascii=False)
        open(path, "a", encoding="utf8", newline="\n").write("\n")
        print(path, len(F), "focuses")


def write_spirits(prefix, note, spirits):
    path = f"data/spirits/{prefix}.json"
    json.dump({"note": note, "spirits": spirits}, open(path, "w", encoding="utf8", newline="\n"), indent=2, ensure_ascii=False)
    open(path, "a", encoding="utf8", newline="\n").write("\n")


def start_spirit(id, name, desc, kind, mods, tag, article, review=None):
    s = {"id": id, "name": name, "description": desc, "kind": kind, "modifiers": mods, "start": [tag],
         "source": [{"url": "https://en.wikipedia.org/wiki/" + article.replace(" ", "_"), "title": "Wikipedia: " + article, "accessed": "2026-10-19"}],
         "confidence": "needs_review" if review else "verified"}
    if review: s["review_note"] = review
    return s


def spirit(id, name, desc, kind, mods):
    return {"id": id, "name": name, "description": desc, "kind": kind, "modifiers": mods}


def write_decisions(prefix, tag, label, decisions):
    """decisions: list of (id, name, desc, focus_id, pp, effects, available or None, cooldown)."""
    out = {"categories": [{"id": f"{prefix}_projects", "name": label, "description": "Projects that the national focuses open up."}], "decisions": []}
    for (id, name, desc, focus, pp, fx, avail, cd) in decisions:
        d = {"id": id, "name": name, "description": desc, "category": f"{prefix}_projects", "countries": [tag], "visible": {"has_completed_focus": focus}}
        if avail: d["available"] = avail
        d.update({"cost": {"political_power": pp}, "effects": fx, "cooldown_days": cd, "ai_weight": 2})
        out["decisions"].append(d)
    path = f"data/decisions/{prefix}.json"
    json.dump(out, open(path, "w", encoding="utf8", newline="\n"), indent=2, ensure_ascii=False)
    open(path, "a", encoding="utf8", newline="\n").write("\n")


DEMOCRACY_PATHS = {
    "liberal_democratic": dict(key="liberal_turn", start="A liberal turn", start_desc="Liberal parties ({ex}) gain ground on reform and civil liberties.",
        build=("Reform agenda", "A programme of deregulation and civil liberties.", [IG("urban_middle_class", 4), IG("business", 3)]),
        gov_name="A liberal government", gov_desc="The most popular liberal party leads the government.",
        gate=ANY({"stability_below": 0.6}, {"ig_approval_below": {"group": "urban_middle_class", "value": 45}}),
        extra=[("liberal_reforms", "Liberal reforms", "Cut red tape and open markets.", [LAW("trade", "free_trade"), MOD("private_sector_output", 0.05, 2920), {"add_spirit": "open_society"}])]),
    "social_democratic": dict(key="left_turn", start="A turn to the left", start_desc="Parties of the left ({ex}) gain on wages, welfare and public services.",
        build=("Unions and voters", "Unions and young voters rally to the left.", [IG("labour_unions", 5), IG("youth_students", 3)]),
        gov_name="A left-wing government", gov_desc="The most popular party of the democratic left leads the government.",
        gate=ANY({"gdp_growth_below": 1.5}, {"unrest_above": 0.15}, {"ig_approval_below": {"group": "labour_unions", "value": 45}}),
        extra=[("welfare_expansion", "Expand the welfare state", "Public health care and higher pensions.", [{"add_spirit": "universal_healthcare"}, {"set_budget": {"spending": 1}}, IG("labour_unions", 4)])]),
    "conservative": dict(key="conservative_turn", start="A conservative turn", start_desc="Conservative parties ({ex}) gain on order, tax cuts and tradition.",
        build=("Business and the countryside", "Business and rural voters rally to the right.", [IG("business", 4), IG("rural", 3)]),
        gov_name="A conservative government", gov_desc="The most popular conservative party leads the government.",
        gate=ANY({"stability_below": 0.6}, {"gdp_growth_below": 1.5}),
        extra=[("fiscal_discipline", "Fiscal discipline", "Cut spending and taxes to balance the budget.", [{"add_spirit": "balanced_budget"}, {"set_budget": {"spending": -1, "revenue": -0.5}}])]),
    "nationalist_populist": dict(key="populist_turn", start="A populist wave", start_desc="National-populist parties ({ex}) gain on immigration and sovereignty.",
        build=("Rallies and referendums", "Mass rallies and calls for referendums.", [WS(0.03), IG("minorities", -4)]),
        gov_name="A national-populist government", gov_desc="The most popular national-populist party leads the government.",
        gate=ANY({"stability_below": 0.5}, {"unrest_above": 0.15}),
        extra=[("sovereignty_first", "Sovereignty first", "Restrict immigration and limit the power of international bodies.", [LAW("immigration", "restrictive_immigration"), MOD("foreign_influence_resistance", 0.1, 2920), IG("minorities", -6)])]),
    "socialist_communist": dict(key="socialist_turn", start="A socialist turn", start_desc="Socialist and communist parties ({ex}) gain in a crisis.",
        build=("Strikes and occupations", "Strikes and workplace occupations.", [IG("labour_unions", 6), IG("business", -4)]),
        gov_name="A socialist government", gov_desc="The most popular socialist party leads the government.",
        gate=ANY({"gdp_growth_below": 0.5}, {"unrest_above": 0.25}), threshold=0.25,
        extra=[("public_ownership", "Public ownership", "Nationalise the banks and the largest companies.", [LAW("economic_system", "state_capitalism"), {"add_spirit": "state_planning"}, IG("business", -10)])]),
    "religious": dict(key="religious_turn", start="A religious turn", start_desc="Religious parties ({ex}) gain as faith returns to politics.",
        build=("Faith networks", "Congregations and charities organise.", [IG("religious_establishment", 6)]),
        gov_name="A religious government", gov_desc="The most popular religious party leads the government.",
        gate=ANY({"stability_below": 0.5}, {"ig_influence_above": {"group": "religious_establishment", "value": 0.15}}),
        extra=[("faith_in_public_life", "Faith in public life", "Religious education and an official religion.", [LAW("religion_state", "official_religion"), {"add_spirit": "religious_revival"}])]),
}


def democracy_paths(T, x0, examples, hist_name="Democratic government", hist_desc="Parties alternate in power through elections, as they historically did.", junta=True):
    """examples: {group: 'Party A, Party B'} for the groups this country has parties in (order kept)."""
    import copy
    paths = []
    for g, ex in examples.items():
        p = copy.deepcopy(DEMOCRACY_PATHS[g]); p["group"] = g
        p["start_desc"] = p["start_desc"].format(ex=ex)
        p["extra"] = [(f"{T.p}_{eid}", n, d, fx) for (eid, n, d, fx) in p["extra"]]
        paths.append(p)
    return T.political_paths(x0, "The direction of the country", "Which camp governs the country.", hist_name, hist_desc, HIST, paths, junta=junta)


def society_branch(T, x0):
    """A generic society, science and infrastructure branch (no named real policies) for the majors."""
    f = T.f
    f("society", "Society and science", "Health, schools, research and the infrastructure of everyday life.", x0 + 2, 0, [PP(20)], ai=3)
    f("health_investment", "Invest in hospitals", "New hospitals and more doctors.", x0, 1, [MOD("health_outcomes", 0.04, 3650), TREAS(-1)], pre=["society"], avail=CASH(1))
    f("schools_investment", "Invest in schools", "Smaller classes and better-paid teachers.", x0 + 2, 1, [MOD("education_quality", 0.04, 3650), IG("youth_students", 3)], pre=["society"])
    f("research_agency", "A research agency", "Grants for breakthrough research.", x0 + 4, 1, [T.SPIRIT("science_drive"), RB("industry_energy", 0.2, 1)], pre=["society"])
    f("elderly_care", "Care for the elderly", "Care homes and home care for an ageing population.", x0, 2, [{"set_budget": {"spending": 0.3}}, IG("rural", 2), STAB(0.01)], pre=["health_investment"])
    f("universities", "Leading universities", "Funding for the top universities.", x0 + 2, 2, [RB("economy_digital", 0.2, 2)], pre=["schools_investment|research_agency"])
    f("ai_and_computing", "Artificial intelligence and computing", "Supercomputers and data centres.", x0 + 4, 2, [T.BUILD("data_centre", 2), RB("electronics_cyber", 0.2, 1)], pre=["research_agency"], avail=AFTER("2015-01-01"))
    f("affordable_housing", "Affordable housing", "Build homes the young can afford.", x0, 3, [MOD("construction_speed", 0.05, 2920), IG("youth_students", 3), TREAS(-1)], pre=["elderly_care"], avail=CASH(1))
    f("broadband", "Broadband everywhere", "Fast internet in every town and village.", x0 + 2, 3, [T.BUILD("data_centre", 1), T.BUILD("infrastructure", 1), IG("rural", 3)], pre=["universities"])
    f("space_and_satellites", "Space and satellites", "Satellites for navigation and observation.", x0 + 4, 3, [RB("air_drones", 0.15, 1), MOD("intelligence_power", 0.03, 3650)], pre=["ai_and_computing"])
    f("public_transport", "Public transport", "Trams, metros and regional trains.", x0, 4, [T.BUILD("infrastructure", 2), IG("urban_middle_class", 3)], pre=["affordable_housing"])
    f("digital_state", "A digital state", "Public services online.", x0 + 2, 4, [T.SPIRIT("digital_government")], pre=["broadband"])
    f("biotech", "Biotechnology", "Vaccines and medicines made at home.", x0 + 4, 4, [T.BUILD("civilian_factory", 1), MOD("health_outcomes", 0.02, 3650)], pre=["space_and_satellites"])
    f("climate_adaptation", "Climate adaptation", "Flood defences and water management.", x0 + 2, 5, [T.BUILD("infrastructure", 1), STAB(0.01)], pre=["public_transport|digital_state|biotech"], avail=AFTER("2010-01-01"))
