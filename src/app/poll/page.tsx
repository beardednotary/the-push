import type { Metadata } from "next";
import Link from "next/link";
import { Bug, Plate } from "@/components/Chrome";
import { Poll } from "@/components/Poll";
import { todayKey } from "@/lib/day";
import { pageMeta } from "@/lib/meta";
import { pollFor } from "@/lib/polls";

// the shared link: always tonight's poll, which changes at midnight Eastern
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const poll = await pollFor(todayKey());
  return pageMeta(
    "/poll",
    poll ? `${poll.question} · Poll of the night · The Push` : "Poll of the night · The Push",
    poll ? `Tonight's wrestling fan poll: ${poll.question} ${poll.options.join(", ")}, or write in your own. Vote and see how everyone picked.` : "A wrestling fan poll every night. Vote and see how everyone picked.",
  );
}

export default function PollPage() {
  return (
    <>
      <Bug>
        <Plate tone="dark">Poll</Plate>
      </Bug>
      <main className="wrap">
        <div className="headline" style={{ marginTop: 40 }}>
          <Plate tone="gold">Tonight on The Push</Plate>
          <h1 className="chrome" style={{ fontSize: "clamp(52px, 13vw, 84px)", marginTop: 14 }}>
            Cast your vote.
          </h1>
        </div>
        <Poll />
        <p className="muted">Then play tonight&apos;s card: three daily wrestling games, new every night at midnight Eastern.</p>
        <Link className="cta" href="/">
          <span>Tonight&apos;s card</span>
        </Link>
      </main>
    </>
  );
}
