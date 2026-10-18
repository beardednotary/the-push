# Region cards

A Reddit player asked to pick one scene ("lucha only") or "the world".

## Decided (Ray, 2026-10-17)

- No mixed US/Japan/Mexico card ("it'll tank scores"). The main card stays as it is; regions are separate cards.
- Japan Ring shipped at `/ring/japan`: Japanese belts and tournaments plus life facts. No US promotions, no eras, no birthplace. Every square has a Japanese belt or tournament. Own frozen card, board and picks; no belts.
- Mexico and region Daily Fives wait for more data.

The original proposal follows.

## What the data can carry (phase 1, `data/generated/REPORT.md` → "International coverage")

- The Ringside archive is six US promotions. It has no Japanese or Mexican title histories, and its 2025-26 CMLL/NJPW/AAA shows are filed under AEW and dropped by the import.
- New criteria, all from Wikipedia lists: IWGP Heavyweight, NEVER, IWGP Junior, Triple Crown, GHC, World of Stardom, CMLL Heavyweight, AAA Mega, G1 Climax, Best of the Super Juniors, Champion Carnival, Rey de Reyes. They are tagged `scene: jp` / `mx` and are **kept out of today's grid**.
- A champion only counts if the archive already knows them. Japan: 116 people hold a Japan criterion or were born there. Misawa, Kobashi, Kawada, Tsuruta, Makabe, Evil and Mayu Iwatani are missing. Mexico: 69 people.
- Grid check, 365 days, every cell needs 3+ answers:
  - Japan, scene criteria plus born-in-Japan and eras: 365/365.
  - Mexico, scene criteria only: **0/365**. Mexico with US promotions mixed in (AEW, WWE, TNA...): 365/365.
- Trivia: 140 tournament-winner questions (G1 36, Super Juniors 38, Carnival 37, Rey de Reyes 29). Japan has about 110, which is 22 days of a five-question card. Not enough for a Daily Five yet.

## Proposal

1. **Picker**: a plate row above the game: `MAIN · JAPAN · MEXICO`. MAIN is today's card, unchanged, and the default. The choice is remembered on the device.
2. **What ships first**: a Japan Ring only. Mexico waits until a lucha grid builds without US promotions. Region Five waits until a region has 365+ questions (tournaments plus approved community questions from the new `questions` tab).
3. **Before Japan ships**: let Wikipedia/Wikidata people with no archive record into the pool when they hold a scene criterion, so Misawa or Iwatani are accepted answers. The region answer pool is everyone holding a scene criterion. Pop 150+ is the US archive's popularity, and Okada scores 86.
4. **Freezing**: `card:ring:jp:DAY` and later `card:five:jp:DAY`, frozen on first load exactly like `card:ring:DAY`. MAIN keeps its current keys, so nothing migrates. Grid seed `ring:jp:DAY`.
5. **Leaderboards**: `lb:ring:jp:DAY` and so on, one per region. Region results go into the player's career stats, tagged by region.
6. **Belts**: region boards do **not** count toward the belts (the default). One belt per game stays easy to understand, and a thin region board would be easy to farm.
7. **Shipping rule**: a region goes live only once `check-puzzles.ts` shows 365/365 fair grids for it with the real pool. The check already prints this per region.

## Decisions for Ray

- **What does "World" mean?** (a) Keep today's card as MAIN and add separate regions. (b) Make a true World card that mixes US and scene criteria. *Recommend (a).* Today's card is US-heavy, and a mixed card would make US regulars face IWGP cells.
- **Japan Ring first, alone?** Or wait and launch Japan and Mexico together? *Recommend Japan first.*
- **Belts**: confirm region boards stay out of the belts.
- **Pool fix (point 3)**: OK to add people the archive doesn't have, with only list and Wikidata facts?
