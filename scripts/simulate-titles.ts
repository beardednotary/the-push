// Simulate ten days of play against the in-memory store and print belts, reigns and streaks.
//   npx tsx scripts/simulate-titles.ts      (needs no Upstash keys: uses the dev memory store)
import { careers, recordFinish } from "../src/lib/career";
import { addDays } from "../src/lib/day";
import { store } from "../src/lib/store";
import { BELTS, CHAMPIONSHIPS_START, ensureCrowned, honors, reigns, results } from "../src/lib/titles";

async function main() {
  if (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) throw new Error("refusing to run against a real database");
  // ann and bob are signed in; cat is not, so cat can top a board but never win a belt
  await store.hashSet("account:player", { u1: "ann-0000001", u2: "bob-0000002", u9: "boss-000009" });
  // the boss is an admin: tops every board, never takes a belt
  process.env.ADMIN_EMAILS = "boss@example.com";
  await store.setOnce("auth:user:email:boss@example.com", "u9");
  await Promise.all([store.setName("ann-0000001", "Ann"), store.setName("bob-0000002", "Bob"), store.setName("cat-0000003", "Cat")]);

  // day offset -> [ann, bob, cat] Daily Five scores (null = didn't play)
  const five: (number | null)[][] = [
    [800, 700, 990], // day 0: Cat highest but ineligible -> Ann
    [820, 600, null], // Ann defends
    [500, 900, null], // Bob wins
    [null, 910, 100], // Bob defends; Ann misses a day
    [950, 400, null], // Ann regains -> 2nd reign
    [700, 701, null],
    [710, 702, null],
    [720, 703, null],
    [730, 704, null],
    [740, 705, null],
  ];
  const ids = ["ann-0000001", "bob-0000002", "cat-0000003"];
  for (let d = 0; d < five.length; d++) {
    const day = addDays(CHAMPIONSHIPS_START, d);
    for (let p = 0; p < 3; p++) {
      const s = five[d][p];
      if (s === null) continue;
      await store.submit(`lb:five:${day}`, ids[p], s);
      await store.submit(`lb:ring:${day}`, ids[p], 9000 - s); // reverse order on the Ring
      await recordFinish(ids[p], day);
    }
    await store.submit(`lb:five:${day}`, "boss-000009", 1000);
    await store.submit(`lb:ring:${day}`, "boss-000009", 9891);
  }
  const today = addDays(CHAMPIONSHIPS_START, five.length);
  await ensureCrowned(today);
  await ensureCrowned(today); // second call must not crown twice

  for (const b of BELTS) {
    const rs = await results(b);
    console.log(`\n${b.name}: ${rs.length} periods crowned`);
    for (const r of reigns(rs)) console.log(`  #${r.number} ${r.name.padEnd(7)} ${r.from} -> ${r.to}  defenses ${r.defenses}`);
  }
  console.log("\nhonors:", JSON.stringify(await honors()));
  const c = await careers(ids);
  for (const id of ids) console.log(id, c[id]);
}
main();
