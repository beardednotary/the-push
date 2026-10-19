import { NextResponse } from "next/server";
import { todayKey } from "@/lib/day";
import { picksKey, ringCard } from "@/lib/cards";
import { ringOverrides } from "@/lib/disputes";
import { checkGuess, isRegion } from "@/lib/ring";
import { store } from "@/lib/store";

// Check one guess; a correct one is counted toward that cell's rarity.
export async function POST(req: Request) {
  const { cell, wrestlerId, region: r } = await req.json().catch(() => ({}));
  const region = isRegion(r) ? r : undefined;
  const day = todayKey();
  const c = Number(cell);
  const { correct, wrestler } = checkGuess(await ringCard(day, region), c, Number(wrestlerId), await ringOverrides());
  if (!wrestler) return NextResponse.json({ error: "unknown wrestler" }, { status: 400 });
  if (!correct) return NextResponse.json({ correct: false, name: wrestler.name });
  const hash = picksKey(day, region);
  const [picks, total] = await Promise.all([store.incr(hash, `${c}:${wrestler.id}`), store.incr(hash, `${c}:total`)]);
  return NextResponse.json({ correct: true, name: wrestler.name, rarity: Math.round((100 * picks) / total) });
}
