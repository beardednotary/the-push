import { NextResponse } from "next/server";
import { todayKey } from "@/lib/day";
import { ringCard } from "@/lib/cards";
import { ringPicks } from "@/lib/picks";
import { isRegion } from "@/lib/ring";

// Most-picked answers for today's Ring, shown on the results screen once a player is done.
export async function GET(req: Request) {
  const r = new URL(req.url).searchParams.get("region");
  const region = isRegion(r) ? r : undefined;
  const day = todayKey();
  return NextResponse.json(await ringPicks(day, await ringCard(day, region), 0, region), { headers: { "Cache-Control": "public, s-maxage=60" } });
}
