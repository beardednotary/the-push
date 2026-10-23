import type { Metadata } from "next";
import Link from "next/link";
import { Bug, Plate } from "@/components/Chrome";
import { datedDay } from "@/lib/archive";
import { pageMeta } from "@/lib/meta";
import { pastPolls } from "@/lib/polls";

// a poll joins the archive at midnight Eastern
export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMeta(
  "/polls",
  "Wrestling polls: every Poll of the night and how fans voted · The Push",
  "Best wrestling movie, greatest WrestleMania match, best finisher: every nightly fan poll on The Push and how the votes fell.",
);

export default async function PollsPage() {
  const polls = await pastPolls();
  return (
    <>
      <Bug>
        <Plate tone="dark">Polls</Plate>
      </Bug>
      <main className="wrap">
        <div className="headline" style={{ marginTop: 40 }}>
          <Plate tone="gold">Poll of the night</Plate>
          <h1 className="chrome" style={{ fontSize: "clamp(52px, 13vw, 84px)", marginTop: 14 }}>
            The fans have spoken.
          </h1>
        </div>
        <p className="muted">One question a night, one vote each. Tonight&apos;s poll is on the home page and after every game.</p>
        <Link className="cta" href="/">
          <span>Vote tonight</span>
        </Link>

        {polls.length ? (
          <ol className="replay" style={{ marginTop: 30 }}>
            {polls.map(({ poll, counts }) => {
              const total = counts.reduce((a, b) => a + b, 0);
              const pct = (n: number) => (total ? Math.round((100 * n) / total) : 0);
              const top = Math.max(...counts);
              return (
                <li key={poll.day}>
                  <p className="muted small">
                    No. {poll.n} · {datedDay(poll.day)} · {total} vote{total === 1 ? "" : "s"}
                  </p>
                  <h2 className="q">{poll.question}</h2>
                  {poll.options.map((o, i) => (
                    <div key={i} className={`opt${total && counts[i] === top ? " right" : ""}`}>
                      <i style={{ width: `${pct(counts[i])}%` }} />
                      <span>{o}</span>
                      {total > 0 && <span className="pct">{pct(counts[i])}%</span>}
                    </div>
                  ))}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="muted" style={{ marginTop: 30 }}>
            The first poll is still open. Its results land here after midnight Eastern.
          </p>
        )}
      </main>
    </>
  );
}
