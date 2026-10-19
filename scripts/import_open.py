"""The --no-cagematch build: The Push's data from Wikipedia, Wikidata and curation only.

    python scripts/import_ringside.py --no-cagematch

Needs data/raw/ppv_results.json (scripts/fetch_ppv_results.py), wikidata.json (with
--extra fields), titles_wiki.json and factions.json. Writes ring.json, trivia.json and
REPORT.md to data/generated/no-cagematch/, never over the live files, so Ray can compare.
To grid-check it, copy those two JSON files over data/generated/ and run
npx tsx scripts/check-puzzles.ts, then git checkout data/generated (docs/data-independence.md).

People are Wikidata items: everyone who wrestled on a Wikipedia PPV or TV special card,
plus anyone the title, faction and cover lists name. Ids are 1e9 + the Q number (the
scene people's scheme), so they don't line up with the archive's ids.
"""
import collections
import csv
import datetime
import json
import random
import re
import zlib

import import_ringside as R
from import_ringside import CRITERIA, CRITERION_IDS, CUR, SCENE, JP_BELTS, name_key, real_name, stip_tags, wd_life_tags

RAW = R.RAW.parent
OUT = R.OUT / "no-cagematch"
# A PPV/special appearance is worth this much "pop". The archive's pop (3 per PPV match + 1 per
# any match) has 642 people at 150+, the grid's well-known pool; 12 per card appearance gives
# a pool about that size from PPVs alone.
POP_PER_MATCH = 12
MIN_POOL_MATCHES = 3  # PPV/special matches; titled people and scene champions always join
MIN_DECADE_MATCHES = 2  # "Wrestled in the '90s" from PPV cards only (the archive mode counts 3 of any match)
EMPLOYERS = {
    "wwe": r"^(WWE|WWF|World Wrestling (Federation|Entertainment)|WWE (Raw|SmackDown))$",
    "nxt": r"^(WWE )?NXT$",
    "wcw": r"^World Championship Wrestling$",
    "ecw": r"^(Extreme|Eastern) Championship Wrestling$",
    "tna": r"^(Total Nonstop Action Wrestling|Impact Wrestling|TNA Wrestling)$",
    "aew": r"^All Elite Wrestling$",
}
# WrestleMania pages with several results tables are a table per night, except these (three venues, one night)
ONE_NIGHT = {"WrestleMania 2"}
NOT_MAIN = r"pre|dark|heat|kickoff|xplosion|regnxt|wcwme|wcwsn|ffa|aewd|mem|slam"
# Wikipedia championship articles -> the trivia title groups (title changes on PPV)
TITLE_ARTICLES = {
    "wweChamp": r"^(WWE|WWF|WWWF)( World Heavyweight)? Championship$|^Undisputed WWE Championship$",
    "whc": r"^World Heavyweight Championship \(WWE",
    "universal": r"^(Undisputed )?WWE Universal Championship$",
    "wcwChamp": r"^WCW World Heavyweight Championship$",
    "ecwChamp": r"^ECW (World Heavyweight|World|) ?Championship$",
    "ic": r"^(WWE|WWF) Intercontinental Championship$",
    "us": r"^(WWE United States|WCW United States Heavyweight) Championship$",
}


def load(name):
    return json.loads((RAW / name).read_text(encoding="utf-8"))


