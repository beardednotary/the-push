"""Match results from Wikipedia's pay-per-view and TV special articles (WWE/WWF, NXT, WCW, ECW, TNA, AEW).

    python scripts/fetch_ppv_results.py      # writes data/raw/ppv_results.json (git-ignored)

Every event article with a results table uses the {{Pro wrestling results table}} template,
so the fetch lists the pages that embed it, reads their wikitext 50 pages per request, and
keeps the ones whose infobox names one of our promotions. The facts (who beat whom, the
stipulation, the title) come from Wikipedia, not from CAGEMATCH, so the import can use them
whatever CAGEMATCH's terms say. See docs/data-independence.md.

API responses are cached in data/raw/ppv_cache/, so a re-run only asks Wikipedia again with
--refresh. Participant articles are resolved to Wikidata ids (pageprops), which is how the
import matches them to people without going through names.

Output: {"events": [...], "qids": {article: Qid}, "humans": [Qid], "teams": {Qid: [member Qid]}}. Each event: page, event, section, date,
promos, brand, kind (ppv / tv), city, matches. Each match: n, note, result (win / draw /
nc), method ("dq" for a disqualification or count-out win), winners, losers (article titles; for a draw everyone is in losers), champs (who came
in with "(c)"), names (article -> name shown on the card), stip, title (championship
article), secs.
"""
import hashlib
import json
import pathlib
import re
import sys
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data/raw/ppv_results.json"
CACHE = ROOT / "data/raw/ppv_cache"
API = "https://en.wikipedia.org/w/api.php"
UA = "ThePushDataBot/1.0 (https://playthepush.com; ray@dahvio.com)"
TEMPLATES = ["Template:Pro wrestling results table", "Template:Pro Wrestling results table"]  # both spellings are in use
REFRESH = "--refresh" in sys.argv

# infobox promotion text -> our promotion. WWE's 2006-10 ECW brand reads "World Wrestling
# Entertainment", so it lands under WWE, which is right for the ECW criterion (original ECW only).
PROMOS = [
    ("WWE", r"World Wrestling (Federation|Entertainment)|\bWWE\b|\bWWF\b|Titan Sports"),
    ("WCW", r"World Championship Wrestling|\bWCW\b"),
    ("ECW", r"Extreme Championship Wrestling|Eastern Championship Wrestling|\bECW\b"),
    ("TNA", r"Total Nonstop Action|\bTNA\b|Impact Wrestling|NWA[- ]TNA"),
    ("AEW", r"All Elite Wrestling|\bAEW\b"),
]
OTHER_PROMO = r"New Japan|NJPW|Ring of Honor|\bROH\b|CMLL|\bAAA\b|NOAH|Stardom|National Wrestling Alliance|\bNWA\b(?![- ]TNA)|Jim Crockett|Lucha Libre|DDT|All Japan"
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
DATE_MDY = r"(%s)\s+(\d{1,2}),?\s+((?:19|20)\d\d)" % "|".join(MONTHS)
DATE_DMY = r"(\d{1,2})\s+(%s),?\s+((?:19|20)\d\d)" % "|".join(MONTHS)
PROMO_LINK = r"Wrestling|Pro-Wrestling|Lucha Libre|\b(AEW|WWE|NXT|TNA|Impact|NJPW|ROH|CMLL|AAA|NOAH|Stardom|DDT|GCW|MLW)\b"
WIKIDATA = "https://query.wikidata.org/sparql"
NOT_PEOPLE =r"(?i)pinfall|submission|disqualif|count[- ]?out|forfeit|knockout|referee|technical|match\b|championship|title\b|\(professional wrestling\)$|^(professional wrestling|draw|no contest|tag team|battle royal|royal rumble)"

_last = [0.0]


