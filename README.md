# The Push

Daily wrestling games, one card a day (midnight Eastern):

- **Daily Five**: five multiple-choice questions, 15 seconds each. 100 points for a right answer plus up to 100 for speed.
- **Immaculate Ring**: a 3x3 grid. Name a wrestler who fits each row and column; nine guesses; rarer picks rank higher.
- **Immaculate Ring Japan** (`/ring/japan`): its own nightly grid built only from Japanese belts and tournaments (plus MMA, amateur and acting facts), with its own leaderboard. It never counts toward the belts.

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
python scripts/fetch_wikidata.py      # life outside the ring (acting, sports, birthplace) into data/raw/ (git-ignored)
python scripts/fetch_titles.py        # Wikipedia champion and tournament-winner lists (US, Japan, Mexico)
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
- Japan and Mexico: IWGP, NEVER, IWGP Junior, Triple Crown, GHC, World of Stardom, CMLL and AAA Mega champions, plus G1 Climax, Best of the Super Juniors, Champion Carnival and Rey de Reyes winners (Wikipedia). These criteria carry a `scene` (`jp` / `mx`) and never enter the main grid. The `jp` ones build the Japan Ring (`gridFor(day, "jp")`, frozen at `card:ring:jp:DAY`, board `lb:ring:jp:DAY`, picks `ring:jp:DAY:picks`). Mexico can't fill a grid without US promotions yet, and tournament-winner trivia (type `tourney`) isn't in any Daily Five yet (`docs/regions.md`).
- Champions on those lists whom the archive has never heard of (Misawa, Kobashi, Mayu Iwatani) join the pool from Wikipedia, with Wikidata's aliases and facts when Wikidata knows them. Their ids start at 1,000,000,000 (Wikidata number) or 3,000,000,000 (name hash). If one is really an archive person under another name, add a `merges` row (`The Great Muta` ← `Keiji Muto`).
- Derived categories: **Gaijin** (Japan): holds a Japanese belt or tournament and has no Japanese citizenship on Wikidata (or, with no citizenship listed, was born outside Japan). **Lucha Legacy** (Mexico): a lucha wrestler (Mexican belt or born in Mexico) whose name or alias starts El Hijo de / del or La Hija de, or ends in Jr. or II–V; inherited masks the pattern misses go in `tags` (`Rey Mysterio,legacy,add`). **Wrestling Family** (all grids): Wikidata lists a parent, child or sibling who was also a pro wrestler. The report lists everyone in each one under REVIEW.
- Mexico (`mx` in `src/lib/regions.ts`) is checked every import but not live. It goes live (`live: true`) once `check-puzzles.ts` shows 0 Mexico grid failures. The report's "International coverage" section shows how thin the archive is outside the US.

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
| `questions.csv` | community trivia. The sheet tab has `prompt`, `answer`, `3 wrong options` (one cell, split by `;`, `|`, `/`, new lines or commas), `source URL`, `region` (`world`, `us`, `jp`, `mx`) and `approved`; columns are found by name. A row is used only once `approved` is `yes` (or `y`, `x`, `true`, `1`), and the report lists rejected rows and why. Approved questions are in the bank but not yet in any Daily Five. |

The archive has no AEW, NJPW or ROH title histories, so `tags.csv` supplies AEW World Champions.

`wikidata.csv` pins people Wikidata lists under another name (The Rock is "Dwayne Johnson") or not as a wrestler at all (Mark Henry). Name matches only count when a name points to exactly one person on each side; `data/generated/wikidata_review.csv` lists every tag Wikidata supplied, for spotting mistakes (fix them with `remove` rows in `tags.csv`, which always wins).

Each import also writes `data/generated/merge_candidates.csv`: likely renames not yet merged (one name contains the other and the careers barely overlap). Copy the real ones into the `merges` tab.

## Production

- Live at https://playthepush.com (Vercel, auto-deploys `main`). pushwrestling.net and the old the-push-wrestling.vercel.app alias redirect there; `src/middleware.ts` enforces the one address.
- Leaderboards use the Upstash database connected in Vercel's Storage tab. `/api/health` reports `{"store":"upstash","ok":true}` when that is working.
- **Environment variables (Vercel, Production + Preview).** Local copies of the secrets live only in the git-ignored `.env.local`.

  | variable | for |
  |---|---|
  | `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash (added by the Vercel integration) |
  | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | daily push reminders |
  | `CRON_SECRET` | protects `/api/cron/remind` (Vercel Cron, 14:00 UTC; `?force=1` for a manual test send) |
  | `AUTH_SECRET` | sign-in sessions |
  | `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET` | Discord sign-in (app "The Push", redirect `/api/auth/callback/discord`) |
  | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google sign-in (Google Cloud project "The Push", redirect `/api/auth/callback/google`) |
  | `AUTH_RESEND_KEY` | email-link sign-in from signin@playthepush.com (domain verified in Resend) |

  Each sign-in provider switches on only when its keys exist. Adding a `NEXT_PUBLIC_*` value needs a redeploy.
- Vercel Web Analytics (cookie-free) is on; `sitemap.xml` and `robots.txt` are generated by the app for Search Console.
- Art: `python scripts/make_art.py` rebuilds the share banner, icons, hero and share-card backdrop from `art/walkout.webp`.

## Known gaps

- No NJPW, AJPW, NOAH, Stardom, CMLL, AAA or ROH events. The 2025-06+ scrape has 2025-26 shows named after them, filed under AEW; the CMLL, NJPW and AAA cards look like real rosters, the Stardom ones are AEW names, and the import drops them all with the other off-brand shows. Japanese and Mexican stars only reach the pool through the Wikipedia title lists, and only if the archive knows them. No Hall of Fame, nWo membership or Money in the Bank winners (MITB can't be derived reliably from the cards); these need `tags.csv` rows before they can be grid criteria.
- AEW cards are thin between late 2024 and early 2026 in the source.
- Daily Five times are measured in the browser. The server re-scores every submission from the raw answers, but a determined cheater could fake times.
- **Licensing:** the archive is CC0, but its own notes say the bulk was scraped from Cagematch.net "for non-commercial use". Facts (who won what) aren't copyrightable; match ratings are only used to *choose* classic matches and are never shown. Get a proper read on this before turning ads on.
