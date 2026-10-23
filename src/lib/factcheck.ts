// Tomorrow's Ring, square by square, for the volunteer fact-checkers' private Discord channel:
// each square's sides, how many answers it has, the best-known ones, and the answers that
// only count because of a guess (fact_check.csv: 1-2 match promotions, Wikidata family or
// real name, factions by name...) or a hand-added tag (tags.csv, accepted disputes).
// Sent by the daily cron to DISCORD_FACTCHECK_WEBHOOK_URL; skipped when that isn't set.
import fs from "node:fs";
import path from "node:path";
import { ringCard } from "./cards";
import { claudeFindings, type Finding } from "./claudecheck";
import { addDays, puzzleNumber, todayKey } from "./day";
import { ringOverrides } from "./disputes";
import { REGIONS, type Region } from "./regions";
import { cellAnswers, cellCriteria, criterion, wrestlerByName, type Criterion, type Grid, type Overrides } from "./ring";
import { store } from "./store";
import { PROMOS, profileLines, wordleAnswer } from "./wordle";

const LIMIT = 2000; // Discord's message limit

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') cell += text[++i];
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") (row.push(cell), (cell = ""));
    else if (ch === "\n") (row.push(cell.replace(/\r$/, "")), rows.push(row), (row = []), (cell = ""));
    else cell += ch;
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows;
}

function readCsv(file: string): Record<string, string>[] {
  try {
    const [head, ...rows] = parseCsv(fs.readFileSync(path.join(process.cwd(), file), "utf8"));
    return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
  } catch {
    return [];
  }
}

const bare = (label: string) => label.replace(/­/g, "");
let byLabel: Map<string, string> | null = null;
function criterionFor(check: string, claim: string): string | undefined {
  byLabel ??= new Map(
    ["wwe", "nxt", "wcw", "ecw", "tna", "aew", "family", "singleName", "realName", "gaijin", "legacy", "cage", "ladder", "nwo", "dx", "horsemen", "judgmentDay", "bulletClub", "elite", "nexus", "ministry", "bornCA", "bornJP", "bornMX", "bornUK"]
      .map((id) => criterion(id))
      .filter((c): c is Criterion => !!c)
      .map((c) => [bare(c.label).toLowerCase(), c.id]),
  );
  if (check === "Promotion") return criterion(claim.replace(/^Wrestled for /, "").toLowerCase())?.id;
  if (check === "Nationality") return byLabel.get(claim.split(",")[0].toLowerCase());
  return byLabel.get(check.toLowerCase());
}

/** "wrestlerId:criterionId" -> where the guess came from (kind) and the evidence for this wrestler. */
interface Guess {
  kind: string;
  detail: string;
}
let guessed: Map<string, Guess> | null = null;
function guesses(): Map<string, Guess> {
  if (guessed) return guessed;
  guessed = new Map();
  for (const r of readCsv("data/generated/fact_check.csv")) {
    const crit = criterionFor(r.check, r.claim);
    const w = wrestlerByName(r.wrestler);
    if (crit && w) guessed.set(`${w.id}:${crit}`, { kind: r.check === "Promotion" ? "few matches" : "guessed", detail: r.evidence });
  }
  for (const r of readCsv("data/curation/tags.csv")) {
    const w = wrestlerByName(r.wrestler);
    if (w && r.action === "add" && criterion(r.tag)) guessed.set(`${w.id}:${r.tag}`, { kind: "added by hand", detail: r.note });
  }
  return guessed;
}

/** Does this answer fit the criterion only through a guess or a hand-added tag? (Claude checks these first.) */
export function isGuess(wrestlerId: number, criterionId: string): boolean {
  return guesses().has(`${wrestlerId}:${criterionId}`);
}

/** Claude's findings for a grid, worst first, as lines for the post. */
function claudeLines(grid: Grid, found: Finding[] | { error: string } | null): string[] {
  if (!found) return [];
  if (!Array.isArray(found)) return [`🤖 Claude's check failed tonight (${found.error.slice(0, 200)}); the squares below are unchecked.`];
  if (!found.length) return ["🤖 Claude checked every square and found nothing to flag."];
  const order = (f: Finding) => (f.confidence === "high" ? 0 : 1) + (f.problem === "wrong" ? 0 : 2);
  return [
    `🤖 **Claude flagged ${found.length}** (it can be wrong too: check the source before changing anything)`,
    ...[...found].sort((a, b) => order(a) - order(b)).map((f) => {
      const cell = f.square - 1;
      const [r, c] = cell >= 0 && cell < 9 ? cellCriteria(grid, cell) : [];
      const where = r && c ? `${bare(r.label)} × ${bare(c.label)}` : `square ${f.square}`;
      const what = f.problem === "wrong" ? `❌ **${f.wrestler}** counts but shouldn't (${f.rule})` : `➕ **${f.wrestler}** should count`;
      return `${what} · ${where}${f.confidence === "medium" ? " · not sure" : ""}: ${f.explanation} <${f.source}>`;
    }),
  ];
}

const MAX_NAMES = 6;

