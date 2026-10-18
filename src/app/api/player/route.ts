import { NextResponse } from "next/server";
import { career, recordFinish } from "@/lib/career";
import { cleanId, store } from "@/lib/store";
import { BELTS, ensureCrowned, honors } from "@/lib/titles";
import { cleanRef, creditRecruit, promoterTitle, recruitCounts } from "@/lib/promoter";

// GET ?id=<playerId>: streak, rank, belts and title counts for the "Your record" box.
export async function GET(req: Request) {
  const id = cleanId(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "bad player" }, { status: 400 });
  await ensureCrowned();
  const [c, h, accounts, recruits] = await Promise.all([career(id), honors(), store.hashGet("account:player"), recruitCounts()]);
  const mine = h[id] ?? { reigns: {}, holds: [] };
  return NextResponse.json({
    career: c,
    signedIn: Object.values(accounts).includes(id),
    recruits: recruits[id] ?? 0,
    promoter: promoterTitle(recruits[id] ?? 0),
    belts: BELTS.map((b) => ({ id: b.id, name: b.name, reigns: mine.reigns[b.id] ?? 0, holding: mine.holds.includes(b.id) })),
  });
}

// POST {id, ref?}: a game was finished. Counts toward streak and rank even on ?notrack devices.
// A first-ever finish that came through someone's share link (ref) credits that sharer.
export async function POST(req: Request) {
  const { id: raw, ref: rawRef } = await req.json().catch(() => ({}));
  const id = cleanId(raw);
  if (!id) return NextResponse.json({ error: "bad player" }, { status: 400 });
  const ref = cleanRef(rawRef);
  const first = ref ? (await career(id)).games === 0 : false;
  const c = await recordFinish(id);
  if (ref && first) await creditRecruit(id, ref);
  return NextResponse.json({ career: c });
}
