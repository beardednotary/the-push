"""Download the curation tabs from the Google Sheet into data/curation/*.csv.

The sheet's tabs are published to the web as CSV (File > Share > Publish to web),
and their links live in data/curation/sheet.json:

    {"merges": "https://docs.google.com/.../pub?gid=0&single=true&output=csv",
     "tags":   "https://docs.google.com/.../pub?gid=123&single=true&output=csv",
     "wikidata": "...optional third tab...",
     "questions": "...community trivia tab..."}

    python scripts/pull_curation.py      # then: python scripts/import_ringside.py

The tags and merges tabs add to the local files instead of replacing them, so a sheet that
is behind the repo (or a stale published copy) can't quietly undo fixes. A sheet row replaces
the local row for the same wrestler/tag/action (or keep/merge) unless its note is blank; local
rows the sheet lacks are kept and listed. To undo a tag, add the opposite row (remove for add)
rather than deleting it.
"""
import csv
import io
import json
import pathlib
import re
import sys
import urllib.request

CUR = pathlib.Path(__file__).resolve().parent.parent / "data/curation"
HEADERS = {
    "merges": ["keep", "merge", "display", "note"],
    "tags": ["wrestler", "tag", "action", "note"],
    "wikidata": ["wrestler", "qid", "note"],  # optional third tab: pins to Wikidata people
    # community trivia; a row only reaches the game once "approved" is set (yes / y / x / true / 1)
    "questions": ["prompt", "answer", "wrong1", "wrong2", "wrong3", "source", "region", "approved", "note"],
}


# tabs whose rows add to the local file, and how many leading columns identify a row
ADDITIVE = {"tags": 3, "merges": 2}


def merge_local(tab, body):
    """The local file's rows, updated and extended by the sheet's (see the docstring)."""
    n = ADDITIVE[tab]
    key = lambda r: tuple(c.strip().lower() for c in r[:n])
    with open(CUR / f"{tab}.csv", newline="", encoding="utf-8") as f:
        local = [r for r in list(csv.reader(f))[1:] if any(c.strip() for c in r)]
    out = {key(r): r for r in local}
    for r in body:
        k = key(r)
        if k in out and not r[-1].strip():
            continue  # same row, blank note: keep the local note
        out[k] = r
    sheet = {key(r) for r in body}
    missing = [r for r in local if key(r) not in sheet]
    if missing:
        print(f"- {tab}: {len(missing)} row(s) are only in the repo; add them to the sheet so it matches:")
        for r in missing:
            print("    " + ",".join(r))
    return list(out.values())


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
        if tab == "questions":
            rows = question_rows(rows, got)
            got = want
        if got[: len(want)] != want:
            sys.exit(f"{tab}: expected columns {want}, the sheet has {got}. Nothing was changed.")
        body = [r[: len(want)] for r in rows[1:] if any(c.strip() for c in r)]
        body = [r + [""] * (len(want) - len(r)) for r in body if [c.strip().lower() for c in r] != want]  # pasted header rows
        if tab in ADDITIVE and (CUR / f"{tab}.csv").exists():
            body = merge_local(tab, body)
        out = CUR / f"{tab}.csv"
        with open(out, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f, lineterminator="\n")
            w.writerow(want)
            w.writerows(body)
        print(f"- {tab}: {len(body)} rows -> {out.relative_to(CUR.parent.parent)}")


def question_rows(rows, got):
    """The questions tab is laid out for people typing in it: prompt, answer, "3 wrong options"
    in one cell (split on ; | / or new lines, else commas), "source URL", region, approved.
    Columns are found by name, so their order doesn't matter. Without an approved column no
    row goes live."""
    def col(*names):
        return next((i for i, h in enumerate(got) if any(n in h for n in names)), None)
    ip, ia, iw, isrc, ir, iok, inote = col("prompt", "question"), col("answer"), col("wrong"), col("source"), col("region"), col("approved"), col("note")
    if ip is None or ia is None or iw is None:
        sys.exit(f"questions: need prompt, answer and wrong-option columns; the sheet has {got}. Nothing was changed.")
    if iok is None:
        print("- questions: no 'approved' column in the sheet yet, so no question goes live. Add one and put yes in it to approve a row.")
    out = [HEADERS["questions"]]
    for r in rows[1:]:
        cell = lambda i: r[i].strip() if i is not None and i < len(r) else ""
        wrong = [w.strip() for w in re.split(r"[;|/\n]", cell(iw)) if w.strip()]
        if len(wrong) < 3 and "," in cell(iw):
            wrong = [w.strip() for w in cell(iw).split(",") if w.strip()]
        # anything but exactly three wrong options leaves a blank, which the import rejects
        wrong = wrong if len(wrong) == 3 else ["", "", ""]
        out.append([cell(ip), cell(ia), *wrong, cell(isrc), cell(ir), cell(iok), cell(inote)])
    return out


if __name__ == "__main__":
    main()
