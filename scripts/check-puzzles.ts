// Sanity-check a year of daily puzzles: every day must build a fair grid and five distinct questions.
//   npx tsx scripts/check-puzzles.ts
import { questionsFor } from "../src/lib/five";
import { gridFor, type Criterion, type Wrestler } from "../src/lib/ring";
import { hashString, mulberry32 } from "../src/lib/rng";
import data from "../data/generated/ring.json";

const ring = data as { criteria: Criterion[]; wrestlers: Wrestler[] };

const start = Date.parse("2026-10-16T12:00:00Z");
const usage = new Map<string, number>();
let minCell = Infinity;
let failures = 0;
const seenQ = new Map<string, number>();

for (let d = 0; d < 365; d++) {
  const day = new Date(start + d * 86_400_000).toISOString().slice(0, 10);
  try {
    const g = gridFor(day);
    [...g.rows, ...g.cols].forEach((c) => usage.set(c.id, (usage.get(c.id) ?? 0) + 1));
    minCell = Math.min(minCell, ...g.answerCounts);
    if (d < 3) console.log(day, "rows:", g.rows.map((c) => c.label).join(" | "), "cols:", g.cols.map((c) => c.label).join(" | "), g.answerCounts.join(","));
  } catch (e) {
    failures++;
    console.log(day, String(e));
  }
  const qs = questionsFor(day);
  if (new Set(qs.map((q) => q.id)).size !== 5) console.log(day, "duplicate question in a day");
  qs.forEach((q) => {
    const last = seenQ.get(q.id);
    if (last !== undefined && d - last < 60) console.log(day, "repeat within 60 days:", q.id);
    seenQ.set(q.id, d);
  });
  if (d < 2) qs.forEach((q) => console.log("  ", q.type, "|", q.prompt));
}
console.log("grid failures:", failures, "| smallest cell:", minCell);
console.log("criteria use over a year:", [...usage].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(" "));

// Region cards (not live yet; see docs/regions.md): could a Japan-only or Mexico-only grid be
// built every day? The answer pool is everyone holding one of the scene's criteria or born
// there, well known or not. "scene" uses only scene criteria, birth and eras; "mixed" also
// lets in US promotions and match types (AEW x IWGP Champion and so on).
const BORN: Record<string, string> = { jp: "bornJP", mx: "bornMX" };
const MIXED = new Set(["wwe", "wcw", "ecw", "tna", "aew", "nxt", "tag", "ladder", "cage", "marathon"]);
for (const scene of ["jp", "mx"]) {
  for (const variant of ["scene", "mixed"]) {
    const crit = ring.criteria.filter((c) => c.scene === scene || c.id === BORN[scene] || c.group === "era" || (variant === "mixed" && MIXED.has(c.id)));
    const ids = new Set(crit.filter((c) => c.scene).map((c) => c.id));
    const pool = ring.wrestlers.filter((w) => w.tags.some((t) => ids.has(t) || t === BORN[scene]));
    const usable = crit.filter((c) => pool.filter((w) => w.tags.includes(c.id)).length >= 8);
    let ok = 0;
    let smallest = Infinity;
    for (let d = 0; d < 365; d++) {
      const rand = mulberry32(hashString(`ring:${scene}:${d}`));
      for (let attempt = 0; attempt < 5000; attempt++) {
        const chosen: (typeof crit)[number][] = [];
        for (let tries = 0; chosen.length < 6 && tries < 200; tries++) {
          const c = usable[Math.floor(rand() * usable.length)];
          if (!chosen.some((x) => x.id === c.id || x.family === c.family)) chosen.push(c);
        }
        if (chosen.length < 6 || chosen.filter((c) => c.scene).length < 2) continue;
        const [rows, cols] = [chosen.slice(0, 3), chosen.slice(3)];
        if (rows.every((c) => c.group === "era") || cols.every((c) => c.group === "era")) continue;
        const counts = rows.flatMap((r) => cols.map((c) => pool.filter((w) => w.tags.includes(r.id) && w.tags.includes(c.id)).length));
        if (counts.every((n) => n >= 3)) {
          ok++;
          smallest = Math.min(smallest, ...counts);
          break;
        }
      }
    }
    console.log(`region ${scene} (${variant}): pool ${pool.length}, usable criteria ${usable.length}, fair grids ${ok}/365`, ok ? `| smallest cell: ${smallest}` : "");
  }
}
