# Data independence from CAGEMATCH

CAGEMATCH's owner allows The Push to use its match data for non-commercial use, and may
withdraw that if ads make the site commercial. Most of the live data comes through the
Ringside Wrestling Archive (Kaggle), which is compiled from CAGEMATCH. This note covers
three things. Section 1 shows what each Ring criterion and trivia type depends on. Section 2
shows what a build without the archive looks like (`--no-cagematch`). Section 3 lists what
switching would involve. Nothing in production has changed source: the live build still
uses the archive, and now also takes stipulations from Wikipedia (section 4).

## Sources

| source | what it gives | terms |
|---|---|---|
| Ringside archive (`data/raw/ringside`, `fetch_ringside.py`) | every match: participants, results, event, match type and stipulation, duration, rating, title reigns, ring-name aliases, gender | compiled from CAGEMATCH: **non-commercial only** |
| Wikipedia title lists (`fetch_titles.py`) | champion lists, tournament winners | facts; text is CC BY-SA |
| Wikipedia faction pages (`fetch_factions.py`) | faction members | facts; text is CC BY-SA |
| Wikipedia PPV and TV special articles (`fetch_ppv_results.py`, new) | every match on 1,358 WWE/NXT/WCW/ECW/TNA/AEW cards from 1984 to now: participants, winner, finish (DQ or count-out), stipulation, title, time, event, date, city | facts; text is CC BY-SA |
| Wikidata (`fetch_wikidata.py`) | birthplace, citizenship, birth state, real name, occupations, sports teams, family, Olympics, employer, sex | CC0 |
| Curation (`data/curation/*`, Ray's sheet) | merges, tag fixes, Wikidata pins, community questions; `covers.csv` (from Wikipedia's WWE 2K article) | ours |

Some Wikipedia event articles cite CAGEMATCH as a reference. What we take from them is
results, which are facts rather than CAGEMATCH's expression, and the build never reads
CAGEMATCH itself. Whether that is enough is Ray's call. It isn't legal advice.

## 1. Audit: what each criterion and trivia type depends on

**The identity layer depends entirely on the archive in the live build.** That layer is the
list of people, their ids, display names, aka lists, gender, and `pop` (popularity: 3 × PPV
matches + 1 × any match). `pop` decides who is "well known", which decides which criteria the
grid can use. Wikidata facts reach people only by matching names against the archive. So
even the Wikidata-only criteria depend on the archive today, because the archive decides who
exists.

Counts are `pool (well known)`, from `data/generated/ring.json` (live) and
`data/generated/no-cagematch/ring.json`. The grid needs 8+ well-known names for a criterion.

