// The review list on /stats: Claude's nightly fact-check flags as proposed tag rows. Accept
// makes the fix live at once (a ring override) and writes the row to the curation sheet, so
// the next data build keeps it; Dismiss just files it away. Wordle clue flags can't be
// turned into one tag, so they're listed for fixing by hand.
import { ringCard } from "./cards";
import { claudeFindings, type Finding } from "./claudecheck";
import { addDays, todayKey } from "./day";
import { addOverride, ringOverrides } from "./disputes";
import { longName } from "./grid";
import { readCsv } from "./factcheck";
import { allCriteria, missing, wrestlerByName, type Criterion } from "./ring";
import { appendTagRows, type TagRow } from "./sheet";
import { store } from "./store";

const DONE = "fixes:done"; // fix key -> "accepted" | "dismissed" | "accepted, sheet: <error>"
const DAYS = 8; // tomorrow's flags and the week before

export interface Fix {
  key: string; // day:grid:index
  day: string; // the card it was found on
  grid: string; // "main", "jp" or "wordle"
  finding: Finding;
  rows: TagRow[]; // what Accept writes; empty when it can't be done automatically
  why?: string; // why there are no rows
  status?: string;
}

const norm = (s: string) => s.replace(/­/g, "").replace(/\s*\(.*\)\s*$/, "").trim().toLowerCase();

/** The category a finding names, by its grid label or full name. */
function criterionNamed(text: string): Criterion | undefined {
  const t = norm(text);
  return allCriteria().find((c) => norm(c.label) === t || norm(longName(c)) === t);
}

async function rowsFor(day: string, grid: string, f: Finding): Promise<Pick<Fix, "rows" | "why">> {
  if (grid === "wordle") return { rows: [], why: "A Wordle clue: fix it by hand" };
  const w = wrestlerByName(f.wrestler.replace(/\s*\(.*\)\s*$/, ""));
  if (!w) return { rows: [], why: `No wrestler called ${f.wrestler} in the data` };
  const note = `${f.explanation} (${f.source}) [Claude fact-check ${day}]`;
  if (f.problem === "wrong") {
    const c = criterionNamed(f.rule);
    if (!c) return { rows: [], why: `No category called "${f.rule}"` };
    return { rows: [[w.name, c.id, "remove", note]] };
  }
  // "should count": add whichever of the square's two categories they lack
  const card = await ringCard(day, grid === "jp" ? "jp" : undefined);
  if (!(f.square >= 1 && f.square <= 9)) return { rows: [], why: `Square ${f.square} isn't on the grid` };
  const lacks = missing(card, f.square - 1, w.id, await ringOverrides());
  if (!lacks.length) return { rows: [], why: `${w.name} already counts for that square` };
  return { rows: lacks.map((c) => [w.name, c.id, "add", note] as TagRow) };
}

/** Every flag from tomorrow's card back a week, newest first, with what Accept would do. */
export async function reviewFixes(): Promise<Fix[]> {
  const done = await store.hashGet(DONE);
  const out: Fix[] = [];
  const tomorrow = addDays(todayKey(), 1);
  for (let i = 0; i < DAYS; i++) {
    const day = addDays(tomorrow, -i);
    for (const grid of ["main", "jp", "wordle"]) {
      const found = await claudeFindings(day, grid);
      if (!Array.isArray(found)) continue;
      for (const [n, f] of found.entries()) {
        const key = `${day}:${grid}:${n}`;
        out.push({ key, day, grid, finding: f, ...(await rowsFor(day, grid, f)), status: done[key] });
      }
    }
  }
  return out;
}

/** Accept: live now, and into the sheet. Returns what happened, for the page. */
export async function acceptFix(key: string): Promise<string> {
  const fix = (await reviewFixes()).find((f) => f.key === key);
  if (!fix || !fix.rows.length || fix.status) return "Nothing to do";
  for (const [name, tag, action] of fix.rows) {
    const w = wrestlerByName(name)!;
    await addOverride(`${action === "remove" ? "-" : ""}${w.id}:${tag}`);
  }
  const sheet = await appendTagRows(fix.rows);
  await store.hashSet(DONE, { [key]: sheet.ok ? "accepted" : `accepted, sheet: ${sheet.error}` });
  return sheet.ok ? "Accepted and added to the sheet" : `Accepted on the site, but the sheet didn't take it (${sheet.error})`;
}

export async function dismissFix(key: string) {
  await store.hashSet(DONE, { [key]: "dismissed" });
}

/** Send every row of the repo's tags.csv to the sheet; rows it already has are skipped. */
export async function syncRepoTags(): Promise<string> {
  const rows = readCsv("data/curation/tags.csv")
    .filter((r) => r.wrestler && r.tag && (r.action === "add" || r.action === "remove"))
    .map((r) => [r.wrestler, r.tag, r.action, r.note ?? ""] as TagRow);
  let added = 0;
  let skipped = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const res = await appendTagRows(rows.slice(i, i + 200));
    if (!res.ok) return `The sheet didn't take them: ${res.error}`;
    added += res.added ?? 0;
    skipped += res.skipped ?? 0;
  }
  return `Sent ${rows.length} rows: ${added} added, ${skipped} already in the sheet`;
}
