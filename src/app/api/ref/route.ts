import { NextResponse } from "next/server";
import { registerRef } from "@/lib/promoter";
import { cleanId } from "@/lib/store";

// POST {id}: the short code this player's share links carry (?by=), registered so a
// recruit's first finish can be credited back to them.
export async function POST(req: Request) {
  const { id: raw } = await req.json().catch(() => ({}));
  const id = cleanId(raw);
  if (!id) return NextResponse.json({ error: "bad player" }, { status: 400 });
  return NextResponse.json({ code: await registerRef(id) });
}
