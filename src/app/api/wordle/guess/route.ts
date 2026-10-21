import { NextResponse } from "next/server";
import { todayKey } from "@/lib/day";
import { getWrestler } from "@/lib/ring";
import { clueRow, replay, wordleAnswer } from "@/lib/wordle";

// POST {guesses: wrestler ids so far, newest last}: the clue row for the newest guess.
// The answer only comes back once the game is over (solved, or eight different guesses).
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const guesses: number[] = Array.isArray(body.guesses) ? body.guesses.slice(0, 9).map(Number) : [];
  const answer = await wordleAnswer(todayKey());
  const { solvedIn, over, valid } = replay(guesses, answer);
  const last = getWrestler(guesses[guesses.length - 1]);
  if (!valid || !last) return NextResponse.json({ error: "bad guesses" }, { status: 400 });
  return NextResponse.json({
    row: clueRow(last, answer),
    solved: solvedIn > 0,
    answer: over ? clueRow(answer, answer) : undefined,
  });
}
