// Social "question of the day" teasers that won't spoil a card in the next 90 days.
//   npx tsx scripts/qotd.ts [count]
import bank from "../data/generated/trivia.json";
import { todayKey } from "../src/lib/day";
import { questionsFor, type Question } from "../src/lib/five";

const count = Number(process.argv[2] ?? 7);
const start = Date.parse(`${todayKey()}T12:00:00Z`);
const soon = new Set<string>();
for (let d = 0; d <= 90; d++) {
  for (const q of questionsFor(new Date(start + d * 86_400_000).toISOString().slice(0, 10))) soon.add(q.id);
}

const BIG = /WrestleMania|Royal Rumble|SummerSlam|Survivor Series|Starrcade|Halloween Havoc|King of the Ring/;
const pool = (bank as Question[]).filter((q) => !soon.has(q.id) && (q.type !== "classic" || BIG.test(q.prompt)) && (q.type !== "lineage" || BIG.test(q.prompt)));
const byType = new Map<string, Question[]>();
for (const q of pool) byType.set(q.type, [...(byType.get(q.type) ?? []), q]);

// rotate through question types so the week has variety
const order = ["rumble", "wmMain", "lineage", "wmCity", "classic", "promotion"];
const picked: Question[] = [];
for (let i = 0; picked.length < count && i < 50; i++) {
  const list = byType.get(order[i % order.length]) ?? [];
  const q = list.splice(Math.floor(list.length / 3), 1)[0];
  if (q) picked.push(q);
}
for (const q of picked) {
  console.log(`[${q.type}] ${q.prompt}`);
  q.options.forEach((o, i) => console.log(`   ${"ABCD"[i]}. ${o}${i === q.answer ? "   <- answer" : ""}`));
}