def api(params):
    """One MediaWiki API call, cached on disk; at most two uncached calls a second."""
    params = {**params, "format": "json", "formatversion": "2", "maxlag": "5"}
    body = urllib.parse.urlencode(sorted(params.items()))
    path = CACHE / (hashlib.sha1(body.encode()).hexdigest() + ".json")
    if path.exists() and not REFRESH:
        return json.loads(path.read_text(encoding="utf-8"))
    for attempt in range(5):
        wait = 0.5 - (time.time() - _last[0])
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.time()
        req = urllib.request.Request(API, data=body.encode(), headers={
            "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded", "Accept-Encoding": "identity"})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                data = json.load(r)
            if data.get("error", {}).get("code") == "maxlag":
                raise RuntimeError("maxlag")
            break
        except Exception as e:  # lag or rate limit: back off
            print(f"  retry {attempt + 1}: {e}")
            time.sleep(5 * (attempt + 1))
    else:
        raise RuntimeError("Wikipedia API kept failing")
    CACHE.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return data


def embedded_pages():
    pages = set()
    for template in TEMPLATES:
        cont = {}
        while True:
            d = api({"action": "query", "list": "embeddedin", "eititle": template, "einamespace": "0", "eilimit": "500", **cont})
            pages |= {p["title"] for p in d["query"]["embeddedin"]}
            if "continue" not in d:
                break
            cont = d["continue"]
    return sorted(pages)


def wikitexts(titles):
    """{title: wikitext}, 50 titles per request (the API's limit)."""
    out = {}
    for i in range(0, len(titles), 50):
        batch = titles[i : i + 50]
        todo = batch
        while todo:  # a big batch can come back partial; ask again for the rest
            d = api({"action": "query", "prop": "revisions", "rvprop": "content", "rvslots": "main", "titles": "|".join(todo)})
            for p in d["query"]["pages"]:
                if p.get("revisions"):
                    out[p["title"]] = p["revisions"][0]["slots"]["main"]["content"]
            missing = [t for t in todo if t not in out and not any(p["title"] == t and "missing" in p for p in d["query"]["pages"])]
            todo = missing if len(missing) < len(todo) else []
        print(f"  wikitext {min(i + 50, len(titles))}/{len(titles)}", end="\r")
    print()
    return out


def qids(titles):
    """{article title as linked: Wikidata id}, following redirects."""
    out = {}
    titles = sorted(titles)
    for i in range(0, len(titles), 50):
        batch = titles[i : i + 50]
        d = api({"action": "query", "prop": "pageprops", "ppprop": "wikibase_item", "redirects": "1", "titles": "|".join(batch)})
        q = d["query"]
        back = {}
        for n in q.get("normalized", []):
            back.setdefault(n["to"], []).append(n["from"])
        for r in q.get("redirects", []):
            back.setdefault(r["to"], []).extend([r["from"], *back.get(r["from"], [])])
        for p in q["pages"]:
            item = p.get("pageprops", {}).get("wikibase_item")
            if item:
                for t in [p["title"], *back.get(p["title"], [])]:
                    out[t] = item
        print(f"  wikidata ids {min(i + 50, len(titles))}/{len(titles)}", end="\r")
    print()
    return out


# ---- wikitext parsing --------------------------------------------------------

def strip_refs(t):
    t = re.sub(r"<ref[^>/]*/>", "", t)
    t = re.sub(r"<ref[^>]*>.*?</ref>", "", t, flags=re.S)
    t = re.sub(r"<!--.*?-->", "", t, flags=re.S)
    t = re.sub(r"<br\s*/?>", " ", t)
    return t


def strip_templates(t):
    # innermost first so nested templates go too; {{sortname|First|Last}} keeps its name
    t = re.sub(r"\{\{\s*sortname\s*\|([^|{}]*)\|([^|{}]*)[^{}]*\}\}", r"\1 \2", t, flags=re.I)
    for _ in range(5):
        t2 = re.sub(r"\{\{[^{}]*\}\}", "", t)
        if t2 == t:
            break
        t = t2
    return t


