import { NextResponse } from "next/server";
import { todayKey } from "@/lib/day";
import { fiveCard } from "@/lib/cards";
import { countStat } from "@/lib/stats";

// Reveal one answer after the player commits to it (or runs out of time).
// Also tallies which option was picked, for "how everyone answered" on the yesterday page.
export async function POST(req: Request) {
  const { index, choice, notrack } = await req.json().catch(() => ({}));
  const day = todayKey();
  const i = Number(index);
  const q = (await fiveCard(day))[i];
  if (!q) return NextResponse.json({ error: "bad question" }, { status: 400 });
  if (!notrack) {
    const pick = Number.isInteger(choice) && choice >= 0 && choice < q.options.length ? `o${choice}` : "timeout";
    await countStat(day, `five:q${i}:${pick}`);
  }
  return NextResponse.json({ correct: choice === q.answer, answer: q.answer });
}
