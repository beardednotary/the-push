import type { Metadata } from "next";
import Link from "next/link";
import { Bug, Plate } from "@/components/Chrome";
import { prettyDay, puzzleNumber } from "@/lib/day";
import { pageMeta } from "@/lib/meta";
import { BELTS, CHAMPIONSHIPS_START, ensureCrowned, reigns, results, type Belt, type Reign } from "@/lib/titles";

export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMeta(
  "/titles",
  "Championships · The Push",
  "The Push title histories: daily and weekly champions of the Daily Five and the Immaculate Ring.",
);

const short = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function span(belt: Belt, r: Reign) {
  if (belt.period === "daily") {
    return r.from === r.to ? `No. ${puzzleNumber(r.from)} · ${short(r.from)}` : `No. ${puzzleNumber(r.from)}-${puzzleNumber(r.to)} · ${short(r.from)} - ${short(r.to)}`;
  }
  return `Week of ${short(r.from)}${r.from === r.to ? "" : ` - week of ${short(r.to)}`}`;
}

export default async function TitlesPage() {
  await ensureCrowned();
  const lines = await Promise.all(BELTS.map(async (b) => ({ belt: b, reigns: reigns(await results(b)) })));

  return (
    <>
      <Bug>
        <Plate tone="dark">Championships</Plate>
      </Bug>
      <main className="wrap">
        <div className="headline" style={{ marginTop: 40 }}>
          <Plate tone="gold">Title histories</Plate>
          <h1 className="chrome" style={{ fontSize: "clamp(52px, 13vw, 84px)", marginTop: 14 }}>
            The belts.
          </h1>
        </div>
        <p className="muted">
          Each game has a daily title and a World Heavyweight title for the best week (Monday to Sunday). When a night or week
          ends, the top <b>signed-in</b> player takes the belt. Win again and it&apos;s a successful defense; lose it and win it
          back, and that&apos;s another reign.
        </p>
        <div className="stack">
          <Link className="cta" href="/">
            <span>Tonight&apos;s card</span>
          </Link>
        </div>

        {lines.map(({ belt, reigns: rs }) => {
          const current = rs[rs.length - 1];
          const counts = new Map<string, { name: string; n: number }>();
          rs.forEach((r) => {
            if (!r.playerId) return;
            const c = counts.get(r.playerId) ?? { name: r.name, n: 0 };
            c.n++;
            c.name = r.name;
            counts.set(r.playerId, c);
          });
          const multi = [...counts.values()].filter((c) => c.n > 1).sort((a, b) => b.n - a.n).slice(0, 5);
          return (
            <section key={belt.id} className="belt">
              <div className="section-head" style={{ marginTop: 34 }}>
                <Plate tone={belt.period === "weekly" ? "gold" : "dark"}>{belt.period === "weekly" ? "Weekly" : "Daily"}</Plate>
              </div>
              <h2 className="chrome belt-name">{belt.name}</h2>
              {current ? (
                <p className="holder">
                  <span className="caps muted">Current champion</span>
                  <span className="num">{current.name}</span>
                  <span className="muted small">
                    {current.defenses > 0 ? `${current.defenses} successful defense${current.defenses > 1 ? "s" : ""}` : "New champion"}
                  </span>
                </p>
              ) : (
                <p className="muted">
                  {belt.period === "daily"
                    ? `The first champion is crowned after card No. ${puzzleNumber(CHAMPIONSHIPS_START)} ends at midnight Eastern.`
                    : `The first champion is crowned when the week ends, Sunday at midnight Eastern.`}
                </p>
              )}
              {multi.length > 0 && <p className="muted small">Most reigns: {multi.map((c) => `${c.name} (${c.n}x)`).join(", ")}</p>}
              {rs.length > 0 && (
                <ol className="lineage" reversed>
                  {[...rs].reverse().map((r) => (
                    <li key={r.number}>
                      <span className="no">{r.number}</span>
                      <span className="who">{r.name}</span>
                      <span className="when">
                        {span(belt, r)}
                        {r.defenses > 0 && ` · ${r.defenses} defense${r.defenses > 1 ? "s" : ""}`}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          );
        })}
        <p className="muted small" style={{ marginTop: 28 }}>
          Championships began with card No. {puzzleNumber(CHAMPIONSHIPS_START)} ({prettyDay(CHAMPIONSHIPS_START)}). Untimed games
          aren&apos;t ranked, so they don&apos;t count toward the Daily Five belts.
        </p>
      </main>
    </>
  );
}
