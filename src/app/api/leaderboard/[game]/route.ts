import { NextResponse } from "next/server";
import { todayKey } from "@/lib/day";
import { scoreFive, type FiveAnswer } from "@/lib/five";
import { fiveCard, picksKey, ringCard } from "@/lib/cards";
import { ringOverrides } from "@/lib/disputes";
import { checkGuess, isRegion, type Region } from "@/lib/ring";
import { careers } from "@/lib/career";
import { cleanId, cleanName, store } from "@/lib/store";
import { ensureCrowned, honors } from "@/lib/titles";
import { flairs } from "@/lib/flair";
import { promoterTitle, recruitCounts } from "@/lib/promoter";

type Game = "five" | "ring";
const GAMES: Game[] = ["five", "ring"];

// Region Ring boards (lb:ring:jp:DAY) sit beside the main one. The belts only read the
// main boards, so region scores never count toward a title.
const boardKey = (game: Game, day: string, region?: Region) => (region && game === "ring" ? `lb:${game}:${region}:${day}` : `lb:${game}:${day}`);

async function board(game: Game, day: string, me?: string, region?: Region) {
  await ensureCrowned();
  const top = await store.top(boardKey(game, day, region), 20);
  const ids = top.map((t) => t.member);
  const [names, h, c, f, rc] = await Promise.all([store.names(ids), honors(), careers(ids), flairs(), recruitCounts()]);
  return top.map((t, i) => {
    const mine = h[t.member];
    return {
      rank: i + 1,
      name: names[t.member] ?? "Anonymous",
      score: t.score,
      me: t.member === me,
      // flair: belt held in this game, total reigns in this game's belts, career rank
      champ: mine?.holds.find((b) => b.startsWith(`${game}-`)) ?? null,
      reigns: Object.entries(mine?.reigns ?? {}).filter(([b]) => b.startsWith(`${game}-`)).reduce((a, [, n]) => a + n, 0),
      tier: c[t.member]?.rank ?? "Jobber",
      flair: f[t.member] ?? null,
      promoter: promoterTitle(rc[t.member] ?? 0),
    };
  });
}

export async function GET(req: Request, { params }: { params: Promise<{ game: string }> }) {
  const game = (await params).game as Game;
  if (!GAMES.includes(game)) return NextResponse.json({ error: "unknown game" }, { status: 404 });
  const url = new URL(req.url);
  const me = cleanId(url.searchParams.get("me")) ?? undefined;
  const r = url.searchParams.get("region");
  return NextResponse.json({ top: await board(game, todayKey(), me, isRegion(r) ? r : undefined) });
}

// The server recomputes every score from the raw answers; clients never send a score.
export async function POST(req: Request, { params }: { params: Promise<{ game: string }> }) {
  const game = (await params).game as Game;
  if (!GAMES.includes(game)) return NextResponse.json({ error: "unknown game" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const id = cleanId(body.playerId);
  if (!id) return NextResponse.json({ error: "bad player" }, { status: 400 });
  const day = todayKey();
  const region = game === "ring" && isRegion(body.region) ? body.region : undefined;

  let score: number;
  if (game === "five") {
    const answers: FiveAnswer[] = Array.isArray(body.answers) ? body.answers.slice(0, 5) : [];
    // a human can't read and tap in under a third of a second
    score = scoreFive(await fiveCard(day), answers.map((a) => ({ choice: a?.choice ?? null, ms: Math.max(300, Number(a?.ms) || 0) }))).score;
  } else {
    const cells: (number | null)[] = Array.isArray(body.cells) ? body.cells.slice(0, 9) : [];
    const [grid, extra] = await Promise.all([ringCard(day, region), ringOverrides()]);
    const used = new Set<number>();
    let correct = 0;
    let rarity = 0;
    for (let c = 0; c < 9; c++) {
      const id = cells[c];
      const ok = id != null && !used.has(id) && checkGuess(grid, c, id, extra).correct;
      if (!ok) {
        rarity += 100;
        continue;
      }
      used.add(id);
      correct++;
      const hash = picksKey(day, region);
      const [picks, total] = await Promise.all([store.get(hash, `${c}:${id}`), store.get(hash, `${c}:total`)]);
      rarity += total ? Math.round((100 * picks) / total) : 100;
    }
    score = correct * 1000 + (900 - rarity);
  }

  const name = cleanName(body.name);
  await store.setName(id, name);
  await store.submit(boardKey(game, day, region), id, score);
  const standing = await store.rank(boardKey(game, day, region), id);
  return NextResponse.json({ score, standing, top: await board(game, day, id, region) });
}
