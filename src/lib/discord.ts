// The morning post in the Discord's #daily-card: tonight's card is live, who took
// yesterday's belts, and what everyone put in yesterday's Ring. Sent by the daily cron
// to DISCORD_WEBHOOK_URL (a secret: anyone with it can post in the channel).
import { ringCard } from "./cards";
import { addDays, puzzleNumber, todayKey } from "./day";
import { ringPicks } from "./picks";
import { store } from "./store";
import { BELTS, ensureCrowned, results, weekStart } from "./titles";

const SITE = "https://playthepush.com";

async function champions(yesterday: string): Promise<string[]> {
  await ensureCrowned();
  const lines: string[] = [];
  for (const belt of BELTS) {
    // weekly belts are decided on Mondays, for the week that just ended
    const period = belt.period === "daily" ? yesterday : weekStart(yesterday);
    if (belt.period === "weekly" && addDays(period, 6) !== yesterday) continue;
    const r = (await results(belt)).find((x) => x.period === period);
    if (!r) continue;
    const score = belt.game === "ring" ? `${Math.floor(r.score / 1000)}/9` : String(r.score);
    lines.push(r.playerId ? `🏆 ${belt.name}: **${r.name}** (${score})` : `🏆 ${belt.name}: vacant. Sign in to stake a claim.`);
  }
  return lines;
}

export async function dailyPost(today = todayKey()): Promise<string> {
  const yesterday = addDays(today, -1);
  const lines = [`🔔 **Card No. ${puzzleNumber(today)} is live** · ${SITE}`];
  const champs = await champions(yesterday);
  if (champs.length) lines.push("", `**Last night's champions** (No. ${puzzleNumber(yesterday)})`, ...champs);

  const grid = await ringCard(yesterday);
  const picks = await ringPicks(yesterday, grid);
  const squares = picks
    .map((p, i) => ({ p, row: grid.rows[Math.floor(i / 3)].label, col: grid.cols[i % 3].label }))
    .filter(({ p }) => p.top[0]);
  if (squares.length) {
    lines.push("", `**Yesterday's Ring: most picked**`);
    for (const { p, row, col } of squares) lines.push(`${row} × ${col}: ${p.top[0].name} (${p.top[0].pct}%) · ${p.possible} possible`);
    lines.push(`Full answer key: <${SITE}/yesterday>`);
  }
  return lines.join("\n");
}

/** Post once per day; force re-sends (manual tests). */
export async function postDaily({ force = false } = {}): Promise<{ posted: boolean; reason?: string }> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return { posted: false, reason: "DISCORD_WEBHOOK_URL not set" };
  const today = todayKey();
  if (!force && !(await store.setOnce(`discord:posted:${today}`, "1"))) return { posted: false, reason: "already posted today" };
  const content = (await dailyPost(today)).slice(0, 2000); // Discord's message limit
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, username: "The Push", allowed_mentions: { parse: [] } }),
  });
  return res.ok ? { posted: true } : { posted: false, reason: `Discord said ${res.status}` };
}