def main():
    report = []
    people = load("wikidata.json")
    if (RAW / "wikidata_cards.json").exists():  # card people Wikidata doesn't tag as wrestlers
        people.update({q: rec for q, rec in load("wikidata_cards.json").items() if q not in people})
    ppv = load("ppv_results.json")
    qids = ppv["qids"]

    # ---- people: Wikidata items, plus card names Wikipedia doesn't link to an item ----------
    recs = {}  # pid -> {"q", "label", "aliases", ...}

    def pid_of(q):
        return 1_000_000_000 + int(q[1:])

    for q, rec in people.items():
        recs[pid_of(q)] = {**rec, "q": q}
    by_key = collections.defaultdict(set)
    for pid, rec in recs.items():
        for n in [rec["label"], *rec["aliases"], *rec.get("real", [])]:
            if n and len(name_key(n)) >= 3:
                by_key[name_key(n)].add(pid)
    label_key = {pid: name_key(rec["label"]) for pid, rec in recs.items()}

    apps = collections.defaultdict(list)  # pid -> [(event, match)]
    display = {}  # filled once the cards are read
    shown = collections.defaultdict(collections.Counter)  # (pid, year) -> card names
    unknown = collections.Counter()

    def by_name(n):
        roots = by_key.get(name_key(n), set())
        if len(roots) > 1:  # prefer the one billed by that name ("The Rock" is an alias of others too)
            roots = {r for r in roots if name_key(display.get(r, "")) == name_key(n)} or                     {r for r in roots if label_key.get(r) == name_key(n)} or roots
        if len(roots) > 1:  # the one with the most cards so far, when it clearly leads
            ranked = sorted(roots, key=lambda r: -len(apps[r]))
            if len(apps[ranked[0]]) > 2 * max(1, len(apps[ranked[1]])):
                roots = {ranked[0]}
        return next(iter(roots)) if len(roots) == 1 else None

    def new_person(name, q=None):
        pid = pid_of(q) if q else 3_000_000_000 + zlib.crc32(name_key(name).encode()) % 1_000_000_000
        if pid not in recs:
            recs[pid] = {"label": name, "aliases": [], "facts": [], "q": q or ""}
            by_key[name_key(name)].add(pid)
            label_key[pid] = name_key(name)
        return pid

    humans, teams = set(ppv.get("humans", [])), ppv.get("teams", {})

    def resolve_card(art, shown_name):
        q = qids.get(art)
        if q in people:
            return [pid_of(q)]
        if q in teams:  # a team item with members on Wikidata (no member list on the card)
            return [pid_of(mq) if mq in people else new_person(mq, mq) for mq in teams[q] if mq in people or mq in humans]
        bare = re.sub(r"\s*\(.*?\)$", "", art)
        parts = R.FACTION_TEAMS.get(bare) or re.split(r"\s+(?:and|&)\s+", bare)
        if len(parts) > 1:  # "Paul London and Brian Kendrick"
            return [p for p in map(by_name, parts) if p is not None]
        if q in humans:  # a person who isn't tagged as a wrestler on Wikidata (Mr. T, Lawrence Taylor)
            return [new_person(shown_name or bare, q)]
        if q:  # a team or promotion item with no members listed: nobody to credit
            unknown[art] += 1
            return []
        hit = by_name(shown_name) or by_name(bare)
        if hit:
            return [hit]
        unknown[art] += 1
        return [new_person(shown_name or bare)]

    today = datetime.date.today().isoformat()  # announced cards for future shows are not results
    events = sorted((e for e in ppv["events"] if (e["date"] or "") <= today), key=lambda e: e["date"] or "9999")
    for e in events:
        for m in e["matches"]:
            m["pids"], m["wpids"], m["cpids"] = [], [], []
            for art in m["winners"] + m["losers"]:
                for pid in resolve_card(art, m["names"].get(art, "")):
                    if pid in m["pids"]:
                        continue
                    m["pids"].append(pid)
                    if art in m["winners"]:
                        m["wpids"].append(pid)
                    if art in m["champs"]:
                        m["cpids"].append(pid)
                    apps[pid].append((e, m))
                    billed = m["names"].get(art) or recs[pid]["label"]
                    # 'Seth "Freakin" Rollins' plays as Seth Rollins; the billed name stays an alias
                    card_name = re.sub(r'\s*"[^"]*"\s*', " ", billed).strip() if re.search(r'"[^"]*"\s*\S', billed) else billed
                    if name_key(billed) != name_key(card_name):
                        recs[pid]["aliases"] = [*recs[pid]["aliases"], billed]
                    if e["date"]:
                        shown[(pid, e["date"][:4])][card_name] += 1
                    if name_key(card_name) not in {name_key(a) for a in recs[pid]["aliases"]}:
                        recs[pid]["aliases"] = [*recs[pid]["aliases"], card_name]  # "Rocky Maivia", "The Rock"
                        by_key[name_key(card_name)].add(pid)
    report.append(f"- Wikipedia cards: {len(events)} events, {sum(len(e['matches']) for e in events)} matches, "
                  f"{len(apps)} people on them; card names with no Wikidata item: {len(unknown)}")

    # display name: the name most used on cards, else the Wikidata label
    used = collections.defaultdict(collections.Counter)
    for (pid, _), names in shown.items():
        used[pid].update(names)
    display.update({pid: used[pid].most_common(1)[0][0] if used[pid] else rec["label"] for pid, rec in recs.items()})
    # merges tab: same person under two items or names ("The Great Muta <- Keiji Muto")
    with open(CUR / "merges.csv", newline="", encoding="utf-8") as f:
        for m in csv.DictReader(f):
            keep, merge = by_name(m["keep"]), by_name(m["merge"])
            if keep and merge and keep != merge:
                apps[keep] += apps.pop(merge, [])
                recs[keep]["aliases"] = sorted({*recs[keep]["aliases"], display[merge], *recs[merge]["aliases"]})
                recs.pop(merge)
                for ids in by_key.values():
                    if merge in ids:
                        ids.discard(merge)
                        ids.add(keep)
            if keep and m["display"]:
                display[keep] = m["display"]

    def name_at(pid, year):
        for dy in (0, -1, 1, -2, 2):
            c = shown.get((pid, str(int(year) + dy)))
            if c:
                return c.most_common(1)[0][0]
        return display[pid]

    # ---- tags from the cards ----------------------------------------------------------------
    tags = collections.defaultdict(set)
    first = {}
    decade = collections.Counter()
    rumble, wm_mains, aew_mains = [], [], []
    last_of_page = {e["page"]: e for e in events}
    for e in events:
        promos = e["promos"]
        for m in e["matches"]:
            for pid in m["pids"]:
                if e["date"]:
                    decade[(pid, e["date"][:3])] += 1
                for p in promos:
                    if e["co_promoted"] or (e["date"] and e["date"] >= R.PROMO_UNTIL.get(p, "9999")):
                        continue  # Forbidden Door, Invasion-era "WCW" matches
                    tag = "nxt" if p == "WWE" and e["brand"] == "NXT" else p.lower()
                    tags[pid].add(tag)
                    if e["date"]:
                        first[(pid, tag)] = min(first.get((pid, tag), e["date"]), e["date"])
                    if tag == "wwe" and e["date"] >= R.NXT_SINCE:
                        tags[pid].add("_wweSince")
            for t in stip_tags(m["stip"]):
                R.tags_add(tags, m["pids"], t)
            if len(m["pids"]) == 2 and m["secs"] >= 1800 and not re.search(r"tag|team", m["stip"], re.I):
                R.tags_add(tags, m["pids"], "marathon")
            if "WWE" in promos and re.search(r"Royal Rumble", e["page"]) and "Greatest" not in e["page"] \
                    and re.search(r"Royal Rumble match", m["stip"], re.I) and not re.search(r"qualif|spot|entry", m["stip"], re.I)                     and not re.fullmatch(NOT_MAIN, m["note"] or "x") and len(m["wpids"]) == 1:
                tags[m["wpids"][0]].add("rumble")
                rumble.append((e, m))
        mains = [m for m in e["matches"] if not re.fullmatch(NOT_MAIN, m["note"] or "x")] if e["matches"] else []
        main = mains[-1] if mains else None
        last_table = last_of_page[e["page"]] is e
        if main and "WWE" in promos and re.match(r"WrestleMania( |$)", e["page"]) and not re.search(r"Backlash|Axxess", e["page"])                 and (e["page"] not in ONE_NIGHT or last_table):
            R.tags_add(tags, main["pids"], "wmMain")
            wm_mains.append((e, main))
        if main and "AEW" in promos and e["kind"] == "ppv":
            R.tags_add(tags, main["pids"], "aewPpvMain")
            aew_mains.append((e, main))
    for (pid, dec), n in decade.items():
        if n >= MIN_DECADE_MATCHES and f"d{dec}0s" in CRITERION_IDS:
            tags[pid].add(f"d{dec}0s")
    # employer / sports team on Wikidata
    emp_added = collections.Counter()
    for pid, rec in recs.items():
        for label in rec.get("employers", []):
            for tag, pat in EMPLOYERS.items():
                if re.search(pat, label) and tag not in tags[pid]:
                    tags[pid].add(tag)
                    emp_added[tag] += 1
    report.append(f"- promotion tags added from Wikidata employer / sports team (P108, P54) only: {dict(emp_added)}")

    # ---- Wikipedia lists: titles, tournaments, factions, covers -----------------------------
    titles = load("titles_wiki.json")
    added, missed = collections.Counter(), collections.defaultdict(list)
    scene_found = collections.defaultdict(set)
    years = titles.get("years", {})
    shown_only = {sh for rows_ in years.values() for _, sh, link in rows_ if sh != link}
    for group, names in titles.items():
        if group not in CRITERION_IDS:
            continue
        for n in names:
            pid = by_name(n) or (by_name(re.sub(r'"[^"]*"', "", n)) if '"' in n else None)
            if pid:
                tags[pid].add(group)
                added[group] += 1
            elif group in SCENE and n not in shown_only and not re.search(R.SCENE_JUNK, n) and not by_key.get(name_key(n)):
                scene_found[n].add(group)  # Japanese and Mexican champions Wikidata doesn't know
            else:
                missed[group].append(n)
    for n, groups in scene_found.items():
        pid = new_person(n)
        display.setdefault(pid, n)
        tags[pid] |= groups
    report.append(f"- title lists (Wikipedia): {dict(added)}; name-only scene champions added: {len(scene_found)}; "
                  f"names not matched to one person: " + "; ".join(f"{g}: {len(v)}" for g, v in missed.items()))
    with open(CUR / "covers.csv", newline="", encoding="utf-8") as f:
        miss = []
        for row in csv.DictReader(f):
            pid = by_name(row["wrestler"])
            (tags[pid].add("cover") if pid else miss.append(row["wrestler"]))
        report.append(f"- 2K covers: not matched: {miss}")
    for fid, fac in load("factions.json").items():
        if fid not in CRITERION_IDS:
            continue
        hits = {p for article, _ in fac["members"] for n in R.FACTION_TEAMS.get(article, [article]) for p in [by_name(n)] if p}
        for pid in hits:
            tags[pid].add(fid)
        report.append(f"- faction {fid}: {len(hits)} matched")

    # ---- gender, Wikidata life facts, the pool ------------------------------------------------
    womens = {pid for pid, t in tags.items() if "womens" in t or "stardomChamp" in t}
    pool = []
    titled_ids = set(R.TITLE_GROUPS) | {"tag", "womens", "aewChamp"} | set(SCENE)
    for pid, rec in recs.items():
        t = set(tags.get(pid, set()))
        n = len(apps.get(pid, []))
        if not (n >= MIN_POOL_MATCHES or t & titled_ids):
            continue
        if re.search(r", | & |\band\b", display[pid]) or display[pid] in R.JUNK_NAMES:
            continue
        life, _ = wd_life_tags(rec)
        t |= life
        if rec.get("q") and real_name(display[pid], rec):
            t.add("realName")
        if t & JP_BELTS and "nonJP" in t:
            t.add("gaijin")
        if "wwe" in t and "nxt" not in t and "_wweSince" in t:
            t.add("neverNxt")
        if {"wwe", "aew"} <= t:
            t.add("aewWwe")
            w, a = first.get((pid, "wwe")), first.get((pid, "aew"))
            if w and a:
                t.add("wweToAew" if w < a else "aewToWwe")
        g = rec.get("sex") or ("f" if pid in womens else "m")
        aka = sorted({a for a in [rec["label"], *rec["aliases"]] if a and name_key(a) != name_key(display[pid]) and '"' not in a})
        pool.append({"id": pid, "name": display[pid], "aka": aka[:8], "g": g, "tags": sorted(t & CRITERION_IDS),
                     "pop": n * POP_PER_MATCH})
    R.add_legacy(pool, report)
    R.add_single_names(pool, report)
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
    pool.sort(key=lambda w: -w["pop"])
    known = collections.Counter(t for w in pool if w["pop"] >= R.WELL_KNOWN_POP for t in w["tags"])
    optional = {c[0] for c in CRITERIA if c[1] == "faction" or c[0].startswith("state") or c[0] in ("wweToAew", "aewToWwe")}
    dropped = {i for i in optional if known[i] < R.MIN_WELL_KNOWN}
    if dropped & {"wweToAew", "aewToWwe"}:
        dropped |= {"wweToAew", "aewToWwe"}
    for w in pool:
        w["tags"] = [t for t in w["tags"] if t not in dropped]
    counts = collections.Counter(t for w in pool for t in w["tags"])
    criteria = [{"id": c[0], "group": c[1], "family": c[2], "label": c[3], "detail": c[4], "count": counts[c[0]],
                 **({"scene": SCENE[c[0]]} if c[0] in SCENE else {})} for c in CRITERIA if c[0] not in dropped]
    report.append(f"- pool {len(pool)}, well known (pop {R.WELL_KNOWN_POP}+) {sum(w['pop'] >= R.WELL_KNOWN_POP for w in pool)}; "
                  f"dropped for fewer than {R.MIN_WELL_KNOWN} well-known names: {sorted(dropped)}")

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "ring.json").write_text(json.dumps({"criteria": criteria, "wrestlers": pool}, separators=(",", ":"),
                                              ensure_ascii=False), encoding="utf-8")
    in_pool = {w["id"] for w in pool}
    gender = {w["id"]: w["g"] for w in pool}
    questions = build_trivia(events, rumble, wm_mains, apps, name_at, gender, in_pool, report)
    questions += R.build_scene_trivia(report)
    questions += R.community_questions({q["id"] for q in questions}, report)
    (OUT / "trivia.json").write_text(json.dumps(questions, indent=1, ensure_ascii=False), encoding="utf-8")
    write_report(report, criteria, pool, questions, wm_mains, aew_mains, rumble, display)
    print(f"no-cagematch: pool {len(pool)} wrestlers, {len(questions)} questions -> {OUT}")


