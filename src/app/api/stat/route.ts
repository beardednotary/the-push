import { NextResponse } from "next/server";
import { todayKey } from "@/lib/day";
import { STAT_EVENTS, countPlayer, countStat, type StatEvent } from "@/lib/stats";
import { cleanId } from "@/lib/store";

// POST {event, playerId?}: bump one anonymous daily counter. Unknown events are ignored.
// Finishes carry the device's random player ID so we can count unique and returning players.
export async function POST(req: Request) {
  const { event, playerId } = await req.json().catch(() => ({}));
  if (!STAT_EVENTS.includes(event as StatEvent)) return NextResponse.json({ ok: false }, { status: 400 });
  const day = todayKey();
  await countStat(day, event);
  const id = cleanId(playerId);
  if (id && String(event).endsWith(":finish")) await countPlayer(day, id);
  return NextResponse.json({ ok: true });
}
