"""Build The Push game data from the Ringside Wrestling Archive (Kaggle, CC0).

    python scripts/fetch_ringside.py          # once: downloads to data/raw/ringside
    python scripts/import_ringside.py         # writes data/generated/*

Outputs
    data/generated/ring.json    criteria + wrestler pool for the Immaculate Ring
    data/generated/trivia.json  question bank for the Daily Five
    data/generated/REPORT.md    counts and spot-check lists; read it after every import

Curation (the Google Sheet tabs, exported as CSV) lives in data/curation/:
    merges.csv  one person split across several dataset ids or ring names
    tags.csv    facts the dataset lacks (AEW titles, Hall of Fame, ...) or gets wrong
    questions.csv  community trivia; only rows with "approved" set are used
"""
import collections
import csv
import json
import pathlib
import random
import re
import unicodedata
import sys
import zlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data/raw/ringside"
OUT = ROOT / "data/generated"
CUR = ROOT / "data/curation"

# The archive's 2025-06+ scrape files thousands of indie shows under the major
# promotions. Before this date events are trusted; after it, only events whose
# name looks like that promotion's own programming are kept.
TRUST_UNTIL = "2025-06-01"
SHOW_PATTERNS = {
    "WWE": r"^(WWE |WWF |Monday Night Raw|Raw\b|SmackDown|Friday Night SmackDown|Main Event|Saturday Night.s Main Event|WrestleMania|Royal Rumble|SummerSlam|Survivor Series|Money in the Bank|Elimination Chamber|Night of Champions|Crown Jewel|Clash in Paris|Backlash|Wrestlepalooza|Evolution|King and Queen of the Ring)",
    "AEW": r"^(AEW |Dynamite|Collision|Rampage|All In|All Out|Double or Nothing|Revolution|Full Gear|Forbidden Door|Dynasty|Worlds End|WrestleDream|Grand Slam|Fight for the Fallen|Fyter Fest|Battle of the Belts)",
    "NXT": r"^(NXT|WWE NXT)",
    "TNA": r"^(TNA|Impact|iMPACT|Bound for Glory|Slammiversary|Hard To Kill|Rebellion|Genesis|Sacrifice|Against All Odds|Victory Road)",
}
# WCW and ECW events after the sales are WWF "Invasion" shows, not the real thing
PROMO_UNTIL = {"WCW": "2001-03-27", "ECW": "2001-04-05"}
# Fragments left by splitting "Ted DiBiase, Jr." style names; never real people.
JUNK_NAMES = {"Jr.", "Jr", "Sr.", "Sr"}
MIN_PROMO_MATCHES = 3
MIN_POOL_MATCHES = 15

TITLE_GROUPS = {
    "wweChamp": {"WWWF World Heavyweight Title", "WWF World Heavyweight Title", "WWF Undisputed Title",
                 "WWE Championship", "WWE World Heavyweight Championship", "Undisputed WWE Championship"},
    "whc": {"World Heavyweight Championship (WWE)", "WWE World Championship"},
    "universal": {"WWE Universal Championship"},
    "wcwChamp": {"WCW World Heavyweight Title", "WCW International World Heavyweight Championship"},
    "ecwChamp": {"ECW World Heavyweight Title"},
    "ic": {"WWF Intercontinental Title", "WWE Intercontinental Championship"},
    "us": {"WCW United States Title", "WWE United States Championship"},
    "tv": {"WCW World Television Title", "ECW World Television Title"},
    "cruiser": {"WCW Cruiserweight Championship", "WWF Light Heavyweight Title", "WWF Cruiserweight Title",
                "WWE Cruiserweight Title", "NXT Cruiserweight Championship"},
    "hardcore": {"WWF Hardcore Title", "WWE Hardcore Title", "WCW Hardcore Title"},
    "european": {"WWF European Title", "WWE European Championship"},
    "nxtChamp": {"NXT Championship"},
    "twentyFourSeven": {"WWE 24/7 Title"},
}