def event_label(e):
    """'Armageddon (2006)' -> 'Armageddon 2006'; a year is added when the name has none."""
    name = re.sub(r"\s*\((\d{4})\)$", r" \1", e["event"])
    name = re.sub(r"\s*\(.*?\)$", "", name)
    if not re.match(r"(NXT )?TakeOver", name):  # "TLC: Tables, Ladders & Chairs" -> "TLC"
        name = name.split(":")[0].strip()
    name = re.sub(r"'(\d\d)\b", lambda m: ("19" if int(m.group(1)) > 50 else "20") + m.group(1), name)
    if "WrestleMania" not in name and not re.search(r"(19|20)\d\d", name) and e["date"]:
        name = f"{name} {e['date'][:4]}"
    return name


def build_trivia(events, rumble, wm_mains, apps, name_at, gender, in_pool, report):
    """The archive mode's question types, from Wikipedia's cards. "classic" there picks the
    best-rated PPV singles matches (CAGEMATCH ratings); here it picks PPV singles matches
    between two well-established names, main events and title matches first."""
    rng = random.Random(1985)
    qs, seen, skipped = [], set(), collections.Counter()
    n_apps = {pid: len(v) for pid, v in apps.items()}

    def add(qtype, prompt, answer, distractors, key):
        qid = f"{qtype}:{key}"
        if qid in seen or re.search(r", | & ", answer):
            skipped[qtype] += 1
            return
        opts = [answer]
        for d in distractors:
            if d and d not in opts and not re.search(r", | & ", d):
                opts.append(d)
        if len(opts) < 4:
            skipped[qtype] += 1
            return
        opts = opts[:4]
        rng.shuffle(opts)
        seen.add(qid)
        qs.append({"id": qid, "type": qtype, "prompt": prompt, "options": opts, "answer": opts.index(answer)})

    year_ids = collections.defaultdict(set)
    for e in events:
        if e["kind"] == "ppv" and e["date"]:
            for m in e["matches"]:
                year_ids[e["date"][:4]].update(p for p in m["pids"] if p in in_pool)

    def famous(ids, k, exclude, year, g=None):
        cand = sorted({p for p in ids if name_at(p, year) not in exclude and (not g or gender.get(p) == g)},
                      key=lambda p: (-n_apps.get(p, 0), p))
        top = cand[: max(k * 3, 8)]
        rng.shuffle(top)
        return [name_at(p, year) for p in top[:k]]

    for e, m in rumble:
        w, year = m["wpids"][0], e["date"][:4]
        g = gender.get(w, "m")
        label = ("women's " if g == "f" else "men's ") if int(year) >= 2018 else ""
        add("rumble", f"Who won the {year} {label}Royal Rumble?", name_at(w, year),
            famous([p for p in m["pids"] if p != w] + list(year_ids[year]), 3, {name_at(w, year)}, year, g), f"{year}{g}")
    cities = {}
    nights = collections.Counter(e["page"] for e, _ in wm_mains)
    done = collections.Counter()
    for e, m in wm_mains:
        done[e["page"]] += 1  # one results table per night, in order
        night = f"{e['page']} Night {done[e['page']]}" if nights[e["page"]] > 1 else e["page"]
        if e["city"]:
            cities[e["page"]] = e["city"]
        if len(m["pids"]) == 2 and len(m["wpids"]) == 1 and m["result"] == "win":
            win = m["wpids"][0]
            lose = next(p for p in m["pids"] if p != win)
            y = e["date"][:4]
            add("wmMain", f"Who won the main event of {night}?", name_at(win, y),
                [name_at(lose, y)] + famous(year_ids[y], 2, {name_at(win, y), name_at(lose, y)}, y, gender.get(win)), night)
    allc = sorted(set(cities.values()))
    for base, city in cities.items():
        add("wmCity", f"Which city hosted {base}?", city, rng.sample([c for c in allc if c != city], 3), base)

    # title changes on PPV: a singles title match the challenger won
    by_group = collections.defaultdict(list)
    for e in events:
        for m in e["matches"]:
            g = next((g for g, pat in TITLE_ARTICLES.items() if m["title"] and re.search(pat, m["title"])), None)
            if g and e["date"]:
                by_group[g].append((e, m))
    for g, ms in by_group.items():
        for e, m in ms:
            if len(m["pids"]) != 2 or len(m["wpids"]) != 1 or m["result"] != "win" or m.get("method") == "dq"                     or not m["cpids"] or m["wpids"][0] in m["cpids"]:
                continue
            win, lose = m["wpids"][0], m["cpids"][0]
            y = e["date"][:4]
            holders = [p for e2, m2 in ms if abs(int(e2["date"][:4]) - int(y)) <= 6 for p in m2["wpids"]]
            add("lineage", f"Who did {name_at(win, y)} beat for the {R.TRIVIA_TITLE_LABELS[g]} at {event_label(e)}?",
                name_at(lose, y), famous(holders, 3, {name_at(win, y), name_at(lose, y)}, y, gender.get(lose)), f"{g}:{e['date']}")

    # "classics": well-established names in a PPV singles match, main events and title matches first
    cand = []
    for e in events:
        if e["kind"] != "ppv" or not e["date"]:
            continue
        mains = [m for m in e["matches"] if not re.fullmatch(NOT_MAIN, m["note"] or "x")]
        for m in e["matches"]:
            if len(m["pids"]) != 2 or len(m["wpids"]) != 1 or m["result"] != "win" or re.search(r"tag|team", m["stip"], re.I):
                continue
            win = m["wpids"][0]
            lose = next(p for p in m["pids"] if p != win)
            if min(n_apps.get(win, 0), n_apps.get(lose, 0)) < 25:
                continue
            weight = (mains and m is mains[-1]) * 2 + bool(m["title"])
            cand.append((-weight, -min(n_apps[win], n_apps[lose]), e["date"], e, m, win, lose))
    cand.sort(key=lambda c: c[:3])
    peers = collections.defaultdict(set)
    for *_, e, m, win, lose in cand:
        peers[e["date"][:4]] |= {win, lose}
    for *_, e, m, win, lose in cand[:600]:
        y = e["date"][:4]
        add("classic", f"Who did {name_at(win, y)} defeat at {event_label(e)}?", name_at(lose, y),
            famous(peers[y], 3, {name_at(win, y), name_at(lose, y)}, y, gender.get(lose)), f"{e['page']}:{m['n']}")

    seen_names = set()
    for e in events:
        promo = next((p for p in e["promos"] if p in ("WCW", "ECW", "TNA", "AEW")), None)
        if e["kind"] != "ppv" or not promo or len(e["promos"]) > 1 or e["co_promoted"]:
            continue
        base = re.sub(r"\s*\(.*\)$", "", e["page"])
        base = re.sub(r"\s*\b(19|20)\d\d\b|\s*'\d\d", "", base).strip()
        if base.lower() in seen_names or re.search(r"WCW|ECW|TNA|AEW|Impact|Nitro|Dynamite|Clash|#\d", base, re.I):
            continue
        seen_names.add(base.lower())
        others = [p for p in ("WWE", "WCW", "ECW", "TNA", "AEW") if p != promo]
        add("promotion", f"Which promotion ran {base}?", promo, rng.sample(others, 3), base)
    report.append(f"- trivia questions generated: {len(qs)}; skipped: {dict(skipped)}")
    return qs


