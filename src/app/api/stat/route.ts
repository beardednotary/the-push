import { NextResponse } from "next/server";
import { todayKey } from "@/lib/day";
import { STAT_EVENTS, countStat, type StatEvent } from "@/lib/stats";

// POST {event}: bump one anonymous daily counter. Unknown events are ignored.
export async function POST(req: Request) {
  const { event } = await req.json().catch(() => ({}));
  if (!STAT_EVENTS.includes(event as StatEvent)) return NextResponse.json({ ok: false }, { status: 400 });
  await countStat(todayKey(), event);
  return NextResponse.json({ ok: true });
}
