"""Fetch life-outside-the-ring facts for professional wrestlers from Wikidata (CC0).

    python scripts/fetch_wikidata.py      # writes data/raw/wikidata.json (git-ignored)

One SPARQL query per fact so none of them time out. The import script matches these
people to the archive by ring name, alias or real name, and turns facts into Ring
categories. Re-run occasionally; Wikidata keeps improving.

Country: born_in is the country of the place of birth (P19); citizen lists the
citizenships (P27). The import uses born_in, and falls back to a single citizenship
when Wikidata has no birthplace.
"""
import csv
import json
import pathlib
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data/raw/wikidata.json"
PINNED = ROOT / "data/curation/wikidata.csv"  # people we always fetch, even if not tagged as wrestlers
ENDPOINT = "https://query.wikidata.org/sparql"
UA = "ThePushDataBot/1.0 (https://playthepush.com; ray@dahvio.com)"
WRESTLER = "wd:Q13474373"

# fact -> SPARQL pattern binding ?p (a wrestler) when the fact holds
FACTS = {
    "actor": "?p wdt:P106 ?o . VALUES ?o { wd:Q33999 wd:Q10800557 wd:Q10798782 wd:Q2405480 }",
    "music": "?p wdt:P106 ?o . VALUES ?o { wd:Q177220 wd:Q639669 wd:Q2252262 wd:Q488205 wd:Q753110 wd:Q855091 wd:Q36834 }",
    "mma": "?p wdt:P106 wd:Q11607585 .",
    "boxer": "?p wdt:P106 wd:Q11338576 .",
    "amateur": "?p wdt:P106 wd:Q12369333 .",  # amateur wrestler (not the generic "wrestler")
    "strength": "?p wdt:P106 ?o . VALUES ?o { wd:Q15982795 wd:Q23845879 wd:Q1852228 }",
    "politician": "?p wdt:P106 wd:Q82955 .",
    "nfl": "?p wdt:P54 ?t . ?t wdt:P118 ?lg . VALUES ?lg { wd:Q1215884 wd:Q464508 wd:Q389307 }",
    "cfl": "?p wdt:P54 ?t . ?t wdt:P118 wd:Q1032175 .",
    "football": "{ ?p wdt:P106 wd:Q19204627 . } UNION { ?p wdt:P54 ?t . ?t wdt:P118 ?lg . VALUES ?lg { wd:Q1215884 wd:Q464508 wd:Q389307 wd:Q1032175 } }",
    # college teams play in NCAA divisions or conferences (SEC, Big Ten, ...)
    "college": "?p wdt:P54 ?t . ?t wdt:P118 ?lg . ?lg rdfs:label ?ll . FILTER(LANG(?ll) = 'en' && (CONTAINS(?ll, 'NCAA') || CONTAINS(?ll, 'Conference')))",
    "olympian": "?p wdt:P1344 ?e . ?e rdfs:label ?el . FILTER(LANG(?el) = 'en' && CONTAINS(?el, 'Olympics'))",
    # a parent, child or sibling who was also a pro wrestler
    "family": "?p wdt:P22|wdt:P25|wdt:P40|wdt:P3373 ?r . ?r wdt:P106 wd:Q13474373 .",
}


def query(sparql):
    # POST: batched VALUES lists are too long for a URL
    data = urllib.parse.urlencode({"query": sparql, "format": "json"}).encode()
    req = urllib.request.Request(ENDPOINT, data=data, headers={
        "User-Agent": UA, "Accept": "application/sparql-results+json",
        "Content-Type": "application/x-www-form-urlencoded"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.load(r)["results"]["bindings"]
        except Exception as e:  # rate limit or timeout: back off and retry
            print(f"  retry {attempt + 1}: {e}")
            time.sleep(10 * (attempt + 1))
    raise RuntimeError("Wikidata query kept failing")


def query_batched(select, pattern, qids, size=300):
    """Run a pattern for a known list of wrestlers, a batch at a time (keeps each query small)."""
    out = []
    for i in range(0, len(qids), size):
        values = " ".join(f"wd:{q}" for q in qids[i : i + size])
        # the optimizer hint keeps the planner from starting at the far end of the pattern
        out += query(f'SELECT DISTINCT {select} WHERE {{ hint:Query hint:optimizer "None" . VALUES ?p {{ {values} }} {pattern} }}')
        time.sleep(1)
    return out


def qid(binding, var="p"):
    return binding[var]["value"].rsplit("/", 1)[1]


def main():
    people = {}
    print("names ...")
    for b in query(f"""SELECT ?p ?label ?real (GROUP_CONCAT(DISTINCT ?alt; separator="|") AS ?alts) WHERE {{
        ?p wdt:P106 {WRESTLER} .
        OPTIONAL {{ ?p rdfs:label ?label FILTER(LANG(?label) = "en") }}
        OPTIONAL {{ ?p skos:altLabel ?alt FILTER(LANG(?alt) = "en") }}
        OPTIONAL {{ ?p wdt:P1477 ?real }}
    }} GROUP BY ?p ?label ?real"""):
        rec = people.setdefault(qid(b), {"label": "", "aliases": [], "facts": [], "born_in": "", "citizen": []})
        rec["label"] = b.get("label", {}).get("value", "") or rec["label"]
        names = set(rec["aliases"]) | set(filter(None, b.get("alts", {}).get("value", "").split("|")))
        if b.get("real"):
            names.add(b["real"]["value"])
        rec["aliases"] = sorted(names)
    print(f"  {len(people)} wrestlers")
    pinned = [r["qid"] for r in csv.DictReader(open(PINNED, encoding="utf-8"))] if PINNED.exists() else []
    if pinned:
        values = " ".join(f"wd:{q}" for q in pinned)
        for b in query(f"""SELECT ?p ?label WHERE {{ VALUES ?p {{ {values} }}
            OPTIONAL {{ ?p rdfs:label ?label FILTER(LANG(?label) = "en") }} }}"""):
            people.setdefault(qid(b), {"label": b.get("label", {}).get("value", ""), "aliases": [], "facts": [], "born_in": "", "citizen": []})
        print(f"  plus {len(pinned)} pinned in data/curation/wikidata.csv")

    ids = sorted(people)
    print("birthplaces ...")
    for b in query_batched("?p ?code", "?p wdt:P19 ?pl . ?pl wdt:P17 ?c . ?c wdt:P297 ?code .", ids):
        people[qid(b)]["born_in"] = b["code"]["value"]
    print("citizenships ...")
    for b in query_batched("?p ?code", "?p wdt:P27 ?c . ?c wdt:P297 ?code .", ids):
        rec = people[qid(b)]
        if b["code"]["value"] not in rec["citizen"]:
            rec["citizen"].append(b["code"]["value"])

    for fact, pattern in FACTS.items():
        rows = query_batched("?p", pattern, ids)
        hits = 0
        for b in rows:
            if qid(b) in people and fact not in people[qid(b)]["facts"]:
                people[qid(b)]["facts"].append(fact)
                hits += 1
        print(f"{fact:>10}: {hits}")
        time.sleep(1)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(people, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