def write_report(report, criteria, pool, questions, wm_mains, aew_mains, rumble, display):
    live = json.loads((R.OUT / "ring.json").read_text(encoding="utf-8"))
    live_trivia = json.loads((R.OUT / "trivia.json").read_text(encoding="utf-8"))
    live_counts = {c["id"]: c["count"] for c in live["criteria"]}
    live_known = collections.Counter(t for w in live["wrestlers"] if w["pop"] >= R.WELL_KNOWN_POP for t in w["tags"])
    known = collections.Counter(t for w in pool if w["pop"] >= R.WELL_KNOWN_POP for t in w["tags"])
    ids = [c[0] for c in CRITERIA]
    lines = ["# Import report: --no-cagematch", "",
             "Built from Wikipedia (PPV cards, title lists, factions, covers), Wikidata and curation only.",
             "Compare with data/generated/REPORT.md (the live, archive-based build).", ""]
    lines += report
    lines += ["", "## Criteria counts, live vs no-cagematch", "",
              "`pool` counts everyone tagged; `well known` counts the grid's answer pool (pop 150+), which decides "
              "whether a cell is fair. `-` = the criterion was dropped (too few well-known names).", "",
              "| criterion | live pool | no-cm pool | live well known | no-cm well known |", "|---|---|---|---|---|"]
    mine = {c["id"]: c["count"] for c in criteria}
    for i in ids:
        if i in live_counts or i in mine:
            lines.append(f"| {i} | {live_counts.get(i, '-')} | {mine.get(i, '-')} | "
                         f"{live_known[i] if i in live_counts else '-'} | {known[i] if i in mine else '-'} |")
    lines += ["", f"Pool: live {len(live['wrestlers'])} ({sum(w['pop'] >= R.WELL_KNOWN_POP for w in live['wrestlers'])} well known), "
              f"no-cagematch {len(pool)} ({sum(w['pop'] >= R.WELL_KNOWN_POP for w in pool)} well known)."]
    lc, mc = collections.Counter(q["type"] for q in live_trivia), collections.Counter(q["type"] for q in questions)
    lines += ["", "## Trivia counts, live vs no-cagematch", "", "| type | live | no-cm |", "|---|---|---|"]
    lines += [f"| {t} | {lc[t]} | {mc[t]} |" for t in sorted(set(lc) | set(mc))]
    lines += ["", "## Royal Rumble winners", ""] + [f"- {e['date']} {display[m['wpids'][0]]}" for e, m in rumble]
    lines += ["", "## WrestleMania final matches", ""] + [f"- {e['date']} {e['page']} {e['section']}: {' / '.join(display[p] for p in m['pids'])}" for e, m in wm_mains]
    lines += ["", "## AEW PPV final matches", ""] + [f"- {e['date']} {e['page']}: {' / '.join(display[p] for p in m['pids'])}" for e, m in aew_mains]
    lines += ["", "## Top of pool", ""] + [f"- {w['name']} ({w['g']}, pop {w['pop']}): {', '.join(w['tags'])}" for w in pool[:40]]
    sample = random.Random(7).sample(questions, min(60, len(questions)))
    lines += ["", "## Trivia sample", ""] + [f"- [{q['type']}] {q['prompt']} -> **{q['options'][q['answer']]}** (of {q['options']})"
                                              for q in sorted(sample, key=lambda q: q["type"])]
    (OUT / "REPORT.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
