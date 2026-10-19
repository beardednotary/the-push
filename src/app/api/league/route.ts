import { NextResponse } from "next/server";
import { accountPlayerId, auth, signInEnabled } from "@/auth";
import { todayKey } from "@/lib/day";
import { cleanLeagueName, createLeague, leaguesOf, MAX_LEAGUES } from "@/lib/leagues";
import { countStat } from "@/lib/stats";
import { cleanId, cleanName, store } from "@/lib/store";

// GET ?id=<playerId>: the player's leagues, for the "Your leagues" block.
export async function GET(req: Request) {
  const id = cleanId(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "bad player" }, { status: 400 });
  const leagues = await leaguesOf(id);
  return NextResponse.json({ leagues: leagues.map(({ code, name, size, owner }) => ({ code, name, size, owner: owner === id })) });
}

// POST {playerId, name, track?}: start a league. Needs a signed-in account wherever sign-in
// is switched on (local dev without auth keys uses the device's player ID).
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = cleanLeagueName(body.name);
  if (!name) return NextResponse.json({ error: "Give your league a name." }, { status: 400 });
  let owner = cleanId(body.playerId);
  if (signInEnabled) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in to start a league.", signIn: true }, { status: 401 });
    owner = await accountPlayerId(session.user.id, owner);
  }
  if (!owner) return NextResponse.json({ error: "bad player" }, { status: 400 });
  const code = await createLeague(owner, name);
  if (!code) return NextResponse.json({ error: `You're already in ${MAX_LEAGUES} leagues, the most anyone can join.` }, { status: 409 });
  if (String(body.ringName ?? "").trim() && !(await store.names([owner]))[owner]) await store.setName(owner, cleanName(body.ringName));
  if (body.track !== false) await countStat(todayKey(), "league:create");
  return NextResponse.json({ code, playerId: owner });
}
