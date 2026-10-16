import { NextResponse } from "next/server";
import { todayKey } from "@/lib/day";
import { questionsFor } from "@/lib/five";

// Reveal one answer after the player commits to it (or runs out of time).
export async function POST(req: Request) {
  const { index, choice } = await req.json().catch(() => ({}));
  const q = questionsFor(todayKey())[Number(index)];
  if (!q) return NextResponse.json({ error: "bad question" }, { status: 400 });
  return NextResponse.json({ correct: choice === q.answer, answer: q.answer });
}
