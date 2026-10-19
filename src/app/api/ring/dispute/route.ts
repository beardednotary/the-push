import { NextResponse } from "next/server";
import { addDispute } from "@/lib/disputes";
import { cleanId } from "@/lib/store";

// POST {day, cell, wrestlerId, region?, playerId}: "Think that's wrong? Tell us." on a rejected guess.
// The row and column come from the frozen card, not the client.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const playerId = cleanId(body.playerId);
  if (!playerId) return NextResponse.json({ ok: false }, { status: 400 });
  const ok = await addDispute({ ...body, playerId });
  return NextResponse.json({ ok });
}