def template_params(text, start):
    """Parameters of the template that opens at text[start] ("{{"), split at top-level pipes."""
    depth, i, params, cur = 0, start, [], []
    while i < len(text):
        two = text[i : i + 2]
        if two in ("{{", "[["):
            depth += 1
            cur.append(two)
            i += 2
            continue
        if two in ("}}", "]]"):
            depth -= 1
            if depth == 0:
                params.append("".join(cur))
                break
            cur.append(two)
            i += 2
            continue
        if text[i] == "|" and depth == 1:
            params.append("".join(cur))
            cur = []
        else:
            cur.append(text[i])
        i += 1
    out = {}
    for p in params[1:]:
        if "=" in p:
            k, v = p.split("=", 1)
            out[k.strip().lower()] = v.strip()
    return out, i


def link_target(inner):
    target = inner.split("|")[0].strip().replace("_", " ")
    target = target.split("#")[0].strip()
    return target[:1].upper() + target[1:] if target else ""


def plain(t):
    """Wikitext to plain text: links become their shown text."""
    t = re.sub(r"\[\[([^\]|]*)\|([^\]]*)\]\]", r"\2", t)
    t = re.sub(r"\[\[([^\]]*)\]\]", r"\1", t)
    t = re.sub(r"'{2,}", "", t)
    return re.sub(r"\s+", " ", t).strip()


def drop_parens(t, pred):
    """Remove parenthesised groups (balanced) whose text matches pred."""
    out, i = [], 0
    while i < len(t):
        if t[i] == "(":
            depth, j = 0, i
            while j < len(t):
                depth += t[j] == "("
                depth -= t[j] == ")"
                if depth == 0:
                    break
                j += 1
            group = t[i : j + 1]
            if pred(group):
                i = j + 1
                continue
        out.append(t[i])
        i += 1
    return "".join(out)


def people(side):
    """[(article, shown name, came in as champion)] from one side of a result."""
    side = drop_parens(side, lambda g: re.match(r"\(\s*(with|accompanied)\b", g, re.I))
    # "Kenny Omega (AEW) vs. Rich Swann (Impact)": a promotion in brackets is an affiliation, not a team
    side = drop_parens(side, lambda g: re.fullmatch(r"\(\s*(\[\[[^\]]*\]\]|[A-Z][\w-]*)\s*\)", g) and re.search(PROMO_LINK, g))
    # "[[MNM]] ([[Joey Mercury]] and [[Johnny Nitro]])": the members count, not the team link
    side = re.sub(r"\[\[[^\]]+\]\]\s*(?=\((?![cC]\))[^()]*\[\[)", "", side)
    out = []
    for m in re.finditer(r"\[\[([^\]]+)\]\]((?:\s*\([^()]*\))*)", side):
        inner, after = m.group(1), m.group(2)
        art = link_target(inner)
        if not art or ":" in art or re.search(NOT_PEOPLE, art):
            continue
        shown = plain(f"[[{inner}]]")
        champ = bool(re.search(r"\(\s*c\s*\)", after))
        out.append((art, shown, champ))
    # "(c)" after a team's member list marks every member
    if re.search(r"\)\s*\(\s*c\s*\)", side) and not any(c for _, _, c in out):
        out = [(a, s, True) for a, s, _ in out]
    return out


def parse_match(text):
    text = strip_templates(strip_refs(text))
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return None
    m = re.search(r"\s(defeated|defeat|won by|wins by|won the|won a|won)\s", text)
    if m and not re.search(r"\b(ended in|fought to|went to) a (draw|no contest|double)", text, re.I):
        win, lose = text[: m.start()], text[m.end() :]
        lose = re.split(r"\s+(?:by|via|after|when|to win|to retain|in)\s+(?=\[\[|[a-z])", lose, maxsplit=1)[0] if m.group(1).startswith("defeat") else lose
        w, l = people(win), people(lose)
        # a title doesn't change hands on a disqualification or count-out
        method = "dq" if re.search(r"disqualif|count[- ]?out|countout|\bDQ\b", plain(text[m.end():]), re.I) else ""
        return {"result": "win", "w": w, "l": l, "method": method} if w else None
    everyone = people(re.split(r"\s+(?:ended|fought|went)\s", text)[0])
    if not everyone:
        return None
    result = "nc" if re.search(r"no contest|no-contest", text, re.I) else "draw"
    return {"result": result, "w": [], "l": everyone, "method": ""}


