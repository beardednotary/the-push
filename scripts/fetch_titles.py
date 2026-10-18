"""Complete championship histories from Wikipedia's "List of ... Champions" pages.

    python scripts/fetch_titles.py      # writes data/raw/titles_wiki.json (git-ignored)

The archive's title_reigns table has gaps (it has ~22 WCW Television Champions out of
well over a hundred), which made the Ring reject correct answers. The import adds a
title tag to anyone named in the Champion column of these lists. Only that column is
read, so opponents mentioned in notes never count.

Japanese and Mexican titles and tournaments (G1 Climax and so on) come from here too,
since the archive has no NJPW, AJPW, NOAH, Stardom, CMLL or AAA title histories.
"""
import json
import pathlib
import re
import time
import urllib.parse
import urllib.request
from html.parser import HTMLParser

OUT = pathlib.Path(__file__).resolve().parent.parent / "data/raw/titles_wiki.json"
UA = "ThePushDataBot/1.0 (https://playthepush.com; ray@dahvio.com)"

# Ring criterion id -> Wikipedia list pages
PAGES = {
    "wweChamp": ["List of WWE Champions"],
    "whc": ["List of World Heavyweight Champions (WWE, 2002–2013)", "World Heavyweight Championship (WWE)"],
    "universal": ["List of WWE Universal Champions"],
    "wcwChamp": ["List of WCW World Heavyweight Champions"],
    "ecwChamp": ["List of ECW World Heavyweight Champions"],
    "aewChamp": ["List of AEW World Champions"],
    "ic": ["List of WWE Intercontinental Champions"],
    "us": ["List of WWE United States Champions"],
    "tv": ["List of WCW World Television Champions", "List of ECW World Television Champions"],
    "cruiser": ["List of WWE Cruiserweight Champions (1996–2007)", "List of WWF Light Heavyweight Champions", "List of NXT Cruiserweight Champions"],
    "hardcore": ["List of WWE Hardcore Champions", "List of WCW Hardcore Champions"],
    "european": ["List of WWE European Champions"],
    "nxtChamp": ["List of NXT Champions"],
    "twentyFourSeven": ["List of WWE 24/7 Champions"],
    "tag": ["List of World Tag Team Champions (WWE)", "List of WWE Tag Team Champions", "List of WCW World Tag Team Champions",
            "List of ECW World Tag Team Champions", "List of NXT Tag Team Champions", "List of TNA World Tag Team Champions",
            "List of AEW World Tag Team Champions", "List of WWE Women's Tag Team Champions"],
    "womens": ["List of WWE Women's Champions (1956–2010)", "List of WWE Women's Champions", "List of WWE Divas Champions",
               "List of WWE Raw Women's Champions", "List of NXT Women's Champions", "List of Women's World Champions (WWE)"],
    # Japan and Mexico
    "iwgpChamp": ["IWGP Heavyweight Championship"],  # includes the 2021- IWGP World Heavyweight title
    "never": ["List of NEVER Openweight Champions"],
    "iwgpJr": ["IWGP Junior Heavyweight Championship"],
    "tripleCrown": ["Triple Crown Heavyweight Championship"],
    "ghc": ["GHC Heavyweight Championship"],
    "stardomChamp": ["World of Stardom Championship"],
    "cmllChamp": ["List of CMLL World Heavyweight Champions"],
    "aaaMega": ["AAA Mega Championship"],
}

# Tournaments: criterion id -> (page whose winners table has Year and Winner columns, first year).
# The first year drops the predecessor tournaments some pages list (the G1 table starts
# with the 1974 World League). Winner names become a criterion; the years feed trivia.
TOURNAMENTS = {
    "g1": ("G1 Climax", 1991),
    "bosj": ("Best of the Super Juniors", 1988),
    "carnival": ("Champion Carnival", 1973),
    "reyDeReyes": ("Rey de Reyes", 1997),
}


class Tables(HTMLParser):
    """Collect wikitables as rows of cells; each cell keeps its text, links, rowspan, colspan."""

    def __init__(self):
        super().__init__()
        self.tables, self.depth, self.cell, self.row = [], 0, None, None
        self.skip = 0  # inside <sup> (footnote markers) or <style>

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "table":
            self.depth += 1
            if self.depth == 1 and "wikitable" in (a.get("class") or ""):
                self.tables.append([])
            elif self.depth == 1:
                self.tables.append(None)
        if self.depth != 1 or not self.tables or self.tables[-1] is None:
            return
        if tag in ("sup", "style"):
            self.skip += 1
        elif tag == "tr":
            self.row = []
            self.tables[-1].append(self.row)
        elif tag in ("td", "th") and self.row is not None:
            self.cell = {"th": tag == "th", "text": "", "links": [], "rowspan": int(re.sub(r"\D", "", a.get("rowspan", "1")) or 1),
                         "colspan": int(re.sub(r"\D", "", a.get("colspan", "1")) or 1)}
            self.row.append(self.cell)
        elif tag == "a" and self.cell is not None and not self.skip:
            title = a.get("title", "")
            if title and ":" not in title and "page does not exist" not in title:
                self.cell["links"].append(title)

    def handle_endtag(self, tag):
        if tag == "table":
            self.depth -= 1
        if self.depth == 1 and self.tables and self.tables[-1] is not None:
            if tag in ("sup", "style") and self.skip:
                self.skip -= 1
            elif tag in ("td", "th"):
                self.cell = None

    def handle_data(self, data):
        if self.cell is not None and not self.skip:
            self.cell["text"] += data