| criterion | live source | no-cagematch source | live | no-cagematch |
|---|---|---|---|---|
| wwe | archive matches (3+, or 1 on WWE TV/PPV) | PPV/special cards + Wikidata employer | 1393 (553) | 714 (452) |
| nxt | archive matches | NXT-brand cards (TakeOver, specials) + Wikidata | 526 (279) | 282 (177) |
| wcw | archive matches | WCW cards (PPV, Clash) + Wikidata | 374 (150) | 303 (168) |
| ecw | archive matches | ECW cards (PPV, supercards) + Wikidata | 204 (89) | 180 (112) |
| tna | archive matches | TNA cards + Wikidata | 335 (168) | 450 (272) |
| aew | archive matches | AEW cards (PPV, TV specials) + Wikidata | 362 (139) | 251 (143) |
| wweChamp | archive reigns ∪ Wikipedia list | Wikipedia list | 62 (54) | 57 (49) |
| whc | archive reigns ∪ Wikipedia list | Wikipedia list | 35 (35) | 31 (31) |
| universal | archive reigns ∪ Wikipedia list | Wikipedia list | 9 (9) | 9 (9) |
| wcwChamp | archive reigns ∪ Wikipedia list | Wikipedia list | 22 (20) | 22 (20) |
| ecwChamp | archive reigns ∪ Wikipedia list | Wikipedia list | 35 (31) | 32 (29) |
| aewChamp | Wikipedia list | Wikipedia list | 11 (10) | 11 (11) |
| ic | archive reigns ∪ Wikipedia list | Wikipedia list | 99 (95) | 95 (90) |
| us | archive reigns ∪ Wikipedia list | Wikipedia list | 108 (92) | 109 (98) |
| tv | archive reigns ∪ Wikipedia lists | Wikipedia lists | 77 (56) | 76 (57) |
| cruiser | archive reigns ∪ Wikipedia lists | Wikipedia lists | 74 (56) | 72 (50) |
| hardcore | archive reigns ∪ Wikipedia lists | Wikipedia lists | 68 (57) | 64 (52) |
| european | archive reigns ∪ Wikipedia list | Wikipedia list | 28 (28) | 27 (27) |
| nxtChamp | archive reigns ∪ Wikipedia list | Wikipedia list | 29 (24) | 29 (29) |
| twentyFourSeven | archive reigns ∪ Wikipedia list | Wikipedia list | 61 (35) | 43 (28) |
| tag | archive reigns ∪ Wikipedia lists | Wikipedia lists | 443 (328) | 395 (306) |
| womens | archive reigns ∪ Wikipedia lists | Wikipedia lists | 88 (57) | 75 (55) |
| rumble | archive cards | Wikipedia Royal Rumble cards | 35 (33) | 34 (33) |
| wmMain | archive cards | Wikipedia WrestleMania cards | 41 (41) | 49 (48) |
| aewPpvMain | archive cards | Wikipedia AEW PPV cards | 34 (30) | 39 (34) |
| hiac | archive stipulations + **Wikipedia PPV (new)** | Wikipedia PPV stipulations | 53 (50) | 50 (49) |
| cage | archive stipulations + **Wikipedia PPV (new)** | Wikipedia PPV stipulations | 468 (322) | 282 (229) |
| ladder | archive stipulations + **Wikipedia PPV (new)** | Wikipedia PPV stipulations | 340 (267) | 301 (254) |
| marathon | archive durations (any show) | Wikipedia PPV times | 66 (50) | 107 (103) |
| d1980s | archive (3+ matches in the decade) | PPV cards (2+ in the decade) | 241 (69) | 155 (87) |
| d1990s | archive | PPV cards | 671 (238) | 427 (242) |
| d2000s | archive | PPV cards | 560 (307) | 329 (234) |
| d2010s | archive | PPV cards | 611 (390) | 463 (325) |
| d2020s | archive | PPV cards | 672 (292) | 519 (306) |
| actor, music, combat, amateur, olympian, profootball, college, strength | Wikidata (matched to archive people by name) | Wikidata (by item) | 198 (113), 22 (15), 62 (27), 121 (32), 16 (4), 35 (20), 51 (33), 21 (12) | 206 (118), 23 (13), 58 (24), 117 (35), 14 (4), 32 (23), 47 (29), 19 (10) |
| bornCA, bornJP, bornMX, bornUK, bornAbroad | Wikidata | Wikidata | 93 (45), 136 (15), 69 (15), 66 (22), 477 (151) | 92 (53), 160 (16), 88 (16), 69 (28), 502 (160) |
| state* (14 live, 17 no-cm) | Wikidata | Wikidata | e.g. CA 68 (42), NY 83 (46), TX 51 (21) | CA 69 (47), NY 84 (45), TX 51 (28); MD, VA, WA reach 8 |
| family | Wikidata | Wikidata | 181 (93) | 174 (104) |
| singleName | archive display name | most-used card name | 353 (136) | 258 (126) |
| realName | archive display + Wikidata birth name | card name + Wikidata | 121 (63) | 104 (65) |
| neverNxt | archive (WWE 2012+ without NXT) | cards | 149 (79) | 128 (94) |
| aewWwe | archive | cards + Wikidata | 131 (90) | 87 (73) |
| wweToAew / aewToWwe | archive first dates | first card dates | dropped (aewToWwe had 3) | 70 (59) / 11 (9) |
| cover | curation (`covers.csv`, from Wikipedia) | same | 31 (29) | 31 (30) |
| factions (nwo, dx, horsemen, judgmentDay, bulletClub, elite, nexus, ministry) | Wikipedia | Wikipedia | 43 (31), 11 (9), 19 (15), 10 (10), 34 (20), 14 (11), 13 (12), 8 (8) | 43 (32), 11 (8), 18 (17), 10 (10), 43 (22), 13 (9), 12 (10), dropped |
| Japan/Mexico belts and tournaments (iwgpChamp ... reyDeReyes) | Wikipedia + Wikidata | same | e.g. iwgpChamp 40 (8), cmllChamp 18 (6) | iwgpChamp 40 (13), cmllChamp 19 (4) |
| gaijin, legacy | Wikidata + Wikipedia + names | same | 40 (17), 15 (4) | 46 (25), 23 (6) |

Trivia (Daily Five; five buckets a day, two of them "classic"):

| type | live source | no-cagematch source | live | no-cm |
|---|---|---|---|---|
| rumble | archive | Wikipedia Royal Rumble cards | 45 | 45 |
| wmMain | archive | Wikipedia WrestleMania cards | 33 | 37 |
| wmCity | archive event city | Wikipedia infobox city | 39 | 42 |
| lineage | archive reigns + title matches | Wikipedia title matches ("(c)" lost, not by DQ or count-out) | 255 | 260 |
| classic | archive, **CAGEMATCH ratings** (top-rated PPV singles) | Wikipedia PPV singles between established names, main events and title matches first | 407 | 568 |
| promotion | archive events | Wikipedia event articles | 91 | 89 |
| tourney | Wikipedia | Wikipedia | 140 | 140 |
| community | curation | curation | 0 | 0 |

Summary: the title, faction, cover, Wikidata and scene criteria already have independent
sources, and need the archive only to know who exists. The criteria that come purely from
match history are promotions, eras, Rumble, main events, match types and the crossovers. The
same goes for the trivia types other than tourney and community. The "classic" questions use
CAGEMATCH's match ratings directly, which nothing else replaces.

## 2. The `--no-cagematch` build

