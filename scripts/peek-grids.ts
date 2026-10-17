// Preview upcoming grids that use a given category group, with a few answers per square.
//   npx tsx scripts/peek-grids.ts [group=life] [count=3]
import { addDays, todayKey } from "../src/lib/day";
import { cellAnswers, gridFor } from "../src/lib/ring";

const group = process.argv[2] ?? "life";
const count = Number(process.argv[3] ?? 3);
let shown = 0;
for (let d = 1; d < 120 && shown < count; d++) {
  const day = addDays(todayKey(), d);
  const g = gridFor(day);
  if (![...g.rows, ...g.cols].some((c) => c.group === group)) continue;
  shown++;
  console.log(`\n${day}  rows: ${g.rows.map((c) => c.label).join(" | ")}   cols: ${g.cols.map((c) => c.label).join(" | ")}`);
  for (let cell = 0; cell < 9; cell++) {
    const [r, c] = [g.rows[Math.floor(cell / 3)], g.cols[cell % 3]];
    if (r.group !== group && c.group !== group) continue;
    const answers = cellAnswers(g, cell);
    console.log(`  ${r.label} × ${c.label}: ${answers.length} · ${answers.slice(0, 5).map((w) => w.name).join(", ")}`);
  }
}
