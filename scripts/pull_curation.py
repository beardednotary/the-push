"""Download the curation tabs from the Google Sheet into data/curation/*.csv.

The sheet's tabs are published to the web as CSV (File > Share > Publish to web),
and their links live in data/curation/sheet.json:

    {"merges": "https://docs.google.com/.../pub?gid=0&single=true&output=csv",
     "tags":   "https://docs.google.com/.../pub?gid=123&single=true&output=csv",
     "wikidata": "...optional third tab..."}

    python scripts/pull_curation.py      # then: python scripts/import_ringside.py
"""
import csv
import io
import json
import pathlib
import sys
import urllib.request

CUR = pathlib.Path(__file__).resolve().parent.parent / "data/curation"
HEADERS = {
    "merges": ["keep", "merge", "display", "note"],
    "tags": ["wrestler", "tag", "action", "note"],
    "wikidata": ["wrestler", "qid", "note"],  # optional third tab: pins to Wikidata people
}


def main():
    cfg_path = CUR / "sheet.json"
    if not cfg_path.exists():
        sys.exit(f"No {cfg_path.name} yet. Add the published CSV link for each tab (see this file's docstring).")
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    for tab, want in HEADERS.items():
        url = cfg.get(tab)
        if not url:
            print(f"- {tab}: no link in sheet.json, keeping the local file")
            continue
        try:
            with urllib.request.urlopen(url, timeout=30) as resp:
                text = resp.read().decode("utf-8-sig")
        except Exception as e:
            print(f"- {tab}: couldn't download ({e}); keeping the local file. Is the tab published?")
            continue
        rows = list(csv.reader(io.StringIO(text)))
        got = [h.strip().lower() for h in rows[0]] if rows else []
        if got[: len(want)] != want:
            sys.exit(f"{tab}: expected columns {want}, the sheet has {got}. Nothing was changed.")
        body = [r[: len(want)] for r in rows[1:] if any(c.strip() for c in r)]
        out = CUR / f"{tab}.csv"
        with open(out, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f, lineterminator="\n")
            w.writerow(want)
            w.writerows(body)
        print(f"- {tab}: {len(body)} rows -> {out.relative_to(CUR.parent.parent)}")


if __name__ == "__main__":
    main()