# id, group, family (a cell never pairs two criteria of one family), label, detail
CRITERIA = [
    ("wwe", "promotion", "wwe", "WWF / WWE", "Wrestled on the WWF/WWE main roster (Raw, SmackDown, PPVs). NXT alone doesn't count."),
    ("nxt", "promotion", "nxt", "NXT", "Wrestled for NXT."),
    ("wcw", "promotion", "wcw", "WCW", "Wrestled for WCW before it was sold in March 2001."),
    ("ecw", "promotion", "ecw", "ECW", "Wrestled for the original ECW (1992-2001)."),
    ("tna", "promotion", "tna", "TNA / Impact", "Wrestled for TNA / Impact."),
    ("aew", "promotion", "aew", "AEW", "Wrestled for AEW."),
    ("wweChamp", "title", "wwe", "WWE Champion", "Held the WWF/WWE Championship."),
    ("whc", "title", "wwe", "World Heavy­weight Champ",  # soft hyphen: breaks cleanly in narrow pads
      "Held WWE's World Heavyweight Championship, the 2002-13 'big gold belt' or the 2023- title. Not the WWE Championship."),
    ("universal", "title", "wwe", "Universal Champion", "Held the WWE Universal Championship."),
    ("wcwChamp", "title", "wcw", "WCW World Champion", "Held the WCW World Heavyweight Championship."),
    ("ecwChamp", "title", "ecw", "ECW World Champion", "Held the ECW World Heavyweight Championship (any era)."),
    ("aewChamp", "title", "aew", "AEW World Champion", "Held the AEW World Championship."),
    ("ic", "title", "wwe", "IC Champion", "Held the WWF/WWE Intercontinental Championship."),
    ("us", "title", "us", "U.S. Champion", "Held the United States Championship, in WCW or WWE."),
    ("tv", "title", "tv", "WCW/ECW TV Champ", "Held the WCW World Television or ECW World Television title. Other mid-card belts don't count."),
    ("cruiser", "title", "cruiser", "Cruiser Champ", "Held a WCW/WWF/WWE/NXT Cruiserweight or Light Heavyweight title."),
    ("hardcore", "title", "hardcore", "Hardcore Champion", "Held a WWF/WWE or WCW Hardcore title."),
    ("european", "title", "wwe", "European Champion", "Held the WWF/WWE European Championship."),
    ("nxtChamp", "title", "nxt", "NXT Champion", "Held the NXT Championship."),
    ("twentyFourSeven", "title", "wwe", "24/7 Champion", "Held the WWE 24/7 Championship."),
    ("tag", "title", "tag", "Tag Team Champion", "Held any tag team title in WWE, WCW, ECW, NXT or TNA. NXT, Raw and SmackDown tag titles all count."),
    ("womens", "title", "womens", "Women's Champion", "Held any singles women's title in WWE or NXT, including the Divas title."),
    ("rumble", "accolade", "rumble", "Rumble Winner", "Won a Royal Rumble match (men's or women's)."),
    ("wmMain", "accolade", "wm", "WM Main Event", "Was in the final match of a WrestleMania night."),
    ("aewPpvMain", "accolade", "aew", "AEW PPV Main Event", "Was in the final match of an AEW pay-per-view."),
    ("hiac", "match", "hiac", "Hell in a Cell", "Wrestled inside Hell in a Cell."),
    ("cage", "match", "cage", "Steel Cage", "Wrestled in a steel cage match (not Hell in a Cell)."),
    ("ladder", "match", "ladder", "Ladder / TLC", "Wrestled in a ladder or TLC match."),
    ("marathon", "match", "marathon", "30-Minute Singles Match", "Wrestled a singles match lasting 30+ minutes."),
    ("d1980s", "era", "era", "Wrestled in the '80s", "Has 3+ recorded major-promotion matches in 1980-89."),
    ("d1990s", "era", "era", "Wrestled in the '90s", "Has 3+ recorded major-promotion matches in 1990-99."),
    ("d2000s", "era", "era", "Wrestled in the 2000s", "Has 3+ recorded major-promotion matches in 2000-09."),
    ("d2010s", "era", "era", "Wrestled in the 2010s", "Has 3+ recorded major-promotion matches in 2010-19."),
    ("d2020s", "era", "era", "Wrestled in the 2020s", "Has 3+ recorded major-promotion matches in 2020-."),
    # Beyond the ring (from Wikidata, matched by name; gaps get patched in the tags sheet)
    ("actor", "life", "actor", "Actor", "Has acted in film or TV (Wikidata lists them as an actor)."),
    ("music", "life", "music", "Musician", "Has worked as a singer, rapper or musician."),
    ("combat", "life", "combat", "MMA or Boxing", "Has fought as an MMA fighter or boxer."),
    ("amateur", "life", "amateur", "Amateur Wrestler", "Competed in amateur (scholastic, collegiate or Olympic-style) wrestling."),
    ("olympian", "life", "olympian", "Olympian", "Competed at the Olympic Games, in any sport."),
    ("profootball", "life", "football", "Pro Football", "Played professional football in the NFL, CFL or AFL."),
    ("college", "life", "college", "College Athlete", "Played on an NCAA college team (football, basketball and so on)."),
    ("strength", "life", "strength", "Strength Athlete", "Competed as a bodybuilder, powerlifter, weightlifter or strongman."),
    ("bornCA", "life", "born", "Born in Canada", "Born in Canada."),
    ("bornJP", "life", "born", "Born in Japan", "Born in Japan."),
    ("bornMX", "life", "born", "Born in Mexico", "Born in Mexico."),
    ("bornUK", "life", "born", "Born in the UK", "Born in the United Kingdom."),
    ("bornAbroad", "life", "born", "Born Outside the US", "Born anywhere other than the United States."),
    ("family", "life", "family", "Wrestling Family", "Parent, child or sibling was also a pro wrestler."),
    # Japan and Mexico (Wikipedia champion and winner lists; scripts/fetch_titles.py)
    ("iwgpChamp", "title", "iwgp", "IWGP Heavyweight Champ", "Held NJPW's IWGP Heavyweight or IWGP World Heavyweight Championship."),
    ("never", "title", "never", "NEVER Openweight Champ", "Held NJPW's NEVER Openweight Championship."),
    ("iwgpJr", "title", "iwgpJr", "IWGP Junior Champ", "Held NJPW's IWGP Junior Heavyweight Championship."),
    ("tripleCrown", "title", "ajpw", "Triple Crown Champion", "Held All Japan's Triple Crown Heavyweight Championship."),
    ("ghc", "title", "noah", "GHC Heavyweight Champ", "Held NOAH's GHC Heavyweight Championship."),
    ("stardomChamp", "title", "stardom", "World of Stardom Champ", "Held Stardom's World of Stardom Championship."),
    ("cmllChamp", "title", "cmll", "CMLL Heavyweight Champ", "Held the CMLL World Heavyweight Championship."),
    ("aaaMega", "title", "aaa", "AAA Mega Champion", "Held AAA's Mega Championship."),
    ("g1", "accolade", "g1", "G1 Climax Winner", "Won NJPW's G1 Climax tournament (1991-)."),
    ("bosj", "accolade", "bosj", "Super Juniors Winner", "Won NJPW's Best of the Super Juniors tournament."),
    ("carnival", "accolade", "carnival", "Champion Carnival Winner", "Won All Japan's Champion Carnival tournament."),
    ("reyDeReyes", "accolade", "reyDeReyes", "Rey de Reyes Winner", "Won AAA's Rey de Reyes tournament."),
    ("gaijin", "accolade", "gaijin", "Gaijin", "Non-Japanese wrestler who held a Japanese title or won a Japanese tournament."),
    ("legacy", "accolade", "legacy", "Lucha Legacy", "Works a family or inherited lucha name: El Hijo de..., Jr., II, or a passed-down mask."),
]
CRITERION_IDS = {c[0] for c in CRITERIA}
# Criteria that belong to one scene. They stay out of the main daily grid until region
# cards exist (see docs/regions.md); the main grid is built from criteria with no scene.
SCENE = {"iwgpChamp": "jp", "never": "jp", "iwgpJr": "jp", "tripleCrown": "jp", "ghc": "jp", "stardomChamp": "jp",
         "g1": "jp", "bosj": "jp", "carnival": "jp", "gaijin": "jp",
         "cmllChamp": "mx", "aaaMega": "mx", "reyDeReyes": "mx", "legacy": "mx"}
JP_BELTS = {k for k, v in SCENE.items() if v == "jp" and k != "gaijin"}
MX_BELTS = {k for k, v in SCENE.items() if v == "mx" and k != "legacy"}
# Lucha legacy names: El Hijo de / del, La Hija de, Jr., or a numeral (Rey Mysterio Jr., Dr. Wagner Jr., Black Warrior II).
# Only checked on lucha wrestlers (a Mexican belt or born in Mexico), so Ted DiBiase Jr. doesn't count.
LEGACY_NAME = r"(?i:^(El |La )?Hij[oa] del? )|\bJr\.?$|\b(II|III|IV|V)$"
SCENE_JUNK = r"Wrestling|Lucha Libre|Stardom|Brothers|Vacant|unification|Consejo|Championship|,"
TOURNAMENT_LABELS = {"g1": "G1 Climax", "bosj": "Best of the Super Juniors", "carnival": "Champion Carnival",
                     "reyDeReyes": "Rey de Reyes"}
# The archive only has six US promotions, but its 2025-06+ scrape filed some Japanese and
# Mexican shows under them (dropped by TRUST_UNTIL). The report counts them by event name.
INTL_SCENES = [
    ("NJPW", "Japan", r"\bNJPW\b|New Japan"),
    ("AJPW", "Japan", r"\bAJPW\b|All Japan"),
    ("NOAH", "Japan", r"\bNOAH\b"),
    ("Stardom", "Japan", r"Stardom"),
    ("Dragon Gate", "Japan", r"Dragon Gate"),
    ("DDT", "Japan", r"\bDDT\b"),
    ("other Japan", "Japan", r"Osaka Pro|Michinoku|ZERO1|Big Japan|\bBJW\b|Tokyo Joshi|\bTJPW\b|Marigold|Sendai Girls|Ice Ribbon|Gatoh Move|Kaientai|Dradition"),
    ("CMLL", "Mexico", r"\bCMLL\b"),
    ("AAA", "Mexico", r"\bAAA\b|Triplema(n|)ia"),
    ("other Mexico", "Mexico", r"Lucha|\bIWRG\b|The Crash|Naucalpan"),
]
ABROAD_CITIES = {
    "Japan": r"Tokyo|Osaka|Nagoya|Yokohama|Sapporo|Fukuoka|Kobe|Sendai|Hiroshima|Saitama|Chiba|Kyoto|Niigata|Shizuoka",
    "Mexico": r"Mexico City|Ciudad de M|Monterrey|Guadalajara|Tijuana|Puebla|Ju[aá]rez|Le[oó]n|Acapulco|Cancun|Toluca|Naucalpan",
}


def rows(name):
    with open(RAW / f"{name}.csv", newline="", encoding="utf-8") as f:
        yield from csv.DictReader(f)


def clean_name(n):
    n = n.replace("\xa0", " ")
    return re.sub(r"\s*\(c\)\s*$", "", n).strip()


def name_key(n):
    # fold accents first so "André the Giant" and "Andre the Giant" match
    folded = unicodedata.normalize("NFKD", clean_name(n)).encode("ascii", "ignore").decode()
    k = re.sub(r"[^a-z0-9]", "", folded.lower())
    return k[3:] if k.startswith("the") and len(k) > 6 else k


def strip_promo(name):
    return re.sub(r"^(WWF|WWE|WCW|ECW|AEW|TNA|NXT) ", "", name).strip()


def wm_night(name):
    """'WrestleMania 39 - Night 2' style name for a real WrestleMania card, else None."""
    n = strip_promo(name)
    if not re.match(r"^WrestleMania(\s|$)", n) or re.search(r"Axxess|Backlash|Part 1|Kickoff|Fan|\((IL|NY)\)", n):
        return None
    return re.sub(r"\s+", " ", re.sub(r"\s*\(CA\)$", "", n))


