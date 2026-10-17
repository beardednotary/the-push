// Championships. Each game has a daily belt and a weekly (Monday-Sunday) belt. When a
// day or week ends, the top signed-in player on that board wins it; consecutive wins
// are one reign with title defenses, so "3x champion" means three separate reigns.
// Crowning is lazy and idempotent: whoever loads a page after midnight triggers it.
import { adminPlayerIds } from "./admin";
import { addDays, todayKey } from "./day";
import { store } from "./store";

export type Game = "five" | "ring";
export interface Belt {
  id: string;
  game: Game;
  period: "daily" | "weekly";
  name: string;
}

export const BELTS: Belt[] = [
  { id: "five-daily", game: "five", period: "daily", name: "Daily Five Championship" },
  { id: "five-weekly", game: "five", period: "weekly", name: "Daily Five World Heavyweight Championship" },
  { id: "ring-daily", game: "ring", period: "daily", name: "Immaculate Ring Championship" },
  { id: "ring-weekly", game: "ring", period: "weekly", name: "Immaculate Ring World Heavyweight Championship" },
];

/** First card that counts toward championships. */
export const CHAMPIONSHIPS_START = "2026-10-17";

export interface Result {
  period: string; // the day, or the Monday that starts the week
  playerId: string | null; // null = vacant (no signed-in player on the board)
  name: string;
  score: number;
}
export interface Reign {
  number: number;
  playerId: string | null;
  name: string;
  from: string;
  to: string;
  defenses: number;
}

/** Monday (ET calendar) of the week containing `day`. */
export function weekStart(day: string): string {
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
}

async function eligible(): Promise<Set<string>> {
  // signed-in players (each account owns one player ID, see accountPlayerId in auth.ts), minus admins
  const [links, admins] = await Promise.all([store.hashGet("account:player"), adminPlayerIds()]);
  return new Set(Object.values(links).filter((id) => !admins.has(id)));
}

async function decide(belt: Belt, period: string, signedIn: Set<string>): Promise<Result> {
  const days = belt.period === "daily" ? [period] : Array.from({ length: 7 }, (_, i) => addDays(period, i));
  const totals = new Map<string, number>();
  for (const d of days) {
    for (const { member, score } of await store.all(`lb:${belt.game}:${d}`)) {
      totals.set(member, (totals.get(member) ?? 0) + score);
    }
  }
  const best = [...totals].filter(([id]) => signedIn.has(id)).sort((a, b) => b[1] - a[1])[0];
  if (!best) return { period, playerId: null, name: "Vacant", score: 0 };
  const names = await store.names([best[0]]);
  return { period, playerId: best[0], name: names[best[0]] ?? "Anonymous", score: best[1] };
}

/** Crown every finished day/week that hasn't been crowned yet. Safe to call on every request. */
export async function ensureCrowned(today = todayKey()): Promise<void> {
  const pointers = await store.hashGet("crown:last");
  let signedIn: Set<string> | null = null;
  for (const belt of BELTS) {
    const step = belt.period === "daily" ? 1 : 7;
    const first = belt.period === "daily" ? CHAMPIONSHIPS_START : weekStart(CHAMPIONSHIPS_START);
    let period = pointers[belt.id] ? addDays(pointers[belt.id], step) : first;
    // a period is over once its last day is before today
    while (addDays(period, step - 1) < today) {
      if (await store.setOnce(`crown:${belt.id}:${period}`, "1")) {
        signedIn ??= await eligible();
        await store.listPush(`lineage:${belt.id}`, JSON.stringify(await decide(belt, period, signedIn)));
      }
      await store.hashSet("crown:last", { [belt.id]: period });
      period = addDays(period, step);
    }
  }
}

export async function results(belt: Belt): Promise<Result[]> {
  return (await store.list(`lineage:${belt.id}`)).map((v) => JSON.parse(v) as Result).sort((a, b) => a.period.localeCompare(b.period));
}

/** Group consecutive wins by the same player into reigns, oldest first. */
export function reigns(rs: Result[]): Reign[] {
  const out: Reign[] = [];
  for (const r of rs) {
    const cur = out[out.length - 1];
    if (cur && cur.playerId === r.playerId) {
      cur.to = r.period;
      cur.defenses++;
    } else {
      out.push({ number: out.length + 1, playerId: r.playerId, name: r.name, from: r.period, to: r.period, defenses: 0 });
    }
  }
  return out;
}

export interface Honors {
  reigns: Record<string, number>; // belt id -> number of reigns
  holds: string[]; // belt ids currently held
}

/** Title counts and current belts for many players at once. */
export async function honors(): Promise<Record<string, Honors>> {
  const out: Record<string, Honors> = {};
  for (const belt of BELTS) {
    const rs = reigns(await results(belt));
    rs.forEach((r, i) => {
      if (!r.playerId) return;
      const h = (out[r.playerId] ??= { reigns: {}, holds: [] });
      h.reigns[belt.id] = (h.reigns[belt.id] ?? 0) + 1;
      if (i === rs.length - 1) h.holds.push(belt.id);
    });
  }
  return out;
}
