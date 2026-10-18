// Sanity-check a year of daily puzzles: every day must build a fair grid and five distinct questions.
//   npx tsx scripts/check-puzzles.ts
import { questionsFor } from "../src/lib/five";
import { gridFor, REGIONS, type Region } from "../src/lib/ring";

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

// Region cards: every day must build a fair grid for each region too.
for (const region of Object.keys(REGIONS) as Region[]) {
  const use = new Map<string, number>();
  let fails = 0;
  let smallest = Infinity;
  for (let d = 0; d < 365; d++) {
    const day = new Date(start + d * 86_400_000).toISOString().slice(0, 10);
    try {
      const g = gridFor(day, region);
      [...g.rows, ...g.cols].forEach((c) => use.set(c.id, (use.get(c.id) ?? 0) + 1));
      smallest = Math.min(smallest, ...g.answerCounts);
      if (d < 3) console.log(region, day, "rows:", g.rows.map((c) => c.label).join(" | "), "cols:", g.cols.map((c) => c.label).join(" | "), g.answerCounts.join(","));
    } catch (e) {
      fails++;
      console.log(region, day, String(e));
    }
  }
  console.log(`region ${region} grid failures:`, fails, "| smallest cell:", smallest);
  console.log(`region ${region} criteria use:`, [...use].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(" "));
}
