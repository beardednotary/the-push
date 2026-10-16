# The Push: design language — "Broadcast"

The site is a Monday-night wrestling TV broadcast. Every screen is a graphics package: the score bug in the corner, lower-thirds for answers, and a red ticker crawling along the bottom. Chosen 2026-10-16 from four directions (see `docs/directions.html`) over Newsstand, Arcade and Gig poster.

## Materials
- **Studio black** (`--ink`): the screen itself, with faint diagonal scan rules and a navy key light from above. Always dark; TV doesn't have a light mode.
- **Plates**: every label, button and header is a parallelogram, skewed -14deg (`.plate`). Text inside is counter-skewed so it reads straight.
- **Chrome type**: headlines are Teko uppercase with a white-to-steel vertical gradient, like extruded broadcast lettering.
- **Lower-thirds**: answer choices and list rows are bars skewed -10deg with a 5px steel left edge that turns gold when selected.
- **Score bug**: top-left lockup of THE PUSH (white plate), LIVE (red plate) and a context plate (issue number or game clock in gold).
- **Ticker**: a red crawl pinned to the bottom of every page with a black TONIGHT tag.

## Color, with one job each
- `--gold` #ffd400: the clock, kickers, the selected edge, scores. It means "now" or "yours".
- `--red` #e8112d: LIVE, the ticker, wrong answers, PINNED.
- `--green` #22d17a: right answers only.
- `--steel` #3b4a6b and `--plate` #1a1d24: neutral structure.
No other hues.

## Type
- **Teko** 500-700: headlines, numbers, the clock. Always uppercase.
- **Saira Condensed** 500-800: everything else. Uppercase for labels and buttons; sentence case for question text is fine.

## Motion
- Plates wipe in from the left (`clip-path` reveal, 280ms) when a question appears.
- The last three seconds are a big chrome **3, 2, 1**; time-out drops a red **PINNED** plate.

## Don'ts
No rounded cards, no soft drop shadows, no pill buttons, no cream. If something looks like a generic web app, put it on a plate.