def secs(t):
    m = re.search(r"(?:(\d+):)?(\d{1,2}):(\d\d)", plain(strip_templates(strip_refs(t or ""))))
    if not m:
        return 0
    h, mi, s = int(m.group(1) or 0), int(m.group(2)), int(m.group(3))
    return h * 3600 + mi * 60 + s


def find_date(text):
    text = strip_refs(text)
    m = re.search(r"\{\{\s*(?:start date|start-date|dts)[^{}]*?\|\s*((?:19|20)\d\d)\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})", text, re.I)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    m = re.search(DATE_MDY, text)
    if m:
        return f"{m.group(3)}-{MONTHS.index(m.group(1)) + 1:02d}-{int(m.group(2)):02d}"
    m = re.search(DATE_DMY, text)
    if m:
        return f"{m.group(3)}-{MONTHS.index(m.group(2)) + 1:02d}-{int(m.group(1)):02d}"
    m = re.search(r"\b((?:19|20)\d\d)-(\d\d)-(\d\d)\b", text)
    return m.group(0) if m else ""


def infobox(text):
    m = re.search(r"\{\{\s*Infobox[^|}]*", text, re.I)
    return template_params(text, m.start())[0] if m else {}


def promos_of(box, lead, title):
    """Our promotions that ran the event, and whether another promotion shared it. The
    infobox decides; without one, only the first sentence counts, and the promotion it names
    first wins (Clash of the Champions: "produced by World Championship Wrestling ...")."""
    if box.get("promotion"):
        src = plain(strip_refs(box["promotion"]))
        found = [p for p, pat in PROMOS if re.search(pat, src)]
        return found, bool(re.search(OTHER_PROMO, src))
    if re.search(r"^List of|\bfilm\b|\bseason\b|tournaments", title):
        return [], False
    first = re.split(r"(?<=[a-z)])\.\s", lead, maxsplit=1)[0]
    if re.search(r"\bindependent\b", first):
        return [], False
    hits = sorted((m.start(), p) for p, pat in PROMOS for m in [re.search(pat, first)] if m)
    other = re.search(OTHER_PROMO, first)
    if not hits or (other and other.start() < hits[0][0]):
        return [], False
    return [hits[0][1]], False


def parse_page(title, text):
    box = infobox(text)
    lead = plain(strip_templates(strip_refs(text[: text.find("==")] if "==" in text else text)))[:1500]
    promos, co_promoted = promos_of(box, lead, title)
    if not promos:
        return []
    brand = plain(strip_refs(box.get("brand", "")))
    if re.search(r"\bNXT\b", title) or re.search(r"\bNXT\b", brand) and not re.search(r"Raw|SmackDown", brand):
        brand = "NXT"
    kind = "tv" if re.search(r"television special|special episode|episode of|television (event|program)|aired (live )?on", lead, re.I) \
        and not re.search(r"pay-per-view|livestreaming event|livestream", lead[:400], re.I) else "ppv"
    page_date = find_date(box.get("date", "")) or find_date(lead)
    city = plain(strip_templates(strip_refs(box.get("city", "")))).split(",")[0].strip()
    events = []
    starts = [m.start() for m in re.finditer(r"\{\{\s*Pro Wrestling results table", text, re.I)]
    for k, start in enumerate(starts):
        params, _ = template_params(text, start)
        heads = list(re.finditer(r"^(={2,4})\s*(.*?)\s*\1\s*$", text[:start], re.M))
        section = plain(strip_templates(heads[-1].group(2))) if heads else ""
        date = page_date
        if len(starts) > 1:
            # one article, many shows (Clash of the Champions): the date nearest above the table
            since = heads[-1].end() if heads else 0
            dates = [find_date(m.group(0)) for m in re.finditer(DATE_MDY + "|" + DATE_DMY, strip_refs(text[since:start]))]
            date = dates[0] if dates else page_date
        matches = []
        nums = sorted({int(m.group(1)) for k_ in params for m in [re.match(r"match(\d+)$", k_)] if m})
        for n in nums:
            pm = parse_match(params.get(f"match{n}", ""))
            if not pm:
                continue
            stip = plain(strip_templates(strip_refs(params.get(f"stip{n}", ""))))
            raw_stip = strip_templates(strip_refs(params.get(f"stip{n}", "")))
            tm = re.search(r"for the\s+(?:vacant\s+)?(?:'+)?\[\[([^\]]+)\]\]", raw_stip)
            names = {a: s for a, s, _ in pm["w"] + pm["l"]}
            matches.append({
                "n": n, "note": plain(strip_templates(strip_refs(params.get(f"note{n}", "")))).lower(),
                "result": pm["result"], "method": pm["method"], "winners": [a for a, _, _ in pm["w"]], "losers": [a for a, _, _ in pm["l"]],
                "champs": [a for a, _, c in pm["w"] + pm["l"] if c], "names": names, "stip": stip,
                "title": link_target(tm.group(1)) if tm else "", "secs": secs(params.get(f"time{n}", "")),
            })
        if matches:
            events.append({"page": title, "event": section if len(starts) > 1 and section and not re.match(r"(?i)results?$", section) else title,
                           "section": section, "date": date, "promos": promos, "co_promoted": co_promoted,
                           "brand": brand, "kind": kind, "city": city, "matches": matches})
    return events