function square(grid: Grid, cell: number, extra: Overrides, known: number): string[] {
  const [r, c] = cellCriteria(grid, cell);
  const all = cellAnswers(grid, cell, extra);
  const lines = [`**${bare(r.label)} × ${bare(c.label)}** · ${all.length} answers (${known} well known)`];
  lines.push(`Top: ${all.slice(0, 5).map((w) => w.name).join(", ") || "none"}`);
  for (const side of [r, c]) {
    // the answers that fit this side only through a guess, best known first
    const hits = all.flatMap((w) => {
      const key = `${w.id}:${side.id}`;
      const g = !w.tags.includes(side.id) && extra.has(key) ? { kind: "accepted dispute", detail: "" } : guesses().get(key);
      return g ? [{ name: w.name, ...g }] : [];
    });
    for (const kind of new Set(hits.map((h) => h.kind))) {
      const group = hits.filter((h) => h.kind === kind);
      // one shared reason (all from Wikidata family links) is said once; otherwise each name gets its own
      const same = group.every((h) => h.detail === group[0].detail);
      const names = group.slice(0, MAX_NAMES).map((h) => (same || !h.detail ? h.name : `${h.name} (${h.detail})`));
      const more = group.length > MAX_NAMES ? ` +${group.length - MAX_NAMES} more` : "";
      const n = group.length === all.length ? "every answer" : `${group.length} of ${all.length}`;
      lines.push(`⚠️ ${bare(side.label)} (${n}, ${same && group[0].detail ? group[0].detail : kind}): ${names.join(", ")}${more}`);
    }
  }
  return lines;
}

/** Tomorrow's main and region cards, as Discord-sized messages. */
export async function factCheckPosts(today = todayKey()): Promise<string[]> {
  const day = addDays(today, 1);
  const extra = await ringOverrides();
  const cards: { title: string; region?: Region }[] = [
    { title: "Main grid" },
    ...(Object.keys(REGIONS) as Region[]).filter((r) => REGIONS[r].live).map((r) => ({ title: `${REGIONS[r].name} grid`, region: r })),
  ];
  const posts: string[] = [];
  for (const { title, region } of cards) {
    let grid: Grid;
    try {
      grid = await ringCard(day, region); // the frozen card if there is one, else the planned grid
    } catch (e) {
      posts.push(`**${title}, No. ${puzzleNumber(day)}**: couldn't build it (${String(e)})`);
      continue;
    }
    const flags = claudeLines(grid, await claudeFindings(day, region ?? "main"));
    const blocks = [
      `🔎 **Tomorrow's ${title}, No. ${puzzleNumber(day)}** (${day}) · flag anything wrong here before it goes live`,
      ...flags, // one block per flag, so a long night splits across messages instead of being cut off
      ...Array.from({ length: 9 }, (_, i) => square(grid, i, extra, grid.answerCounts[i] ?? 0).join("\n")),
    ];
    // pack whole squares into messages under Discord's limit
    let msg = "";
    for (const b of blocks) {
      const piece = b.slice(0, LIMIT);
      if (msg && msg.length + 2 + piece.length > LIMIT) (posts.push(msg), (msg = ""));
      msg = msg ? `${msg}\n\n${piece}` : piece;
    }
    if (msg) posts.push(msg);
  }
  posts.push(await wordlePost(day, extra));
  return posts;
}

const WORDLE_TAGS = [...PROMOS, "d1980s", "d1990s", "d2000s", "d2010s", "d2020s", "wweChamp", "whc", "universal", "wcwChamp", "ecwChamp", "aewChamp", "rumble", "wmMain", "aewPpvMain", "nwo", "dx", "horsemen", "judgmentDay", "bulletClub", "elite", "nexus", "ministry"];

/** Tomorrow's Wrestling Wordle answer and every clue value players will see for it. */
async function wordlePost(day: string, extra: Overrides): Promise<string> {
  try {
    const w = await wordleAnswer(day);
    const lines = [`🕵️ **Tomorrow's Wrestling Wordle, No. ${puzzleNumber(day)}** (${day}): **${w.name}** · check each clue`, ...profileLines(w, day)];
    // clue values that rest on a guess or a hand-added tag
    for (const tag of WORDLE_TAGS) {
      const g = w.tags.includes(tag) ? guesses().get(`${w.id}:${tag}`) : extra.has(`${w.id}:${tag}`) ? { kind: "accepted dispute", detail: "" } : undefined;
      if (g) lines.push(`⚠️ ${bare(criterion(tag)?.label ?? tag)}: ${g.kind}${g.detail ? ` (${g.detail})` : ""}`);
    }
    return lines.join("\n").slice(0, LIMIT);
  } catch (e) {
    return `**Wrestling Wordle, No. ${puzzleNumber(day)}**: couldn't pick it (${String(e)})`;
  }
}

/** Post once per day; force re-sends (manual tests). */
export async function postFactCheck({ force = false } = {}): Promise<{ posted: boolean; reason?: string }> {
  const url = process.env.DISCORD_FACTCHECK_WEBHOOK_URL;
  if (!url) return { posted: false, reason: "DISCORD_FACTCHECK_WEBHOOK_URL not set" };
  const today = todayKey();
  if (!force && !(await store.setOnce(`discord:factcheck:${today}`, "1"))) return { posted: false, reason: "already posted today" };
  for (const content of await factCheckPosts(today)) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, username: "The Push fact-check", allowed_mentions: { parse: [] }, flags: 4 }), // 4: no link embeds
    });
    if (!res.ok) return { posted: false, reason: `Discord said ${res.status}` };
  }
  return { posted: true };
}
