"""Members of famous factions, from their Wikipedia articles.

    python scripts/fetch_factions.py      # writes data/raw/factions.json (git-ignored)

Reads the article's wikitext: the infobox's leader / members / former members fields,
and under any "Members" heading the first link of each list line or table row plus the
bars of a members timeline. A "List of ... members" article is read too when the page
links one (the nWo keeps its roster there). The import matches each name to one person
in the pool and drops the rest (managers, events, other stables).
"""
import json
import pathlib
import re
import time
import urllib.parse
import urllib.request

OUT = pathlib.Path(__file__).resolve().parent.parent / "data/raw/factions.json"
UA = "ThePushDataBot/1.0 (https://playthepush.com; ray@dahvio.com)"

# Ring criterion id -> Wikipedia article
PAGES = {
    "nwo": "New World Order (professional wrestling)",
    "dx": "D-Generation X",
    "horsemen": "The Four Horsemen (professional wrestling)",
    "evolution": "Evolution (professional wrestling)",
    "shield": "The Shield (professional wrestling)",
    "judgmentDay": "The Judgment Day (professional wrestling)",
    "bulletClub": "Bullet Club",
    "elite": "The Elite (professional wrestling)",
    "innerCircle": "The Inner Circle (professional wrestling)",
    "hartFoundation": "The Hart Foundation",  # the 1985 team and the 1997 stable, not the later teams
    "nexus": "The Nexus (professional wrestling)",
    "wyatt": "The Wyatt Family",
    "bloodline": "The Bloodline (professional wrestling)",
    "ministry": "Ministry of Darkness",
    "undisputedEra": "The Undisputed Era",
    "lij": "Los Ingobernables de Japón",
}
INFOBOX_FIELDS = r"(former_|current_|original_)?(members?|leaders?|leadership)\d*"
SECTION = r"members|roster|membership"
# pages with one infobox per incarnation: only the ones under these headings
INCARNATIONS = {"hartFoundation": r"^The Hart Foundation"}
SKIP_WORDS = {"the", "of", "de", "professional", "wrestling"}


def wikitext(page):
    for _ in range(3):  # follow redirects
        url = "https://en.wikipedia.org/w/index.php?" + urllib.parse.urlencode({"title": page, "action": "raw"})
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                text = r.read().decode("utf-8")
        except Exception as e:
            print(f"  ! {page}: {e}")
            return None, page
        m = re.match(r"\s*#REDIRECT\s*\[\[([^\]|#]+)", text, re.I)
        if not m:
            return text, page
        page = m.group(1)
    return None, page


def clean(text):
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    text = re.sub(r"<ref[^>/]*/>", "", text)
    text = re.sub(r"<ref[^>]*>.*?</ref>", "", text, flags=re.S)
    # {{sortname|AJ|Styles}} -> [[AJ Styles]]; {{sortname|Adam|Page|Adam Page}} links its third field
    def sortname(m):
        parts = [p.strip() for p in m.group(1).split("|") if "=" not in p]
        shown = " ".join(parts[:2])
        return f"[[{parts[2]}|{shown}]]" if len(parts) > 2 and parts[2] else f"[[{shown}]]"
    return re.sub(r"\{\{\s*sortname\s*\|([^{}]*)\}\}", sortname, text, flags=re.I)


def plain(text):
    """Visible text of a wikitext snippet, roughly: link labels kept, templates dropped."""
    text = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", text)
    return re.sub(r"\{\{[^{}]*\}\}|'''?", "", text).strip()


def links(text):
    """[(article, shown)] for every [[link]]; skips files and categories."""
    out = []
    for target, shown in re.findall(r"\[\[([^\]|]+)(?:\|([^\]]*))?\]\]", text):
        target = target.split("#")[0].strip()
        if not target or ":" in target:
            continue
        article = re.sub(r"\s*\(.*?\)$", "", target)  # "Edge (wrestler)" -> "Edge"
        out.append((article, (shown or article).strip()))
    return out