def wikidata_kinds(items):
    """Which participant items are people (P31 human), and the members (P527) of the ones that
    are teams, so "The Hardys" on a card with no member list still counts for Matt and Jeff."""
    humans, teams = set(), {}
    items = sorted(set(items))
    for i in range(0, len(items), 250):
        values = " ".join(f"wd:{q}" for q in items[i : i + 250])
        sparql = f"""SELECT ?p ?human ?m WHERE {{ VALUES ?p {{ {values} }}
            OPTIONAL {{ ?p wdt:P31 wd:Q5 . BIND(1 AS ?human) }} OPTIONAL {{ ?p wdt:P527 ?m }} }}"""
        body = urllib.parse.urlencode({"query": sparql, "format": "json"})
        path = CACHE / ("wd-" + hashlib.sha1(body.encode()).hexdigest() + ".json")
        if path.exists() and not REFRESH:
            rows = json.loads(path.read_text(encoding="utf-8"))
        else:
            req = urllib.request.Request(WIKIDATA, data=body.encode(), headers={
                "User-Agent": UA, "Accept": "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded"})
            for attempt in range(4):
                try:
                    with urllib.request.urlopen(req, timeout=120) as r:
                        rows = json.load(r)["results"]["bindings"]
                    break
                except Exception as e:
                    print(f"  retry {attempt + 1}: {e}")
                    time.sleep(10 * (attempt + 1))
            else:
                raise RuntimeError("Wikidata query kept failing")
            path.write_text(json.dumps(rows), encoding="utf-8")
            time.sleep(1)
        for b in rows:
            q = b["p"]["value"].rsplit("/", 1)[1]
            if "human" in b:
                humans.add(q)
            if "m" in b:
                teams.setdefault(q, []).append(b["m"]["value"].rsplit("/", 1)[1])
    teams = {q: sorted(set(ms)) for q, ms in teams.items() if q not in humans}
    return sorted(humans), teams


def main():
    print("pages using the results table ...")
    titles = embedded_pages()
    print(f"  {len(titles)}")
    texts = wikitexts(titles)
    events = []
    for t in sorted(texts):
        events += parse_page(t, texts[t])
    arts = {a for e in events for m in e["matches"] for a in m["winners"] + m["losers"]}
    print(f"events {len(events)}, matches {sum(len(e['matches']) for e in events)}, participant articles {len(arts)}")
    q = qids(arts)
    humans, teams = wikidata_kinds(q.values())
    print(f"  {len(humans)} people, {len(teams)} teams with members on Wikidata")
    by = {}
    for e in events:
        for p in e["promos"]:
            by[p] = by.get(p, 0) + 1
    print("events by promotion:", by, "| no date:", sum(not e["date"] for e in events))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"events": events, "qids": q, "humans": humans, "teams": teams},ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