def grid(rows):
    """Expand rowspan/colspan so every row has its cells in true column positions."""
    out, carry = [], {}
    for row in rows:
        line, col, cells = [], 0, iter(row)
        while True:
            if col in carry:
                cell, left = carry[col]
                line.append(cell)
                carry[col] = (cell, left - 1) if left > 1 else None
                if carry[col] is None:
                    del carry[col]
                col += 1
                continue
            cell = next(cells, None)
            if cell is None:
                break
            for _ in range(cell["colspan"]):
                line.append(cell)
                if cell["rowspan"] > 1:
                    carry[col] = (cell, cell["rowspan"] - 1)
                col += 1
        out.append(line)
    return out


def tables(page):
    url = "https://en.wikipedia.org/api/rest_v1/page/html/" + urllib.parse.quote(page.replace(" ", "_"), safe="")
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            html = r.read().decode("utf-8")
    except Exception as e:
        print(f"  ! {page}: {e}")
        return None
    p = Tables()
    p.feed(html)
    return p


def person(cell):
    """(name shown in the cell, the article it links to): the shown name is the ring name
    used that year (Prince Devitt); the article is what matches the person (Finn Bálor)."""
    shown = re.sub(r"\s*\(\d+\)\s*$", "", re.sub(r"\s+", " ", cell["text"])).strip()
    link = re.sub(r"\s*\(.*?\)$", "", cell["links"][0]) if cell["links"] else shown
    return shown, link


def winners(page):
    """[(year, shown name, linked name)] from every table with Year and Winner columns (some pages split them by era)."""
    p = tables(page)
    if p is None:
        return None
    out = set()
    for table in filter(None, p.tables):
        g = grid(table)
        header = next((r for r in g if r and all(c["th"] for c in r)), None)
        if not header:
            continue
        heads = [c["text"].strip().lower() for c in header]
        if "year" not in heads or "winner" not in heads:
            continue
        yi, wi = heads.index("year"), heads.index("winner")
        for r in g:
            if r is header or len(r) <= max(yi, wi) or r[wi]["th"]:
                continue
            year = re.search(r"\b(19|20)\d\d\b", r[yi]["text"])
            shown, link = person(r[wi])
            if year and re.search(r"[A-Za-z]", shown) and not re.search(r"vacat|cancel|not held", shown, re.I):
                out.add((int(year.group()), shown, link))
    return sorted(out)


def champions(page):
    p = tables(page)
    if p is None:
        return None
    names = set()
    for table in filter(None, p.tables):
        g = grid(table)
        header = next((r for r in g if r and all(c["th"] for c in r)), None)
        if not header:
            continue
        cols = [i for i, c in enumerate(header) if re.match(r"\s*Champions?\b", c["text"].strip(), re.I)]
        if not cols:
            continue
        ci = cols[0]
        for r in g:
            if r is header or len(r) <= ci or r[ci]["th"]:
                continue
            cell = r[ci]
            for link in cell["links"]:
                names.add(re.sub(r"\s*\(.*?\)$", "", link))  # "Scott Hall (wrestler)" -> "Scott Hall"
            if not cell["links"]:
                names.add(cell["text"].strip())
    return sorted(n for n in names if n and not re.search(r"vacat|deactivat|retire", n, re.I))


def main():
    out = {}
    for group, pages in PAGES.items():
        names = set()
        for page in pages:
            got = champions(page)
            if got is not None:
                print(f"  {group:16} {len(got):4}  {page}")
                names |= set(got)
            time.sleep(0.5)
        out[group] = sorted(names)
    # "years" isn't a criterion id, so the import's title-list pass skips it
    out["years"] = {}
    for group, (page, since) in TOURNAMENTS.items():
        got = [w for w in winners(page) or [] if w[0] >= since]
        if got:
            print(f"  {group:16} {len(got):4}  {page}")
            out["years"][group] = got
            out[group] = sorted({n for _, shown, link in got for n in (shown, link)})
        time.sleep(0.5)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
