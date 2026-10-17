import { NextResponse } from "next/server";
import { career, recordFinish } from "@/lib/career";
import { cleanId, store } from "@/lib/store";
import { BELTS, ensureCrowned, honors } from "@/lib/titles";

// GET ?id=<playerId>: streak, rank, belts and title counts for the "Your record" box.
export async function GET(req: Request) {
  const id = cleanId(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "bad player" }, { status: 400 });
  await ensureCrowned();
  const [c, h, accounts] = await Promise.all([career(id), honors(), store.hashGet("account:player")]);
  const mine = h[id] ?? { reigns: {}, holds: [] };
  return NextResponse.json({
    career: c,
    signedIn: Object.values(accounts).includes(id),
    belts: BELTS.map((b) => ({ id: b.id, name: b.name, reigns: mine.reigns[b.id] ?? 0, holding: mine.holds.includes(b.id) })),
  });
}

// POST {id}: a game was finished. Counts toward streak and rank even on ?notrack devices.
export async function POST(req: Request) {
  const { id: raw } = await req.json().catch(() => ({}));
  const id = cleanId(raw);
  if (!id) return NextResponse.json({ error: "bad player" }, { status: 400 });
  return NextResponse.json({ career: await recordFinish(id) });
}
