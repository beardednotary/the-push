import { NextResponse } from "next/server";
import { todayKey } from "@/lib/day";
import { subKey, validSubscription } from "@/lib/push";
import { cleanId, store } from "@/lib/store";

// POST {action: "subscribe", subscription, playerId} | {action: "unsubscribe", endpoint} | {action: "played", playerId}
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const playerId = cleanId(body.playerId) ?? undefined;

  if (body.action === "subscribe") {
    const sub = validSubscription(body.subscription);
    if (!sub) return NextResponse.json({ error: "bad subscription" }, { status: 400 });
    await store.saveSub(subKey(sub.endpoint), JSON.stringify({ sub, playerId, at: Date.now() }));
    return NextResponse.json({ ok: true });
  }
  if (body.action === "unsubscribe") {
    if (typeof body.endpoint !== "string") return NextResponse.json({ error: "bad endpoint" }, { status: 400 });
    await store.deleteSub(subKey(body.endpoint));
    return NextResponse.json({ ok: true });
  }
  if (body.action === "played") {
    if (!playerId) return NextResponse.json({ error: "bad player" }, { status: 400 });
    await store.markPlayed(todayKey(), playerId);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
