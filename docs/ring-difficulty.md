# Immaculate Ring difficulty

Measured 2026-10-19 from production (read-only token), then used to tune the grid builder.
Re-run with `npx tsx scripts/ring-measure.ts` (needs `PROD_KV_REST_API_URL` and
`PROD_KV_REST_API_READ_ONLY_TOKEN` in `.env.local`) and `npx tsx scripts/ring-difficulty.ts`.

"Stars" below means wrestlers with pop >= 500 (223 names). "Well-known" is the old fairness bar, pop >= 150 (642 names).

## What players did

| Day | Ring starts | Finishes | Finish rate | On the board | Avg squares (board) |
|---|---|---|---|---|---|
| 10-16 | - | - | - | - | no frozen card (freezing came later) |
| 10-17 | 25 | 19 | 76% | 11 | 6.0 |
| 10-18 | 20 | 11 | 55% | 5 | 7.4 |
| 10-19 (in progress) | 6 | 5 | - | 3 | 7.3 |

Squares filled by players on the board:

- 10-17: 3:1, 4:1, 5:1, 6:4, 7:3, 9:1
- 10-18: 4:1, 7:1, 8:1, 9:2
- 10-19: 6:1, 7:1, 9:1

Few players post a score with a name, so the board is small. The pick counts (`ring:DAY:picks`) count every correct guess, including from players who never post. So per square, "filled" below is out of the day's Ring starts.

The frozen cards are not what today's generator makes for those days. The data has been re-imported since, so `gridFor` now gives different grids for those days. 10-17 was frozen with five belts, from before the two-belt cap.

### 10-17: IC / Cruiser / WCW-ECW TV x Hardcore / Tag Team / ECW (25 starts)

| Square | Filled | Distinct answers | Well-known / stars that fit |
|---|---|---|---|
| IC x Hardcore | 31 | 12 | 17 / 17 |
| IC x Tag Team | 33 | 15 | 68 / 60 |
| IC x ECW | 28 | 5 | 12 / 9 |
| Cruiser x Hardcore | 19 | 4 | 11 / 8 |
| Cruiser x Tag Team | 24 | 8 | 33 / 22 |
| Cruiser x ECW | 16 | 7 | 15 / 7 |
| TV x Hardcore | **5** | 4 | 11 / 9 |
| TV x Tag Team | 12 | 5 | 40 / 21 |
| TV x ECW | **9** | 4 | 29 / 16 |

### 10-18: Ladder / NXT / IC x Pro Football / Cruiser / AEW (20 starts, the 55% day)

| Square | Filled | Distinct answers | Well-known / stars that fit |
|---|---|---|---|
| Ladder x Pro Football | 13 | 2 | 7 / 6 |
| Ladder x Cruiser | 11 | 4 | 24 / 16 |
| Ladder x AEW | 16 | 6 | 75 / 36 |
| NXT x Pro Football | 11 | 5 | 7 / 4 |
| NXT x Cruiser | **10** | 6 | 22 / 12 |
| NXT x AEW | 15 | 9 | 76 / 32 |
| IC x Pro Football | **7** | 3 | 6 / 4 |
| IC x Cruiser | 12 | 4 | 8 / 8 |
| IC x AEW | 15 | 7 | 21 / 20 |

### 10-19 so far: IC / WCW-ECW TV / AEW PPV Main Event x Ladder / 2000s / Actor (6 starts)

| Square | Filled | Distinct answers | Well-known / stars that fit |
|---|---|---|---|
| IC x Ladder | 6 | 4 | 60 / 58 |
| IC x 2000s | 6 | 5 | 60 / 53 |
| IC x Actor | 6 | 4 | 35 / 29 |
| TV x Ladder | 3 | 2 | 18 / 15 |
| TV x 2000s | 5 | 4 | 48 / 25 |
| TV x Actor | **2** | 2 | 12 / 9 |
| AEW PPV Main x Ladder | 6 | 4 | 24 / 12 |
| AEW PPV Main x 2000s | 7 | 4 | 11 / 11 |
| AEW PPV Main x Actor | 3 | 2 | 6 / 6 |

