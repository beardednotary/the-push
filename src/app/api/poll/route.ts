import { NextResponse } from "next/server";
import { todayKey } from "@/lib/day";
import { pollCounts, pollFor, vote } from "@/lib/polls";
import { cleanId } from "@/lib/store";

export const dynamic = "force-dynamic";

// GET: tonight's poll and its counts (the card shows them only after you vote).
export async function GET() {
  const poll = await pollFor(todayKey());
  return NextResponse.json({ poll, counts: poll ? await pollCounts(poll) : [] });
}

// POST {playerId, option}: one vote per player per night.
export async function POST(req: Request) {
  const { playerId, option } = await req.json().catch(() => ({}));
  const id = cleanId(playerId);
  if (!id) return NextResponse.json({ error: "no player" }, { status: 400 });
  return NextResponse.json(await vote(id, Number(option)));
}
