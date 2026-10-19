import type { Metadata } from "next";
import { Bug, Plate } from "@/components/Chrome";
import { RememberRef } from "@/components/client";
import { LeagueRoom } from "@/components/league";
import { cleanCode, getLeague } from "@/lib/leagues";
import { pageMeta } from "@/lib/meta";

export const dynamic = "force-dynamic";

type Params = { code: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const code = cleanCode((await params).code);
  const league = code ? await getLeague(code) : null;
  if (!league) return { title: "League · The Push", robots: { index: false } };
  return pageMeta(
    `/league/${league.code}`,
    `Join ${league.name} on The Push`,
    "A friend league: nightly wrestling trivia, your own standings, and a belt on the line.",
    { robots: { index: false, follow: true } },
  );
}

export default async function LeaguePage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ by?: string }> }) {
  const code = (await params).code.toLowerCase();
  const { by } = await searchParams;
  return (
    <>
      <Bug>
        <Plate tone="dark">League</Plate>
      </Bug>
      <main className="wrap">
        <RememberRef by={by} />
        <LeagueRoom code={code} />
      </main>
    </>
  );
}
