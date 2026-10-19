import { NextResponse } from "next/server";
import { careers } from "@/lib/career";
import { todayKey } from "@/lib/day";
import { flairs } from "@/lib/flair";
import { cleanCode, ensureLeagueCrowned, getLeague, joinLeague, leagueBoard, leagueChamp, LEAGUE_GAMES, MAX_LEAGUES, MAX_MEMBERS, members } from "@/lib/leagues";
import { promoterTitle, recruitCounts } from "@/lib/promoter";
import { countStat } from "@/lib/stats";
import { cleanId, cleanName, store } from "@/lib/store";
import { ensureCrowned, honors } from "@/lib/titles";

// GET ?me=<playerId>: the league, tonight's standings in both games, and who holds its belts.
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = cleanCode((await params).code);
  const league = code ? await getLeague(code) : null;
  if (!league) return NextResponse.json({ error: "No league at that link." }, { status: 404 });
  const me = cleanId(new URL(req.url).searchParams.get("me"));
  const day = todayKey();
  await Promise.all([ensureCrowned(), ensureLeagueCrowned(league.code, league.created, day)]);
  const ids = await members(league.code);
  const [boards, champs, names, h, c, f, rc] = await Promise.all([
    Promise.all(LEAGUE_GAMES.map((g) => leagueBoard(league.code, g, day, ids))),
    Promise.all(LEAGUE_GAMES.map((g) => leagueChamp(league.code, g))),
    store.names(ids),
    honors(),
    careers(ids),
    flairs(),
    recruitCounts(),
  ]);
  // the same flair as the main board, plus the league's own belt
  const standings = Object.fromEntries(
    LEAGUE_GAMES.map((game, gi) => [
      game,
      boards[gi].map((t, i) => {
        const mine = h[t.member];
        return {
          rank: i + 1,
          name: names[t.member] ?? "Anonymous",
          score: t.score,
          me: t.member === me,
          leagueChamp: champs[gi]?.playerId === t.member,
          champ: mine?.holds.find((b) => b.startsWith(`${game}-`)) ?? null,
          reigns: Object.entries(mine?.reigns ?? {}).filter(([b]) => b.startsWith(`${game}-`)).reduce((a, [, n]) => a + n, 0),
          tier: c[t.member]?.rank ?? "Jobber",
          flair: f[t.member] ?? null,
          promoter: promoterTitle(rc[t.member] ?? 0),
        };
      }),
    ]),
  );
  const belts = Object.fromEntries(
    LEAGUE_GAMES.map((game, gi) => {
      const ch = champs[gi];
      return [game, ch && { name: names[ch.playerId] ?? ch.name, since: ch.since, defenses: ch.defenses, reigns: ch.reigns, me: ch.playerId === me }];
    }),
  );
  return NextResponse.json({
    code: league.code,
    name: league.name,
    created: league.created,
    size: ids.length,
    max: MAX_MEMBERS,
    member: Boolean(me && ids.includes(me)),
    owner: Boolean(me && league.owner === me),
    // who's in, so a quiet night still shows the roster (played tonight first)
    roster: ids
      .map((id) => ({ name: names[id] ?? "Unnamed", played: boards.some((b) => b.some((e) => e.member === id)), me: id === me }))
      .sort((a, b) => Number(b.played) - Number(a.played) || a.name.localeCompare(b.name)),
    standings,
    belts,
  });
}

// POST {playerId, track?}: join with this device's player ID. No sign-in needed.
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = cleanCode((await params).code);
  const body = await req.json().catch(() => ({}));
  const id = cleanId(body.playerId);
  if (!code || !id) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const result = await joinLeague(code, id);
  // a ring name typed at the door shows on the roster before they've posted a score
  if (result === "joined" && String(body.name ?? "").trim() && !(await store.names([id]))[id]) await store.setName(id, cleanName(body.name));
  if (result === "joined" && body.track !== false) await countStat(todayKey(), "league:join");
  const error = {
    missing: "No league at that link.",
    full: `This league is full (${MAX_MEMBERS} members).`,
    "too-many": `You're already in ${MAX_LEAGUES} leagues, the most anyone can join.`,
  }[result as string];
  return NextResponse.json({ result, error }, { status: error ? (result === "missing" ? 404 : 409) : 200 });
}
