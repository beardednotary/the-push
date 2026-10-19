// "Think that's wrong? Tell us." Players dispute a rejected Ring guess; Ray accepts or
// rejects each wrestler × criterion on /stats. Accepting adds the tag to a Redis override
// hash that guess checks read, so the fix is live at once; the tags.csv row to paste into
// the sheet makes it permanent at the next data build.
import { ringCard } from "./cards";
import { addDays, todayKey } from "./day";
import { criterion, getWrestler, isRegion, missing, type Overrides, type Region } from "./ring";
import { countStat } from "./stats";
import { store } from "./store";

const LOG = "disputes"; // every dispute, JSON, oldest first
const COUNTS = "disputes:count"; // "wrestlerId:criterionId" -> how many
const DONE = "disputes:done"; // "wrestlerId:criterionId" -> accepted | rejected
const OVERRIDES = "ring:overrides"; // "wrestlerId:criterionId" -> day accepted
const PER_PLAYER_PER_DAY = 10;

export interface Dispute {
  day: string;
  cell: number;
  wrestlerId: number;
  row: string;
  col: string;
  criterion: string; // the one the wrestler lacks
  region?: Region;
  at: number;
}

export async function ringOverrides(): Promise<Overrides> {
  return new Set(Object.keys(await store.hashGet(OVERRIDES)));
}

/** Record a dispute; false when it doesn't hold up (not a miss, unknown, over the limit, already sent). */
export async function addDispute(input: { day: unknown; cell: unknown; wrestlerId: unknown; region: unknown; playerId: string }): Promise<boolean> {
  const today = todayKey();
  // the card the player had open; around midnight that can be yesterday's
  const day = input.day === addDays(today, -1) ? addDays(today, -1) : today;
  const region = isRegion(input.region) ? input.region : undefined;
  const cell = Number(input.cell);
  const wrestlerId = Number(input.wrestlerId);
  if (!Number.isInteger(cell) || !getWrestler(wrestlerId)) return false;
  const grid = await ringCard(day, region);
  const lacks = missing(grid, cell, wrestlerId, await ringOverrides());
  if (!lacks.length) return false;
  if ((await store.incr(`disputes:rate:${today}`, input.playerId)) > PER_PLAYER_PER_DAY) return false;
  if (!(await store.addOnce(`disputes:seen:${today}`, `${input.playerId}:${day}:${cell}:${wrestlerId}`))) return false;
  const [row, col] = [grid.rows[Math.floor(cell / 3)].id, grid.cols[cell % 3].id];
  for (const c of lacks) {
    const d: Dispute = { day, cell, wrestlerId, row, col, criterion: c.id, region, at: Date.now() };
    await store.listPush(LOG, JSON.stringify(d));
    await store.hashBump(COUNTS, `${wrestlerId}:${c.id}`);
  }
  await countStat(today, "ring:dispute");
  return true;
}

export interface DisputeGroup {
  key: string;
  wrestler: string;
  criterion: string;
  label: string;
  count: number;
  days: string[];
  status?: string;
  csv: string; // the tags.csv row that makes an accept permanent
}

const csvCell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export async function disputeGroups(): Promise<DisputeGroup[]> {
  const [log, counts, done] = await Promise.all([store.list(LOG), store.hashGet(COUNTS), store.hashGet(DONE)]);
  const days = new Map<string, Set<string>>();
  for (const raw of log) {
    const d = JSON.parse(raw) as Dispute;
    const key = `${d.wrestlerId}:${d.criterion}`;
    (days.get(key) ?? days.set(key, new Set()).get(key)!).add(d.day);
  }
  return Object.entries(counts)
    .map(([key, n]) => {
      const [id, crit] = key.split(":");
      const w = getWrestler(Number(id));
      const c = criterion(crit);
      const label = c?.label.replace(/­/g, "") ?? crit;
      return {
        key,
        wrestler: w?.name ?? `#${id}`,
        criterion: crit,
        label,
        count: Number(n) || 0,
        days: [...(days.get(key) ?? [])].sort().reverse(),
        status: done[key],
        csv: [w?.name ?? id, crit, "add", `Player dispute: ${label}`].map(csvCell).join(","),
      };
    })
    .sort((a, b) => Number(Boolean(a.status)) - Number(Boolean(b.status)) || b.count - a.count);
}

export async function settleDispute(key: string, verdict: "accepted" | "rejected") {
  const [id, crit] = key.split(":");
  if (!getWrestler(Number(id)) || !criterion(crit)) return;
  await store.hashSet(DONE, { [key]: verdict });
  if (verdict === "accepted") await store.hashSet(OVERRIDES, { [key]: todayKey() });
}