```bash
python scripts/fetch_ppv_results.py
```

```bash
python scripts/fetch_wikidata.py --extra
```

```bash
python scripts/fetch_wikidata.py --cards
```

```bash
python scripts/import_ringside.py --no-cagematch
```

The first fetch takes a few minutes; its requests are cached in `data/raw/ppv_cache`.
`--extra` adds employer, team and sex to `wikidata.json`. `--cards` fetches people on the
cards whom Wikidata doesn't tag as wrestlers (The Rock, Big Show, Rey Mysterio). The import
(`scripts/import_open.py`) writes `data/generated/no-cagematch/{ring.json,trivia.json,REPORT.md}`
and never touches the live files. Its REPORT has the full side-by-side counts.

How it works:
- **People** are Wikidata items: everyone on a Wikipedia card (resolved through the
  article's Wikidata id; team items expand to their members), plus anyone the title,
  faction and cover lists name. Ids are 1e9 + the Q number.
- **Promotion membership** comes from one appearance on that promotion's PPV or TV special
  card, plus Wikidata employer (P108) or member of sports team (P54). Wikidata adds little:
  only about 420 wrestlers have either property, and it added 37 tags in total.
- **pop** is 12 per card appearance. That gives 615 well-known names, against 642 in the
  live build.
- **Gender** is Wikidata sex (P21), falling back to holding a women's title.
- Curation (merges, tags, covers, questions) applies as in the live build.

**Grid check with the no-cagematch files copied over the live ones: 0 failures over 365
days, smallest cell 3. The Japan region also has 0 failures. Mexico was already at 365
failures, since that region isn't live yet. No question repeats within 60 days.** To repeat it:

```bash
cp data/generated/no-cagematch/ring.json data/generated/no-cagematch/trivia.json data/generated/
```

```bash
npx tsx scripts/check-puzzles.ts
```

```bash
git checkout data/generated/ring.json data/generated/trivia.json
```

What changes in that mode:
- **The pool shrinks from 2,031 to 1,359**, and the well-known group from 642 to 615. The
  people who drop out are wrestlers seen only on weekly TV. That is why wwe drops to
  714 (452) and nxt to 282 (177): weekly NXT isn't covered.
- **TNA and ECW grow** (tna 168 → 272 well known), because a PPV appearance is now worth more
  `pop` than a run of TV matches.
- **cage drops** (322 → 229 well known): cage matches on Nitro, Raw and house shows are gone.
  **marathon grows** (50 → 103), since Wikipedia lists times for every PPV match.
- **Eras use 2+ PPV/special matches in the decade**, where the live build uses 3+ of any match.
  The well-known counts come out close (d1990s 238 → 242), but the detail text ("3+ recorded
  major-promotion matches") would need rewording.
- **Factions:** ministry falls to 7 well-known names and drops; MD, VA, WA and wweToAew /
  aewToWwe cross the 8-name line.
- **Trivia:** the "classic" pool no longer means "best-rated". It means a PPV singles match
  between two well-established names, with main events and title matches first. Rumble,
  WrestleMania, lineage and promotion questions are the same kinds from Wikipedia.
- **Dates:** 65 tables have no date (some nights inside multi-show articles), so their
  matches count for promotions and stipulations but not for eras or first-promotion dates.

## 3. If Ray wants to switch

1. **Wrestler ids change.** Redis pick counts (`ring:DAY:picks`) store archive ids, so past
   days' "most picked" would show "Unknown". To fix that, write an archive-id → Q-id map from
   the live build's Wikidata matches and translate the old keys once, or have `getWrestler`
   look up through the map.
2. **The trivia bank changes**, so the Daily Five for past, unfrozen days changes too. The
   lineage question ids also differ.
3. **Copy needs changing:** the era detail text, and the footer credit (CAGEMATCH → Wikipedia
   and Wikidata).
4. **What it misses:** weekly TV, so nxt and cage are thinner; people who appear only on TV;
   and unlinked names on cards (57 names have no Wikidata item).

## 4. Already live: stipulations from Wikipedia

The live build now also reads `data/raw/ppv_results.json` (`add_ppv_stipulations` in
`import_ringside.py`). Any ladder, cage or Hell in a Cell stipulation there adds the tag to
its participants. Participants are matched by Wikidata id first, then by a name that points
to one person; team articles are expanded the same way. Name-matched additions go to
`fact_check.csv`.

- Added: **ladder +123, cage +72, hiac +4 people in the pool** (ladder 217 → 340, cage
  396 → 468, hiac 49 → 53). Before pool filtering that's 140 / 103 / 5 tags.
- Example: **Armageddon 2006's** fatal four-way ladder match for the WWE Tag Team titles,
  which the archive lists as a plain tag match. Paul London, Brian Kendrick, Joey Mercury,
  Johnny Nitro and the Hardys all have ladder now. So do TNA Lockdown's Six Sides of Steel
  matches, early Money in the Bank entrants, The Rock's Breakdown 1998 cage match and his
  Armageddon 2000 Hell in a Cell.
- Grid check: 0 failures, smallest cell 3. Trivia is unchanged.