def infoboxes(text, heading=None):
    """Leader and member fields of every infobox (some pages have one per incarnation),
    or only those under a level-2 heading matching `heading`."""
    out, section = [], ""
    for part in re.split(r"(?m)^==([^=].*?)==\s*$", text):
        if heading is None or re.search(heading, section):
            for start in re.finditer(r"\{\{\s*Infobox", part, re.I):
                out.append(infobox(part, start.end()))
        section = part.strip()
    return "\n".join(out)


def infobox(text, i):
    """Text of one infobox's leader and member fields; its body starts at text[i]."""
    # split the body at its top-level "|", stopping at its closing braces
    fields, cur, depth = [], "", 1
    while i < len(text) and depth:
        two = text[i:i + 2]
        if two in ("{{", "[["):
            depth += 1
            cur += two
            i += 2
        elif two in ("}}", "]]"):
            depth -= 1
            cur += two if depth else ""
            i += 2
        elif text[i] == "|" and depth == 1:
            fields.append(cur)
            cur = ""
            i += 1
        else:
            cur += text[i]
            i += 1
    fields.append(cur)
    keep = [f.split("=", 1)[1] for f in fields if "=" in f and re.fullmatch(INFOBOX_FIELDS, f.split("=", 1)[0].strip(), re.I)]
    return "\n".join(keep)


def member_sections(text):
    """[(article, shown)] under any heading that names members (sub-headings included):
    the first link of each list line or table row, and the bars of a members timeline."""
    out, rows, level = [], [], None
    for line in text.splitlines():
        h = re.match(r"^(=+)\s*(.*?)\s*=+\s*$", line)
        if h:
            depth = len(h.group(1))
            if level is not None and depth <= level:
                level = None
            if level is None and re.search(SECTION, h.group(2), re.I) and not re.search(r"championship|accomplish", h.group(2), re.I):
                level = depth
            continue
        if level is None:
            continue
        bar = re.match(r'^\s*bar:\S+\s+text:"([^"]+)"', line)
        if bar:  # timeline bars: "Giant/Big Show", "Syxx/X-Pac"
            out += [(n.strip(), n.strip()) for n in bar.group(1).split("/")]
        elif re.match(r"^\s*[*#]", line):
            out += links(line)[:1]
        elif re.match(r"^\s*\|-", line):
            rows.append("")
        elif re.match(r"^\s*[|!]", line) and not re.match(r"^\s*\|\}", line):
            if not rows:
                rows.append("")
            rows[-1] += line + "\n"
    for row in rows:  # tables: the first short cell with a link is the name (notes cells are prose)
        for line in row.splitlines():
            for cell in re.split(r"\|\||!!", re.sub(r"^\s*[|!]", "", line)):
                if links(cell) and len(plain(cell)) <= 60:
                    out += links(cell)[:1]
                    break
            else:
                continue
            break
    return out


def members(page, heading=None):
    text, page = wikitext(page)
    if text is None:
        return page, []
    text = clean(text)
    got = links(infoboxes(text, heading)) + member_sections(text)
    # a roster article linked from the page that shares a word with it
    # ("List of New World Order members"; never another stable's list)
    words = set(re.findall(r"\w+", page.lower())) - SKIP_WORDS
    lists = set(re.findall(r"\[\[(List of [^\]|#]*members[^\]|#]*)", text, re.I))
    lists |= set(re.findall(r"\{\{\s*(?:main|see also|further)\s*\|\s*(List of [^}|]*members[^}|]*)", text, re.I))
    for lst in sorted(l for l in lists if words & set(re.findall(r"\w+", l.lower()))):
        sub, _ = wikitext(lst)
        if sub:
            got += member_sections("== Members ==\n" + clean(sub))
            print(f"    + {lst}")
        time.sleep(0.5)
    seen, uniq = set(), []
    for article, shown in got:
        if article not in seen:
            seen.add(article)
            uniq.append([article, shown])
    return page, uniq


def main():
    out = {}
    for fid, page in PAGES.items():
        resolved, got = members(page, INCARNATIONS.get(fid))
        print(f"  {fid:16} {len(got):4}  {resolved}")
        out[fid] = {"page": resolved, "members": got}
        time.sleep(0.5)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
