// How players did on past Ring cards, read from production with a read-only token.
// Needs PROD_KV_REST_API_URL and PROD_KV_REST_API_READ_ONLY_TOKEN in .env.local (never KV_REST_API_*,
// so the app's own store can't point at production by accident). Reads only; writes nothing.
//   npx tsx scripts/ring-measure.ts [from=2026-10-16] [to=yesterday]
import { readFileSync } from "node:fs";
import { Redis } from "@upstash/redis";
import { addDays, todayKey } from "../src/lib/day";
import { cellAnswers, gridFromIds } from "../src/lib/ring";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .map((l) =>
      l.match(
        /^\s*(PROD_KV_REST_API_URL|PROD_KV_REST_API_READ_ONLY_TOKEN)\s*=\s*"?([^"]*)"?\s*$/,
      ),
    )
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => [m[1], m[2]]),
);
if (!env.PROD_KV_REST_API_URL || !env.PROD_KV_REST_API_READ_ONLY_TOKEN)
  throw new Error(
    "PROD_KV_REST_API_URL / PROD_KV_REST_API_READ_ONLY_TOKEN missing from .env.local",
  );
const r = new Redis({
  url: env.PROD_KV_REST_API_URL,
  token: env.PROD_KV_REST_API_READ_ONLY_TOKEN,
});

const from = process.argv[2] ?? "2026-10-16";
const to = process.argv[3] ?? addDays(todayKey(), -1);

async function main() {
  const pairs: {
    day: string;
    square: string;
    filled: number;
    players: number;
    distinct: number;
    known: number;
    stars: number;
  }[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const [raw, board, picks, stats] = await Promise.all([
      r.get<unknown>(`card:ring:${day}`),
      r.zrange<(string | number)[]>(`lb:ring:${day}`, 0, -1, {
        withScores: true,
      }),
      r.hgetall<Record<string, unknown>>(`ring:${day}:picks`),
      r.hgetall<Record<string, unknown>>(`stats:${day}`),
    ]);
    if (!raw) {
      console.log(`\n${day}: no frozen card`);
      continue;
    }
    const card = (typeof raw === "string" ? JSON.parse(raw) : raw) as {
      rows: string[];
      cols: string[];
    };
    const g = gridFromIds(card.rows, card.cols);
    if (!g) {
      console.log(
        `\n${day}: frozen card uses a criterion the data no longer has: ${JSON.stringify(card)}`,
      );
      continue;
    }
    const scores: number[] = [];
    for (let i = 1; i < board.length; i += 2) scores.push(Number(board[i]));
    const filled = scores.map((s) => Math.floor(s / 1000));
    const dist = Array.from(
      { length: 10 },
      (_, n) => filled.filter((f) => f === n).length,
    );
    const avg = filled.reduce((a, b) => a + b, 0) / (filled.length || 1);
    const n = (k: string) => Number(stats?.[k] ?? 0);
    console.log(
      `\n${day}  rows: ${g.rows.map((c) => c.label).join(" | ")}   cols: ${g.cols.map((c) => c.label).join(" | ")}`,
    );
    console.log(
      `  stats ring:start ${n("ring:start")}, ring:finish ${n("ring:finish")}; board ${filled.length} players, avg ${avg.toFixed(2)} squares`,
    );
    console.log(
      `  squares filled -> players: ${dist.map((c, i) => `${i}:${c}`).join(" ")}`,
    );
    for (let cell = 0; cell < 9; cell++) {
      const total = Number(picks?.[`${cell}:total`] ?? 0);
      const distinct = Object.keys(picks ?? {}).filter(
        (k) => k.startsWith(`${cell}:`) && k !== `${cell}:total`,
      ).length;
      const answers = cellAnswers(g, cell);
      const row = g.rows[Math.floor(cell / 3)].label;
      const col = g.cols[cell % 3].label;
      const p = {
        day,
        square: `${row} x ${col}`,
        filled: total,
        players: filled.length,
        distinct,
        known: answers.filter((w) => w.pop >= 150).length,
        stars: answers.filter((w) => w.pop >= 500).length,
      };
      pairs.push(p);
      console.log(
        `  ${p.square}: filled by ${total} (${filled.length ? Math.round((100 * total) / filled.length) : 0}% of board), ${distinct} distinct answers, ${p.known} well-known / ${p.stars} stars exist`,
      );
    }
  }

  console.log(
    "\nHardest squares (lowest share of the day's board who filled them):",
  );
  pairs
    .filter((p) => p.players)
    .sort((a, b) => a.filled / a.players - b.filled / b.players)
    .slice(0, 12)
    .forEach((p) =>
      console.log(
        `  ${p.day} ${p.square}: ${Math.round((100 * p.filled) / p.players)}% (${p.filled}/${p.players}), ${p.known} well-known / ${p.stars} stars`,
      ),
    );
}

main();