def wm_base(night):
    return re.sub(r"\s*-\s*(Night|Day)\s*\d.*$", "", night)


def main():
    report = []
    promos = {r["id"]: r["abbreviation"] for r in rows("promotions")}
    wrestlers = {r["id"]: r for r in rows("wrestlers")}
    raw_count = collections.Counter(r["wrestler_id"] for r in rows("match_participants"))

    # ---- identity: one id per person ---------------------------------------
    parent = {wid: wid for wid in wrestlers}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            keep, drop = (ra, rb) if raw_count[ra] >= raw_count[rb] else (rb, ra)
            parent[drop] = keep

    by_key = collections.defaultdict(list)
    for wid, w in wrestlers.items():
        by_key[name_key(w["ring_name"])].append(wid)
    for ids in by_key.values():  # "Bret Hart (c)", "A.J. Styles" / "AJ Styles", ...
        for other in ids[1:]:
            union(ids[0], other)

    # Gimmick changes: Wikidata lists each wrestler's other ring names, so names that point
    # to exactly one Wikidata person are the same person here too (Dean Douglas -> Shane
    # Douglas, Faarooq -> Ron Simmons, The Blue Blazer -> Owen Hart).
    wd_path = RAW.parent / "wikidata.json"
    if wd_path.exists():
        wd_by_key = collections.defaultdict(set)
        for q, rec in json.loads(wd_path.read_text(encoding="utf-8")).items():
            for n in [rec["label"], *rec["aliases"]]:
                if n and len(name_key(n)) >= 4:
                    wd_by_key[name_key(n)].add(q)
        by_person = collections.defaultdict(list)
        for k, ids in by_key.items():
            qs = wd_by_key.get(k, set())
            if len(qs) == 1:
                by_person[next(iter(qs))].append(ids[0])
        auto = []
        for q, ids in by_person.items():
            roots = {find(i) for i in ids}
            if len(roots) > 1:
                auto.append(sorted({clean_name(wrestlers[i]["ring_name"]) for i in ids}))
                for other in ids[1:]:
                    union(ids[0], other)
        report.append(f"- REVIEW: {len(auto)} gimmick changes merged via Wikidata aliases: "
                      + "; ".join(" = ".join(names) for names in sorted(auto)[:400]))

    alias_merges = 0
    for a in rows("wrestler_aliases"):
        owner, k = a["wrestler_id"], name_key(a["alias"])
        if k != name_key(wrestlers[owner]["ring_name"]) and len(by_key.get(k, [])) == 1 and find(by_key[k][0]) != find(owner):
            union(owner, by_key[k][0])
            alias_merges += 1
    report.append(f"- ids merged because one is listed as the other's alias: {alias_merges}")

    curated_display = {}
    with open(CUR / "merges.csv", newline="", encoding="utf-8") as f:
        for m in csv.DictReader(f):
            keep, merge = by_key.get(name_key(m["keep"])), by_key.get(name_key(m["merge"]))
            if not keep or not merge:
                report.append(f"- MERGE SKIPPED (name not found): {m['keep']} <- {m['merge']}")
                continue
            union(keep[0], merge[0])
            if m["display"]:
                curated_display[name_key(m["keep"])] = m["display"]
    cid = find
    members = collections.defaultdict(set)
    for wid in wrestlers:
        members[cid(wid)].add(wid)
    display = {}
    for root, ids in members.items():
        cur = next((curated_display[name_key(wrestlers[i]["ring_name"])] for i in ids
                    if name_key(wrestlers[i]["ring_name"]) in curated_display), None)
        display[root] = cur or clean_name(wrestlers[root]["ring_name"])
    for wid in wrestlers:
        display[wid] = display[cid(wid)]
    report.append(f"- identities: {len(wrestlers)} dataset ids -> {len(members)} people")

    aliases = collections.defaultdict(set)
    for a in rows("wrestler_aliases"):
        aliases[cid(a["wrestler_id"])].add(clean_name(a["alias"]))
    for root, ids in members.items():
        aliases[root].update(clean_name(wrestlers[i]["ring_name"]) for i in ids)

    # ---- events: trust filter + de-duplication ----------------------------
    events, dropped = {}, collections.Counter()
    for e in rows("events"):
        p = promos[e["promotion_id"]]
        if e["date"] >= TRUST_UNTIL and not re.search(SHOW_PATTERNS.get(p, r"^$"), e["name"], re.I):
            dropped[p] += 1
            continue
        e["promo"] = p
        events[e["id"]] = e
    report.append(f"- events kept {len(events)}, dropped as off-brand after {TRUST_UNTIL}: {dict(dropped)}")

    canon_event, seen = {}, {}
    for eid, e in sorted(events.items(), key=lambda kv: (not kv[1]["city"], int(kv[0]))):
        key = (e["promo"], e["date"], strip_promo(e["name"]).lower())
        canon_event[eid] = seen.setdefault(key, eid)
    report.append(f"- duplicate event listings collapsed: {len(canon_event) - len(seen)}")

    # ---- matches -----------------------------------------------------------
    order = {r["id"]: int(float(r["match_order"])) for r in rows("matches") if r["match_order"]}
    matches = {}
    era_names = collections.defaultdict(collections.Counter)  # (person, year) -> ring names used that year
    with open(RAW / "match_view.csv", newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["event_id"] not in events:
                continue
            m = matches.get(r["match_id"])
            if m is None:
                m = matches[r["match_id"]] = {
                    "id": r["match_id"], "event": canon_event[r["event_id"]], "date": r["event_date"],
                    "promo": r["promotion_abbr"], "type": r["match_type"] or "",
                    "stip": (r["stipulation"] or "").lower(), "title": r["title_match"] == "True",
                    "dur": float(r["duration_seconds"]) if r["duration_seconds"] else 0.0,
                    "rating": float(r["rating"]) if r["rating"] else 0.0,
                    "order": order.get(r["match_id"], 0), "parts": [],
                }
            w = cid(r["wrestler_id"])
            era_names[(w, r["event_date"][:4])][clean_name(wrestlers[r["wrestler_id"]]["ring_name"])] += 1
            if all(p[0] != w for p in m["parts"]):
                m["parts"].append((w, r["result"], r["team_number"]))
    uniq, mseen = {}, set()
    for m in matches.values():  # duplicate events leave duplicate copies of each match
        key = (m["event"], m["type"], frozenset(p[0] for p in m["parts"]))
        if key not in mseen:
            mseen.add(key)
            uniq[m["id"]] = m
    matches = uniq
    report.append(f"- matches after de-dup: {len(matches)}")

    # ---- gender: the dataset marks most women as male. Seed with anyone it marks
    # female or who held a women's title, then let singles opponents vote.
    titles = {r["id"]: r for r in rows("titles")}
    womens_titles = {t for t, r in titles.items() if re.search(r"Women|Divas|Knockouts", r["name"]) and "Tag" not in r["name"]}
    gender = {root: "m" for root in members}
    for wid, w in wrestlers.items():
        if (w["gender"] or "").lower().startswith("f"):
            gender[cid(wid)] = "f"
    for r in rows("title_reigns"):
        if r["title_id"] in womens_titles:
            gender[cid(r["wrestler_id"])] = "f"
    singles = [(m["parts"][0][0], m["parts"][1][0]) for m in matches.values() if len(m["parts"]) == 2]
    for _ in range(4):
        votes = collections.defaultdict(collections.Counter)
        for a, b in singles:
            votes[a][gender[b]] += 1
            votes[b][gender[a]] += 1
        for w, c in votes.items():
            if c["f"] + c["m"] >= 3:
                gender[w] = "f" if c["f"] > c["m"] else "m"
    report.append(f"- gender: {collections.Counter(gender[w] for w in members if total_n_raw(w, members, raw_count) >= 15)} among regulars")

    # ---- per-wrestler tags from match history ------------------------------
    tags = collections.defaultdict(set)
    promo_n, decade_n = collections.Counter(), collections.Counter()
    total_n, ppv_n = collections.Counter(), collections.Counter()
    by_event = collections.defaultdict(list)
    for m in matches.values():
        by_event[m["event"]].append(m)
        ev = events[m["event"]]
        wids = [p[0] for p in m["parts"]]
        for wid in wids:
            if m["date"] < PROMO_UNTIL.get(m["promo"], "9999"):
                promo_n[(wid, m["promo"])] += 1
            decade_n[(wid, m["date"][:3])] += 1
            total_n[wid] += 1
            if ev["event_type"] == "ppv":
                ppv_n[wid] += 1
        kind = f"{m['type']} {m['stip']}"
        if "hell in a cell" in kind or "hell_in_a_cell" in kind:
            tags_add(tags, wids, "hiac")
        elif "cage" in kind:
            tags_add(tags, wids, "cage")
        if "ladder" in kind or "tlc" in kind or "tables, ladders" in kind:
            tags_add(tags, wids, "ladder")
        if len(wids) == 2 and m["type"] == "singles" and m["dur"] >= 1800:
            tags_add(tags, wids, "marathon")
    for ms in by_event.values():
        ms.sort(key=lambda m: m["order"])

    for (wid, p), n in promo_n.items():
        if n >= MIN_PROMO_MATCHES and p.lower() in CRITERION_IDS:
            tags[wid].add(p.lower())
    for (wid, dec), n in decade_n.items():
        if n >= 3 and f"d{dec}0s" in CRITERION_IDS:
            tags[wid].add(f"d{dec}0s")

    # ---- accolades derived from cards -------------------------------------
    rumble_wins, wm_mains, aew_mains = [], [], []
    for eid, ms in by_event.items():
        ev = events[eid]
        if not ms:
            continue
        if is_rumble_ppv(ev):
            for m in ms:
                if m["type"] == "royal_rumble":
                    g = match_gender(m, gender)
                    for wid, res, _ in m["parts"]:
                        if res == "win":
                            tags[wid].add("rumble")
                            rumble_wins.append((ev["date"], display[wid], g))
        if ev["promo"] == "WWE" and wm_night(ev["name"]) and (ev["date"] == "1985-03-31" or strip_promo(ev["name"]) != "WrestleMania"):
            main = ms[-1]
            tags_add(tags, [p[0] for p in main["parts"]], "wmMain")
            wm_mains.append((ev["date"], wm_night(ev["name"]), [display[p[0]] for p in main["parts"]]))
        if ev["promo"] == "AEW" and ev["event_type"] == "ppv" and not re.search(r"Zero Hour|Buy In|Taping|Part \d", ev["name"]):
            main = ms[-1]
            tags_add(tags, [p[0] for p in main["parts"]], "aewPpvMain")
            aew_mains.append((ev["date"], ev["name"], [display[p[0]] for p in main["parts"]]))

    # ---- titles -------------------------------------------------------------
    title_group = {}
    for tid, t in titles.items():
        n = t["name"]
        if len(re.findall(r"\b(Title|Titles|Championship|Briefcase|Cup)\b", n)) >= 2:
            continue  # mashed-together names from unification matches; not trusted
        for g, names in TITLE_GROUPS.items():
            if n in names:
                title_group[tid] = g
        if "Tag" in n:
            title_group[tid] = "tag"
        elif re.search(r"Women|Divas|Knockouts", n):
            title_group[tid] = "womens"
    # Singles titles "won" in multi-winner matches are worth a look: some are real
    # (David Arquette, LayCool), some are data errors (Cody Rhodes, Backlash 2009).
    # The grid keeps them all; trivia only asks about sole-winner title changes.
    wins_on = collections.defaultdict(list)
    for m in matches.values():
        if m["title"]:
            for p in m["parts"]:
                if p[1] == "win":
                    wins_on[(m["date"], p[0])].append(m)
    reigns, rejected = [], []
    for r in rows("title_reigns"):
        r["wrestler_id"] = cid(r["wrestler_id"])
        g = title_group.get(r["title_id"])
        won = wins_on.get((r["won_date"], r["wrestler_id"]), [])
        if g and g != "tag" and won and all(has_partner(m, r["wrestler_id"]) for m in won):
            rejected.append(f"{display[r['wrestler_id']]} {titles[r['title_id']]['name']} {r['won_date']}")
        reigns.append(r)
        if g:
            tags[r["wrestler_id"]].add(g)
    report.append(f"- REVIEW: singles-title reigns won only in multi-winner matches (kept for the grid, never asked in trivia): {rejected}")

    # ---- beyond the ring: Wikidata facts ------------------------------------
    wd_names, wd_taken = add_wikidata_tags(members, wrestlers, display, aliases, tags, report)
    unmatched = add_title_lists(members, wrestlers, display, aliases, wd_names, tags, report)

    # ---- curation overrides -----------------------------------------------
    # (after Wikidata, so the tags sheet always has the final say)
    key_to_root = collections.defaultdict(set)
    for wid, w in wrestlers.items():
        key_to_root[name_key(w["ring_name"])].add(cid(wid))
        key_to_root[name_key(display[wid])].add(cid(wid))
    with open(CUR / "tags.csv", newline="", encoding="utf-8") as f:
        for o in csv.DictReader(f):
            ids = key_to_root.get(name_key(o["wrestler"]), set())
            if len(ids) != 1 or o["tag"] not in CRITERION_IDS:
                report.append(f"- TAG OVERRIDE SKIPPED: {dict(o)}")
                continue
            root = next(iter(ids))
            (tags[root].add if o["action"] == "add" else tags[root].discard)(o["tag"])

    # ---- pool ---------------------------------------------------------------
    pool = []
    for root in members:
        t = tags.get(root, set()) & CRITERION_IDS
        # scene titles and tournament wins let in Japanese and Mexican stars the archive barely covers
        titled = bool(t & (set(TITLE_GROUPS) | {"tag", "womens", "aewChamp"} | set(SCENE)))
        if t & JP_BELTS and "nonJP" in tags.get(root, set()):
            t.add("gaijin")
        if (total_n[root] < MIN_POOL_MATCHES and not titled) or re.search(r", | & ", display[root]) or display[root] in JUNK_NAMES:
            continue
        aka = sorted(a for a in aliases[root] if a and name_key(a) != name_key(display[root]))
        pool.append({"id": int(root), "name": display[root], "aka": aka[:8], "g": gender.get(root, ""),
                     "tags": sorted(t), "pop": ppv_n[root] * 3 + total_n[root]})
    pool += scene_people(unmatched, wd_taken, pool, report)
    add_legacy(pool, report)
    # the tags sheet again, now over everyone (scene people from Wikipedia included)
    pool_by_key = collections.defaultdict(list)
    for w in pool:
        pool_by_key[name_key(w["name"])].append(w)
    with open(CUR / "tags.csv", newline="", encoding="utf-8") as f:
        for o in csv.DictReader(f):
            hit = pool_by_key.get(name_key(o["wrestler"]), [])
            if len(hit) == 1 and o["tag"] in CRITERION_IDS:
                t = set(hit[0]["tags"])
                (t.add if o["action"] == "add" else t.discard)(o["tag"])
                hit[0]["tags"] = sorted(t)
    fam = [w for w in pool if "family" in w["tags"]]
    report.append(f"- REVIEW: Wrestling Family ({len(fam)}): " + "; ".join(w["name"] for w in fam[:400]))
    gai = [w for w in pool if "gaijin" in w["tags"]]
    report.append(f"- REVIEW: Gaijin ({len(gai)}): " + "; ".join(w["name"] for w in gai))
    pool.sort(key=lambda w: -w["pop"])
    names = collections.Counter(w["name"] for w in pool)
    report.append(f"- pool size {len(pool)}; duplicate display names: {[n for n, c in names.items() if c > 1][:30]}")

    write_split_candidates(members, display, matches, total_n, report)

    counts = collections.Counter(t for w in pool for t in w["tags"])
    criteria = [{"id": c[0], "group": c[1], "family": c[2], "label": c[3], "detail": c[4], "count": counts[c[0]],
                 **({"scene": SCENE[c[0]]} if c[0] in SCENE else {})} for c in CRITERIA]

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "ring.json").write_text(json.dumps({"criteria": criteria, "wrestlers": pool}, separators=(",", ":"),
                                              ensure_ascii=False), encoding="utf-8")

    name_at = era_namer(era_names, display, wrestlers)
    questions = build_trivia(events, by_event, matches, reigns, title_group, name_at, gender, ppv_n, report)
    questions += build_scene_trivia(report)
    questions += community_questions({q["id"] for q in questions}, report)
    (OUT / "trivia.json").write_text(json.dumps(questions, indent=1, ensure_ascii=False), encoding="utf-8")

    # ---- report -------------------------------------------------------------
    lines = ["# Import report", "", "Read this after every import; spot-check the lists against what you know.", ""]
    lines += report
    lines += intl_coverage(promos, events, pool, criteria)
    lines += ["", "## Criteria counts (pool)", ""] + [f"- {c['id']}: {c['count']}" for c in criteria]
    lines += ["", "## Royal Rumble winners", ""] + [f"- {d} {n} ({g})" for d, n, g in sorted(set(rumble_wins))]
    lines += ["", "## WrestleMania final matches", ""] + [f"- {d} {e}: {' / '.join(p)}" for d, e, p in sorted(wm_mains)]
    lines += ["", "## AEW PPV final matches", ""] + [f"- {d} {e}: {' / '.join(p)}" for d, e, p in sorted(aew_mains)]
    lines += ["", "## Top of pool", ""] + [f"- {w['name']} ({w['g']}): {', '.join(w['tags'])}" for w in pool[:40]]
    lines += ["", "## Trivia counts", ""] + [f"- {k}: {v}" for k, v in collections.Counter(q['type'] for q in questions).items()]
    sample = random.Random(7).sample(questions, min(60, len(questions)))
    lines += ["", "## Trivia sample", ""] + [f"- [{q['type']}] {q['prompt']} -> **{q['options'][q['answer']]}** (of {q['options']})"
                                              for q in sorted(sample, key=lambda q: q["type"])]
    (OUT / "REPORT.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"pool {len(pool)} wrestlers, {len(questions)} questions -> {OUT}")


WIKIDATA_FACTS = {"actor": "actor", "music": "music", "mma": "combat", "boxer": "combat", "amateur": "amateur", "family": "family",
                  "olympian": "olympian", "nfl": "profootball", "cfl": "profootball", "college": "college", "strength": "strength"}
BORN = {"CA": "bornCA", "JP": "bornJP", "MX": "bornMX", "GB": "bornUK"}


def add_title_lists(members, wrestlers, display, aliases, wd_names, tags, report):
    """Fill gaps in the archive's title histories from Wikipedia's champion lists
    (scripts/fetch_titles.py). Only adds; a name must point to exactly one of our people."""
    path = RAW.parent / "titles_wiki.json"
    if not path.exists():
        report.append("- Title lists: data/raw/titles_wiki.json missing (run scripts/fetch_titles.py)")
        return
    lists = json.loads(path.read_text(encoding="utf-8"))
    by_key = collections.defaultdict(set)
    for root, ids in members.items():
        names = {display[root], *aliases[root], *wd_names.get(root, [])}
        for i in ids:
            names.add(wrestlers[i]["ring_name"])
            if wrestlers[i].get("real_name"):
                names.add(wrestlers[i]["real_name"])
        for n in names:
            if n and len(name_key(n)) >= 3:
                by_key[name_key(n)].add(root)
    added, unmatched, unknown = collections.Counter(), collections.defaultdict(list), collections.defaultdict(list)
    for group, names in lists.items():
        if group not in CRITERION_IDS:
            continue
        for n in names:
            roots = by_key.get(name_key(n), set())
            if not roots and '"' in n:  # '"Hangman" Adam Page' -> 'Adam Page'
                roots = by_key.get(name_key(re.sub(r'"[^"]*"', "", n)), set())
            if len(roots) != 1:
                unmatched[group].append(n)
                if not roots:
                    unknown[group].append(n)  # nobody in the archive by that name
                continue
            root = next(iter(roots))
            if group not in tags[root]:
                tags[root].add(group)
                added[group] += 1
    report.append(f"- Title lists (Wikipedia): champions added that the archive was missing: {dict(added)}")
    report.append(f"- Title lists: names not matched to one person (often tag teams or pre-1980 champions): "
                  + "; ".join(f"{g}: {len(v)}" for g, v in unmatched.items()))
    return unknown


def scene_people(unmatched, taken, pool, report):
    """Japanese and Mexican champions the archive has never heard of (Misawa, Mayu Iwatani).
    A list name that points to exactly one Wikidata wrestler gets that person's id, aliases
    and life facts. Otherwise the Wikipedia name alone joins (Keiji Muto isn't tagged as a
    wrestler on Wikidata), minus list junk like "Vacant" or "Saito Brothers"."""
    path = RAW.parent / "wikidata.json"
    if not path.exists():
        return []
    people = json.loads(path.read_text(encoding="utf-8"))
    wd_by_key = collections.defaultdict(set)
    for q, rec in people.items():
        for n in [rec["label"], *rec["aliases"]]:
            if n:
                wd_by_key[name_key(n)].add(q)
    # tournament lists also carry the name shown that year (Black Tiger II = Eddie Guerrero);
    # those match people but never start a new one
    years = json.loads((RAW.parent / "titles_wiki.json").read_text(encoding="utf-8")).get("years", {})
    shown_only = {sh for rows_ in years.values() for _, sh, link in rows_ if sh != link}
    found, shown, skipped = collections.defaultdict(set), {}, []
    for group, names in unmatched.items():
        if group not in SCENE:
            continue
        for n in names:
            if n in shown_only:
                continue
            qs = wd_by_key.get(name_key(n), set())
            if re.search(SCENE_JUNK, n):
                continue
            if len(qs) == 1 and next(iter(qs)) not in taken:
                q = next(iter(qs))
            elif not qs:
                q = f"name:{name_key(n)}"
            else:
                skipped.append(n)
                continue
            found[q].add(group)
            shown.setdefault(q, n)
    # the merges tab also covers these people: "The Great Muta <- Keiji Muto" folds the
    # Wikipedia name's belts into the archive's person
    by_name = {name_key(w["name"]): w for w in pool}
    folds = {}
    with open(CUR / "merges.csv", newline="", encoding="utf-8") as f:
        for m in csv.DictReader(f):
            if name_key(m["keep"]) in by_name:
                folds[name_key(m["merge"])] = by_name[name_key(m["keep"])]
    out = []
    for q, groups in sorted(found.items()):
        name = shown[q]
        if name_key(name) in folds:
            keep = folds[name_key(name)]
            keep["tags"] = sorted(set(keep["tags"]) | groups)
            continue
        if name_key(name) in by_name:
            skipped.append(name)  # a different person with the same name is already in the pool
            continue
        rec = people.get(q, {"label": name, "aliases": [], "facts": []})
        aka = sorted({a for a in [rec["label"], *rec["aliases"]] if a and name_key(a) != name_key(name)})
        # stable ids: Wikidata's number, or a hash of the name, far above the archive's ids
        pid = 1_000_000_000 + int(q[1:]) if q.startswith("Q") else 3_000_000_000 + zlib.crc32(q.encode()) % 1_000_000_000
        t = groups | wd_life_tags(rec)[0]
        if groups & JP_BELTS and "nonJP" in t:
            t.add("gaijin")
        out.append({"id": pid, "name": name, "aka": aka[:8],
                    "g": "f" if "stardomChamp" in groups else "", "tags": sorted(t & CRITERION_IDS), "pop": 0})
    report.append(f"- scene people added from Wikipedia + Wikidata (not in the archive): {len(out)}, "
                  f"{sum(w['id'] >= 3_000_000_000 for w in out)} of them unknown to Wikidata: "
                  f"{sorted(w['name'] for w in out if w['id'] >= 3_000_000_000)}; "
                  f"skipped (no single Wikidata match, or name taken): {sorted(set(skipped))}")
    return out


def add_legacy(pool, report):
    """Lucha Legacy: a lucha wrestler (Mexican belt or born in Mexico) whose name or an
    alias is a family or inherited name. Inherited masks the pattern misses (La Parka)
    come from tags.csv rows."""
    hits = []
    for w in pool:
        if not (set(w["tags"]) & MX_BELTS or "bornMX" in w["tags"]):
            continue
        if any(re.search(LEGACY_NAME, n.strip()) for n in [w["name"], *w["aka"]]):
            w["tags"] = sorted({*w["tags"], "legacy"})
            hits.append(w["name"])
    report.append(f"- REVIEW: Lucha Legacy by name ({len(hits)}): " + "; ".join(sorted(hits)))


def wd_life_tags(rec):
    """Life-outside-the-ring tags for one Wikidata person, and whether birth came from citizenship.
    Also "nonJP" (not a criterion): no Japanese citizenship, for the Gaijin category."""
    new = {WIKIDATA_FACTS[f] for f in rec["facts"] if f in WIKIDATA_FACTS}
    citizen, birth = rec.get("citizen", []), rec.get("born_in")
    if (citizen and "JP" not in citizen) or (not citizen and birth and birth != "JP"):
        new.add("nonJP")
    born, from_citizenship = rec.get("born_in"), False
    if not born and len(rec.get("citizen", [])) == 1:
        born, from_citizenship = rec["citizen"][0], True  # no birthplace on Wikidata: a single citizenship stands in
    if born:
        if born in BORN:
            new.add(BORN[born])
        if born != "US":
            new.add("bornAbroad")
    return new, from_citizenship


def add_wikidata_tags(members, wrestlers, display, aliases, tags, report):
    """Match Wikidata wrestlers to our people by name and add life-outside-the-ring tags.
    A match needs a name that points to exactly one person on each side; anything
    ambiguous is skipped (a wrong match would put false facts on the grid)."""
    path = RAW.parent / "wikidata.json"
    if not path.exists():
        report.append("- Wikidata: data/raw/wikidata.json missing (run scripts/fetch_wikidata.py); no beyond-the-ring tags")
        return {}, set()
    people = json.loads(path.read_text(encoding="utf-8"))
    wd_by_key = collections.defaultdict(set)
    for q, rec in people.items():
        for n in [rec["label"], *rec["aliases"]]:
            if n:
                wd_by_key[name_key(n)].add(q)
    ours_by_key = collections.defaultdict(set)
    for root, ids in members.items():
        names = {display[root], *aliases[root]}
        for i in ids:
            names.add(wrestlers[i]["ring_name"])
            if wrestlers[i].get("real_name"):
                names.add(wrestlers[i]["real_name"])
        for n in names:
            if n and len(name_key(n)) >= 4:
                ours_by_key[name_key(n)].add(root)

    matched, conflicts = {}, 0
    # pins from data/curation/wikidata.csv win over name matching
    pinned_roots = set()
    with open(CUR / "wikidata.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            roots = ours_by_key.get(name_key(row["wrestler"]), set())
            if len(roots) == 1 and row["qid"] in people:
                matched[next(iter(roots))] = row["qid"]
                pinned_roots |= roots
            else:
                report.append(f"- WIKIDATA PIN SKIPPED: {dict(row)}")
    for k, roots in ours_by_key.items():
        qs = wd_by_key.get(k, set())
        if len(roots) != 1 or len(qs) != 1:
            continue
        root, q = next(iter(roots)), next(iter(qs))
        if root in pinned_roots:
            continue
        if matched.get(root, q) != q:
            conflicts += 1  # two names point to different Wikidata people: trust neither
            matched[root] = None
        elif root not in matched:
            matched[root] = q
    added = collections.Counter()
    for root, q in matched.items():
        if not q:
            continue
        new, from_citizenship = wd_life_tags(people[q])
        added["(born from citizenship)"] += from_citizenship
        for t in new:
            tags[root].add(t)
            added[t] += 1
    # a review sheet: well-known people and their new tags, to scan for anything Wikidata got wrong
    LIFE = set(WIKIDATA_FACTS.values()) | set(BORN.values()) | {"bornAbroad"}
    review = sorted(((display[r], q, sorted(tags[r] & LIFE)) for r, q in matched.items() if q and tags[r] & LIFE),
                    key=lambda x: x[0])
    with open(OUT / "wikidata_review.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["wrestler", "wikidata", "tags"])
        for name, q, t in review:
            w.writerow([name, f"https://www.wikidata.org/wiki/{q}", " ".join(t)])
    report.append(f"- Wikidata: {sum(1 for q in matched.values() if q)} people matched, {conflicts} skipped as ambiguous; tags added: {dict(added)}")
    # real names and aliases from Wikidata, so title lists that use "Dwayne Johnson" still find The Rock
    names = {root: [people[q]["label"], *people[q]["aliases"]] for root, q in matched.items() if q}
    return names, {q for q in matched.values() if q}


def intl_coverage(promos, kept_events, pool, criteria):
    """Report lines: how much Japanese and Mexican wrestling the data has."""
    by_event = collections.Counter()
    with open(RAW / "matches.csv", newline="", encoding="utf-8") as f:
        for m in csv.DictReader(f):
            by_event[m["event_id"]] += 1
    scenes = collections.defaultdict(lambda: {"events": 0, "kept": 0, "matches": 0, "years": set(), "filed": collections.Counter()})
    for e in rows("events"):
        hit = next(((s, c) for s, c, pat in INTL_SCENES if re.search(pat, e["name"])), None)
        if not hit:
            country = next((c for c, pat in ABROAD_CITIES.items() if re.search(pat, e["city"] or "")), None)
            hit = (f"{promos[e['promotion_id']]} shows held there", country) if country else None
        if not hit:
            continue
        s = scenes[hit]
        s["events"] += 1
        s["kept"] += e["id"] in kept_events
        s["matches"] += by_event[e["id"]]
        s["years"].add(e["date"][:4])
        s["filed"][promos[e["promotion_id"]]] += 1
    lines = ["", "## International coverage", "",
             "The archive has six US promotions and no country column. These are events whose name (or city) "
             "places them in Japan or Mexico; most are 2025-26 shows the scrape filed under a US promotion, "
             "which the import drops (`kept` = events the import uses). The CMLL, NJPW and AAA cards look like "
             "real rosters (Mistico, Yota Tsuji, Psycho Clown); the Stardom ones are mostly AEW names. "
             "Match counts include the scrape's many repeats of each show.", "",
             "| scene | country | events | kept | matches | years | filed under |", "|---|---|---|---|---|---|---|"]
    for (scene, country), s in sorted(scenes.items(), key=lambda kv: (kv[0][1], -kv[1]["events"])):
        yrs = f"{min(s['years'])}-{max(s['years'])}" if s["years"] else ""
        filed = ", ".join(f"{p} {n}" for p, n in s["filed"].most_common())
        lines.append(f"| {scene} | {country} | {s['events']} | {s['kept']} | {s['matches']} | {yrs} | {filed} |")
    born = collections.Counter(t for w in pool for t in w["tags"] if t in ("bornJP", "bornMX"))
    famous = [w for w in pool if w["pop"] >= 150]
    lines += ["", f"Pool: {len(pool)} wrestlers, {len(famous)} well known (pop 150+, the grid's answer pool).",
              f"Born in Japan: {born['bornJP']} ({sum('bornJP' in w['tags'] for w in famous)} well known); "
              f"born in Mexico: {born['bornMX']} ({sum('bornMX' in w['tags'] for w in famous)} well known).", "",
              "| scene criterion | in pool | well known |", "|---|---|---|"]
    for c in criteria:
        if c.get("scene"):
            lines.append(f"| {c['id']} ({c['scene']}) | {c['count']} | {sum(c['id'] in w['tags'] for w in famous)} |")
    for scene in sorted(set(SCENE.values())):
        ids = {k for k, v in SCENE.items() if v == scene}
        anyone = [w for w in pool if ids & set(w["tags"])]
        lines.append(f"| any {scene} criterion | {len(anyone)} | {sum(w['pop'] >= 150 for w in anyone)} |")
    return lines


REGIONS = {"world": "", "us": "us", "jp": "jp", "mx": "mx"}
APPROVED = {"yes", "y", "x", "true", "1"}


def community_questions(taken, report):
    """Approved rows of the questions tab. Each row's options are shuffled from its own
    prompt, so adding or approving rows never reshuffles the others."""
    path = CUR / "questions.csv"
    if not path.exists():
        return []
    qs, problems, waiting = [], [], 0
    with open(path, newline="", encoding="utf-8") as f:
        for i, row in enumerate(csv.DictReader(f), start=2):
            row = {k: (v or "").strip() for k, v in row.items() if k}
            if row.get("approved", "").lower() not in APPROVED:
                waiting += 1
                continue
            opts = [row.get(k, "") for k in ("answer", "wrong1", "wrong2", "wrong3")]
            region = row.get("region", "").lower() or "world"
            qid = "community:" + re.sub(r"[^a-z0-9]+", "-", row.get("prompt", "").lower()).strip("-")[:60]
            why = ("missing prompt or an option" if not row.get("prompt") or not all(opts)
                   else "options repeat" if len({o.lower() for o in opts}) < 4
                   else "source must be a link" if not re.match(r"https?://", row.get("source", ""))
                   else f"region must be one of {sorted(REGIONS)}" if region not in REGIONS
                   else "same prompt as another question" if qid in taken else "")
            if why:
                problems.append(f"row {i}: {why}")
                continue
            taken.add(qid)
            shuffled_opts = opts[:]
            random.Random(row["prompt"]).shuffle(shuffled_opts)
            q = {"id": qid, "type": "community", "prompt": row["prompt"], "options": shuffled_opts,
                 "answer": shuffled_opts.index(opts[0]), "source": row["source"]}
            if REGIONS[region]:
                q["scene"] = REGIONS[region]
            qs.append(q)
    report.append(f"- community questions: {len(qs)} approved, {waiting} waiting for approval"
                  + (f"; NOT USED: {'; '.join(problems)}" if problems else ""))
    return qs


def build_scene_trivia(report):
    """Tournament winners by year (Wikipedia; scripts/fetch_titles.py). Kept apart from
    build_trivia so the main bank's shuffles don't change. Each question has a scene."""
    path = RAW.parent / "titles_wiki.json"
    years = json.loads(path.read_text(encoding="utf-8")).get("years", {}) if path.exists() else {}
    rng = random.Random(1991)
    qs = []
    for group, rows_ in years.items():
        label = TOURNAMENT_LABELS.get(group)
        if not label:
            continue
        by_year = collections.defaultdict(set)
        for y, shown, link in rows_:
            by_year[y].add((shown, link))
        for y, names in sorted(by_year.items()):
            if len(names) != 1:
                continue  # two winners in one year (split blocks, tag finals): skip
            answer, person = next(iter(names))
            # nearest other winners, one name per person (Kushida and Yujiro Kushida are one)
            near = {}
            for yy, ns in sorted(by_year.items(), key=lambda kv: abs(kv[0] - y)):
                for shown, link in sorted(ns):
                    if yy != y and abs(yy - y) <= 10 and link != person and shown != answer:
                        near.setdefault(link, shown)
            pick = list(near.values())[:6]
            rng.shuffle(pick)
            opts = [answer] + pick[:3]
            if len(opts) < 4 or re.search(r", | & ", answer):
                continue
            rng.shuffle(opts)
            qs.append({"id": f"tourney:{group}:{y}", "type": "tourney", "scene": SCENE[group],
                       "prompt": f"Who won the {y} {label}?", "options": opts, "answer": opts.index(answer)})
    report.append(f"- scene trivia (tournament winners): {len(qs)}")
    return qs


def write_split_candidates(members, display, matches, total_n, report):
    """Likely renames the merges tab doesn't cover yet: one name contains the
    other (Charlotte / Charlotte Flair) and the two careers barely overlap."""
    years = collections.defaultdict(set)
    for m in matches.values():
        for p in m["parts"]:
            years[p[0]].add(int(m["date"][:4]))
    people = [r for r in members if total_n[r] >= 15 and not re.search(r", | & ", display[r])]
    def words(n):
        return [w for w in re.sub(r"[^a-z0-9 ]", "", clean_name(n).lower()).split() if w != "the"]

    keys = {r: words(display[r]) for r in people}
    out = []
    for a in people:
        ka = keys[a]
        if not ka or len("".join(ka)) < 4:
            continue
        for b in people:
            kb = keys[b]
            n = len(ka)
            # whole words at the start or end: "Charlotte" / "Charlotte Flair", "Neville" / "Adrian Neville"
            if a == b or ka == kb or len(kb) <= n or (kb[:n] != ka and kb[-n:] != ka):
                continue
            ya, yb = years[a], years[b]
            if len(ya & yb) > 1:
                continue  # active at the same time: probably two people (Jey / Jimmy Uso)
            keep, merge = (a, b) if total_n[a] >= total_n[b] else (b, a)
            out.append((total_n[a] + total_n[b], display[keep], display[merge],
                        f"{min(years[merge])}-{max(years[merge])} vs {min(years[keep])}-{max(years[keep])}"))
    out.sort(reverse=True)
    path = OUT / "merge_candidates.csv"
    OUT.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["keep", "merge", "display", "note"])
        for _, keep, merge, note in out:
            w.writerow([keep, merge, keep, f"CANDIDATE: careers {note}"])
    report.append(f"- possible name splits to review: {len(out)} (data/generated/merge_candidates.csv)")


def total_n_raw(root, members, raw_count):
    return sum(raw_count[i] for i in members[root])


def tags_add(tags, wids, tag):
    for w in wids:
        tags[w].add(tag)


def is_rumble_ppv(ev):
    return ev["promo"] == "WWE" and "Royal Rumble" in ev["name"] and "Greatest" not in ev["name"]


def has_partner(m, wid):
    """True when wid didn't win alone (team numbers are often blank, so count winners)."""
    return sum(1 for p in m["parts"] if p[1] == "win") > 1


def match_gender(m, gender):
    c = collections.Counter(gender.get(p[0], "") for p in m["parts"])
    return "f" if c["f"] > c["m"] else "m"


def event_label(ev):
    """Short, plain event name: 'WWE TLC: Tables, Ladders and Chairs '09' -> 'TLC 2009'."""
    name = re.sub(r"\s+", " ", ev["name"])
    name = re.sub(r"^(WWF|WWE) ", "", name)
    name = re.sub(r"\s*-\s*(Night|Day|Part).*$|\s*(Day \d )?Taping.*$", "", name)
    name = re.sub(r"\s*\(.*?\)", "", name)
    name = name.split(":")[0].split(" - ")[0].strip()
    name = re.sub(r"'(\d\d)", lambda m: ("19" if int(m.group(1)) > 50 else "20") + m.group(1), name)
    if "WrestleMania" not in name and not re.search(r"(19|20)\d\d", name):
        name = f"{name} {ev['date'][:4]}"
    return name


TRIVIA_TITLE_LABELS = {"wweChamp": "WWE Championship", "wcwChamp": "WCW World Heavyweight Championship",
                       "ic": "Intercontinental Championship", "us": "United States Championship",
                       "ecwChamp": "ECW World Heavyweight Championship", "universal": "Universal Championship",
                       "whc": "World Heavyweight Championship"}


def era_namer(era_names, display, wrestlers):
    """name_at(person, year): the ring name they used that year (Sasha Banks in 2021, Dean Ambrose
    in 2016), falling back to their display name. Display names that merely restyle the same name
    ("Steve Austin" shown as "Stone Cold Steve Austin") are kept."""
    def name_at(root, year):
        best = None
        for dy in (0, -1, 1, -2, 2):
            c = era_names.get((root, str(int(year) + dy)))
            if c:
                best = c.most_common(1)[0][0]
                break
        shown = display[root]
        if not best:
            return shown
        k, k_shown, k_root = name_key(best), name_key(shown), name_key(wrestlers[root]["ring_name"])
        if k == k_shown or (k == k_root and k in k_shown):
            return shown
        return best
    return name_at


def build_trivia(events, by_event, matches, reigns, title_group, name_at, gender, ppv_n, report):
    rng = random.Random(1985)
    qs = []
    skipped = collections.Counter()

    seen_ids = set()

    def add(qtype, prompt, answer, distractors, key):
        qid = f"{qtype}:{key}"
        if qid in seen_ids or re.search(r", | & ", answer):
            skipped[qtype] += 1
            return
        distractors = [d for d in distractors if not re.search(r", | & ", d or "") and d not in JUNK_NAMES]
        opts = [answer]
        for d in distractors:
            if d and d not in opts:
                opts.append(d)
        if len(opts) < 4:
            skipped[qtype] += 1
            return
        opts = opts[:4]
        rng.shuffle(opts)
        seen_ids.add(qid)
        qs.append({"id": qid, "type": qtype, "prompt": prompt, "options": opts,
                   "answer": opts.index(answer)})

    def famous(ids, k, exclude, year, g=None):
        cand = sorted({w for w in ids if name_at(w, year) not in exclude and name_at(w, year) not in JUNK_NAMES
                       and (not g or gender.get(w) == g)}, key=lambda w: (-ppv_n[w], int(w)))
        top = cand[:max(k * 3, 8)]
        rng.shuffle(top)
        return [name_at(w, year) for w in top[:k]]

    # Royal Rumble winners; distractors are the biggest names in that same Rumble
    for eid, ms in by_event.items():
        ev = events[eid]
        if not is_rumble_ppv(ev):
            continue
        for m in ms:
            winners = sorted({p[0] for p in m["parts"] if p[1] == "win"})
            if m["type"] != "royal_rumble" or len(winners) != 1:
                continue
            w, g, year = winners[0], match_gender(m, gender), ev["date"][:4]
            label = ("women's " if g == "f" else "men's ") if int(year) >= 2018 else ""
            add("rumble", f"Who won the {year} {label}Royal Rumble?", name_at(w, year),
                famous([p[0] for p in m["parts"]], 3, {name_at(w, year)}, year, g), f"{year}{g}")

    # WrestleMania: final-match winner, host city
    wm_cities = {}
    year_ids = collections.defaultdict(set)
    for m in matches.values():
        if events[m["event"]]["event_type"] == "ppv":
            year_ids[m["date"][:4]].update(p[0] for p in m["parts"])
    for eid, ms in by_event.items():
        ev = events[eid]
        night = wm_night(ev["name"]) if ev["promo"] == "WWE" else None
        if not night or not ms or (ev["date"] != "1985-03-31" and night == "WrestleMania") or "Taping" in night:
            continue
        if ev["city"]:
            wm_cities[wm_base(night)] = (ev["date"], ev["city"])
        main = ms[-1]
        if len(main["parts"]) == 2 and {p[1] for p in main["parts"]} == {"win", "loss"}:
            win = next(p[0] for p in main["parts"] if p[1] == "win")
            lose = next(p[0] for p in main["parts"] if p[1] == "loss")
            y = ev["date"][:4]
            add("wmMain", f"Who won the main event of {night.replace(' - ', ' ')}?",
                name_at(win, y), [name_at(lose, y)] + famous(year_ids[y], 2, {name_at(win, y), name_at(lose, y)},
                                                             y, gender.get(win)), night)
    cities = sorted({c for _, c in wm_cities.values()})
    for base, (date, city) in wm_cities.items():
        add("wmCity", f"Which city hosted {base}?", city,
            rng.sample([c for c in cities if c != city], 3), base)

    # Title changes, confirmed by the title match itself
    title_matches = collections.defaultdict(list)
    for m in matches.values():
        if m["title"]:
            title_matches[m["date"]].append(m)
    by_title = collections.defaultdict(list)
    for r in reigns:
        by_title[r["title_id"]].append(r)
    for tid, rs in by_title.items():
        g = title_group.get(tid)
        if g not in TRIVIA_TITLE_LABELS:
            continue
        rs.sort(key=lambda r: r["won_date"])
        for prev, cur in zip(rs, rs[1:]):
            champ, before = cur["wrestler_id"], prev["wrestler_id"]
            if champ == before or cur["won_date"] < "1984":
                continue
            m = next((m for m in title_matches.get(cur["won_date"], [])
                      if (champ, "win") in {(p[0], p[1]) for p in m["parts"]}
                      and (before, "loss") in {(p[0], p[1]) for p in m["parts"]}
                      and not has_partner(m, champ)), None)
            if not m:
                skipped["lineage-unconfirmed"] += 1
                continue
            ev = events[m["event"]]
            if ev["event_type"] != "ppv" and "MSG" not in ev["name"]:
                skipped["lineage-tv"] += 1
                continue
            yr = int(cur["won_date"][:4])
            near = [r["wrestler_id"] for r in rs if abs(int(r["won_date"][:4]) - yr) <= 6]
            y = cur["won_date"][:4]
            add("lineage", f"Who did {name_at(champ, y)} beat for the {TRIVIA_TITLE_LABELS[g]} at {event_label(ev)}?",
                name_at(before, y), famous(near, 3, {name_at(champ, y), name_at(before, y)}, y, gender.get(before)),
                f"{tid}:{cur['won_date']}")

    # Classics: the highest-rated PPV singles matches
    rated = [m for m in matches.values() if m["rating"] and len(m["parts"]) == 2 and m["type"] == "singles"
             and events[m["event"]]["event_type"] == "ppv" and {p[1] for p in m["parts"]} == {"win", "loss"}]
    rated.sort(key=lambda m: -m["rating"])
    peers_by_year = collections.defaultdict(set)
    for m in rated[:3000]:
        peers_by_year[m["date"][:4]].update(p[0] for p in m["parts"])
    for m in rated[:600]:
        ev = events[m["event"]]
        win = next(p[0] for p in m["parts"] if p[1] == "win")
        lose = next(p[0] for p in m["parts"] if p[1] == "loss")
        if min(ppv_n[win], ppv_n[lose]) < 25:
            skipped["classic-obscure"] += 1
            continue
        y = m["date"][:4]
        add("classic", f"Who did {name_at(win, y)} defeat at {event_label(ev)}?", name_at(lose, y),
            famous(peers_by_year[y], 3, {name_at(win, y), name_at(lose, y)}, y, gender.get(lose)), m["id"])

    # Which promotion ran this pay-per-view?
    seen_names = set()
    for eid, ev in events.items():
        if ev["event_type"] != "ppv" or ev["promo"] not in ("WCW", "ECW", "TNA", "AEW") or eid not in by_event:
            continue
        base = re.sub(r"\s*\(.*\)$", "", strip_promo(ev["name"]))
        base = re.sub(r"\s*\b(19|20)\d\d\b|\s*'\d\d", "", base).strip()
        if base.lower() in seen_names or re.search(r"WCW|ECW|TNA|AEW|Impact|Nitro|Dynamite|Part \d|Taping|Zero Hour|Weekly|#\d", base, re.I):
            continue
        seen_names.add(base.lower())
        others = [p for p in ("WWE", "WCW", "ECW", "TNA", "AEW") if p != ev["promo"]]
        add("promotion", f"Which promotion ran {base}?", ev["promo"], rng.sample(others, 3), base)

    report.append(f"- trivia questions generated: {len(qs)}; skipped: {dict(skipped)}")
    return qs


if __name__ == "__main__":
    main()
