// How hard are the coming Ring grids? Per square: well-known answers (pop >= 150) and star answers.
//   npx tsx scripts/ring-difficulty.ts [days=14] [from=tomorrow] [star=500]
import { addDays, todayKey } from "../src/lib/day";
import { cellAnswers, gridFor } from "../src/lib/ring";

const days = Number(process.argv[2] ?? 14);
const from = process.argv[3] ?? addDays(todayKey(), 1);
const star = Number(process.argv[4] ?? 500);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

const known: number[] = [];
const stars: number[] = [];
let thin = 0;
for (let d = 0; d < days; d++) {
  const day = addDays(from, d);
  const g = gridFor(day);
  console.log(`\n${day}  rows: ${g.rows.map((c) => c.label).join(" | ")}   cols: ${g.cols.map((c) => c.label).join(" | ")}`);
  const line: string[] = [];
  for (let cell = 0; cell < 9; cell++) {
    const answers = cellAnswers(g, cell);
    const k = answers.filter((w) => w.pop >= 150).length;
    const s = answers.filter((w) => w.pop >= star).length;
    known.push(k);
    stars.push(s);
    if (s < 3) thin++;
    line.push(`${k}/${s}`);
  }
  console.log(`  well-known/star per square: ${line.join("  ")}`);
}
console.log(`\n${days} days from ${from}: median well-known per square ${median(known)}, median star (pop >= ${star}) ${median(stars)}, squares with under 3 stars: ${thin} of ${days * 9}`);
