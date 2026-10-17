# The Push

Daily wrestling games, one card a day (midnight Eastern):

- **Daily Five**: five multiple-choice questions, 15 seconds each. 100 points for a right answer plus up to 100 for speed.
- **Immaculate Ring**: a 3x3 grid. Name a wrestler who fits each row and column; nine guesses; rarer picks rank higher.

Next.js 15 (App Router) · Upstash Redis for leaderboards · data from the [Ringside Wrestling Archive](https://www.kaggle.com/datasets/theodorerubin/ringside-wrestling-archive) (Kaggle, CC0).

## Run it

```bash
npm install
npm run dev
```

Without Upstash credentials the leaderboards live in memory, which is fine for local dev only. For real use, copy `.env.example` to `.env.local` and fill in the Upstash values.

## Data pipeline

```bash
pip install kagglehub
python scripts/fetch_ringside.py      # downloads ~360 MB into data/raw/ (git-ignored)
python scripts/import_ringside.py     # writes data/generated/{ring,trivia}.json + REPORT.md
npx tsx scripts/check-puzzles.ts      # simulates a year of daily puzzles
```

**Read `data/generated/REPORT.md` after every import.** It lists Rumble winners, WrestleMania main events, gender fixes and a trivia sample, so bad data is easy to spot.

What the import does with the archive:
- Drops the 4,000+ indie shows the 2025-06+ scrape filed under AEW/WWE/NXT; collapses events that are listed twice.
- Merges people split across ids ("Bret Hart (c)", "A.J. Styles" / "AJ Styles").
- Fixes gender (the source marks most women male) from women's titles and singles opponents.
- Derives grid criteria: promotions, title groups, Rumble wins, WrestleMania and AEW PPV main events, Hell in a Cell, cage, ladder, 30-minute matches and decades.
- Generates trivia: Rumble winners, WrestleMania main events and cities, title changes (each one confirmed by its title match), classic PPV matches, and "which promotion ran this PPV".

### Curation (the Google Sheet)

The hand-edited layer on top of the import lives in the Google Sheet **"The Push – curation"**, one tab per file. Edit the sheet, then:

```bash
npm run data      # pull the sheet, re-import, check a year of puzzles
git add -A && git commit -m "Update curation" && git push   # Vercel redeploys
```

`npm run data` downloads the published CSV of each tab (links in `data/curation/sheet.json`) into `data/curation/`, refusing if a tab's columns change. The tabs:

| file | purpose |
|---|---|
| `merges.csv` | one person under several names/ids (Daniel Bryan → Bryan Danielson), plus display names |
| `tags.csv` | facts the dataset lacks or gets wrong: `wrestler,tag,action(add/remove),note` |

The archive has no AEW, NJPW or ROH title histories, so `tags.csv` supplies AEW World Champions.

Each import also writes `data/generated/merge_candidates.csv`: likely renames not yet merged (one name contains the other and the careers barely overlap). Copy the real ones into the `merges` tab.

## Production

- Live at https://playthepush.com (Vercel, auto-deploys `main`). pushwrestling.net and the old the-push-wrestling.vercel.app alias redirect there; `src/middleware.ts` enforces the one address.
- Leaderboards use the Upstash database connected in Vercel's Storage tab. `/api/health` reports `{"store":"upstash","ok":true}` when that is working.

## Known gaps

- No NJPW or ROH events. No Hall of Fame, nWo membership or Money in the Bank winners (MITB can't be derived reliably from the cards); these need `tags.csv` rows before they can be grid criteria.
- AEW cards are thin between late 2024 and early 2026 in the source.
- Daily Five times are measured in the browser. The server re-scores every submission from the raw answers, but a determined cheater could fake times.
- **Licensing:** the archive is CC0, but its own notes say the bulk was scraped from Cagematch.net "for non-commercial use". Facts (who won what) aren't copyrightable; match ratings are only used to *choose* classic matches and are never shown. Get a proper read on this before turning ads on.
