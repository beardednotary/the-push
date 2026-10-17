import { NextResponse } from "next/server";
import { todayKey } from "@/lib/day";
import { ringCard } from "@/lib/cards";
import { ringPicks } from "@/lib/picks";

// Most-picked answers for today's Ring, shown on the results screen once a player is done.
export async function GET() {
  const day = todayKey();
  return NextResponse.json(await ringPicks(day, await ringCard(day)), { headers: { "Cache-Control": "public, s-maxage=60" } });
}
