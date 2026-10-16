import { NextResponse } from "next/server";
import { todayKey } from "@/lib/day";
import { checkGuess } from "@/lib/ring";
import { store } from "@/lib/store";

// Check one guess; a correct one is counted toward that cell's rarity.
export async function POST(req: Request) {
  const { cell, wrestlerId } = await req.json().catch(() => ({}));
  const day = todayKey();
  const c = Number(cell);
  const { correct, wrestler } = checkGuess(day, c, Number(wrestlerId));
  if (!wrestler) return NextResponse.json({ error: "unknown wrestler" }, { status: 400 });
  if (!correct) return NextResponse.json({ correct: false, name: wrestler.name });
  const hash = `ring:${day}:picks`;
  const [picks, total] = await Promise.all([store.incr(hash, `${c}:${wrestler.id}`), store.incr(hash, `${c}:total`)]);
  return NextResponse.json({ correct: true, name: wrestler.name, rarity: Math.round((100 * picks) / total) });
}
