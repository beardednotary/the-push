import { NextResponse } from "next/server";
import { todayKey } from "@/lib/day";
import { scoreFive, type FiveAnswer } from "@/lib/five";
import { checkGuess } from "@/lib/ring";
import { cleanId, cleanName, store } from "@/lib/store";

type Game = "five" | "ring";
const GAMES: Game[] = ["five", "ring"];

async function board(game: Game, day: string, me?: string) {
  const top = await store.top(`lb:${game}:${day}`, 20);
  const names = await store.names(top.map((t) => t.member));
  return top.map((t, i) => ({ rank: i + 1, name: names[t.member] ?? "Anonymous", score: t.score, me: t.member === me }));
}

export async function GET(req: Request, { params }: { params: Promise<{ game: string }> }) {
  const game = (await params).game as Game;
  if (!GAMES.includes(game)) return NextResponse.json({ error: "unknown game" }, { status: 404 });
  const me = cleanId(new URL(req.url).searchParams.get("me")) ?? undefined;
  return NextResponse.json({ top: await board(game, todayKey(), me) });
}

// The server recomputes every score from the raw answers; clients never send a score.
export async function POST(req: Request, { params }: { params: Promise<{ game: string }> }) {
  const game = (await params).game as Game;
  if (!GAMES.includes(game)) return NextResponse.json({ error: "unknown game" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const id = cleanId(body.playerId);
  if (!id) return NextResponse.json({ error: "bad player" }, { status: 400 });
  const day = todayKey();

  let score: number;
  if (game === "five") {
    const answers: FiveAnswer[] = Array.isArray(body.answers) ? body.answers.slice(0, 5) : [];
    // a human can't read and tap in under a third of a second
    score = scoreFive(day, answers.map((a) => ({ choice: a?.choice ?? null, ms: Math.max(300, Number(a?.ms) || 0) }))).score;
  } else {
    const cells: (number | null)[] = Array.isArray(body.cells) ? body.cells.slice(0, 9) : [];
    const used = new Set<number>();
    let correct = 0;
    let rarity = 0;
    for (let c = 0; c < 9; c++) {
      const id = cells[c];
      const ok = id != null && !used.has(id) && checkGuess(day, c, id).correct;
      if (!ok) {
        rarity += 100;
        continue;
      }
      used.add(id);
      correct++;
      const hash = `ring:${day}:picks`;
      const [picks, total] = await Promise.all([store.get(hash, `${c}:${id}`), store.get(hash, `${c}:total`)]);
      rarity += total ? Math.round((100 * picks) / total) : 100;
    }
    score = correct * 1000 + (900 - rarity);
  }

  const name = cleanName(body.name);
  await store.setName(id, name);
  await store.submit(`lb:${game}:${day}`, id, score);
  const standing = await store.rank(`lb:${game}:${day}`, id);
  return NextResponse.json({ score, standing, top: await board(game, day, id) });
}