## Which pairs players fail

- **WCW/ECW TV Champion** is the worst row on both days it ran: 5, 9 and 12 of 25 on 10-17, and 2 and 3 of 6 on 10-19. That's true even where 15 to 25 stars fit. People don't remember who held that belt.
- **Pro Football and Cruiserweight Champion** come next. 10-18 put both on the same card, and both are columns, so every row met two of them. IC x Pro Football (4 stars) was filled by 7 of 20.
- Squares with plenty of stars and a well-known category on both sides (IC x Tag Team, NXT x AEW, Ladder x AEW) are filled by nearly everyone who plays.
- Only 7 squares of data, from about 50 players, so this is a direction, not a fit. Star count alone doesn't predict it: TV x Hardcore had 9 stars and was filled least.

## What changed in the builder (`src/lib/ring.ts`, from 2026-10-21)

Days before 2026-10-21 still use the old builder (`buildMainV1`), so past cards that were never frozen don't change, and neither does a card the nightly fact-check (14:00 UTC, the next day's grid) has already posted. Frozen cards come from Redis as before. From 10-21, `buildMainV2` keeps every old rule (two belts at most, one faction and one place per card, no all-era line, 3 well-known per square). It adds:

1. **Every square needs at least 2 stars** (pop >= 500), not just 3 well-known names.
2. **At most 3 hard squares** (fewer than 5 stars): about one tough row or column, never a whole tough grid.
3. **One wide row and one wide column**: a category with 40+ stars (WWE-sized: WCW, TNA, Actor, IC, U.S., Ladder, NXT...), so everyone gets a few squares.
4. **Narrow categories sit on one side only**, so two narrow ones never meet in a square. Narrow means fewer than 12 stars (a birth state, a small faction), or one of the three below.
5. **At most one of TV Champion, Cruiserweight Champion and Pro Football per card.** These are the categories the data above shows players leave blank.

## Effect

Next 14 days from the cutover (2026-10-21 to 11-03), `scripts/ring-difficulty.ts`:

| | Before | After |
|---|---|---|
| Median well-known answers per square | 13 | 17 |
| Median star answers per square | 10.5 | 13 |
| Squares with under 3 stars | 12 of 126 | 4 of 126 |

A full year from 10-21:

| | Before | After |
|---|---|---|
| Median well-known per square | 12 | 17 |
| Median stars per square | 9 | 12 |
| Squares with under 3 stars | 268 of 3285 | 81 of 3285 (none under 2) |
| Grid failures (`check-puzzles`) | 0 | 0 |
| Categories used | 73 | 65 |
| Place / faction slots | 142 / 54 | 91 / 33 |

The cost is variety. Small states and factions, with 5 to 7 stars each, can't fill three squares with 2+ stars, so they show up rarely now. That is the trade Ray asked for. Loosening `MIN_STARS` or the star bar brings them back.

Examples of grids the old builder would have served, compared with the new builder:

- **10-21 before:** Women's Champion / Hardcore / Actor x Born in Texas / Uses Real Name / Ladder. Women's x Texas had 0 stars, and Hardcore x Texas had 3 well-known and 3 stars.
  **After:** U.S. Champion / '90s / MMA or Boxing x Rumble Winner / AEW / IC. The thinnest square is MMA x AEW, with 3 stars.
- **10-24 before:** IC / ECW / Tag Team x Born in New York / 30-Minute Match / Musician. ECW x Musician had 2 stars.
  **After:** Ladder / Rumble Winner / Musician x Uses Real Name / WCW World Champion / NXT.
- **10-30 before:** Uses Real Name / WCW World Champion / nWo x Rumble Winner / Actor / Cruiser. nWo x Cruiser had 2 stars, and the grid had no wide row.
  **After:** European Champion / Never in NXT / AEW x Wrestling Family / ECW / Uses Real Name.
- 10-20 (still the old builder, already fact-checked) and 10-25 meet the new rules anyway and come out the same either way.
