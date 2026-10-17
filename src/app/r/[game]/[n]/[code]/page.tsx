import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bug, Plate } from "@/components/Chrome";
import { puzzleNumber, todayKey } from "@/lib/day";
import { MARK_COLOR, headline, parseResult } from "@/lib/share";

export const dynamic = "force-dynamic";

type Params = { game: string; n: string; code: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = await params;
  const r = parseResult(p.game, p.n, p.code);
  if (!r) return {};
  const title = `${headline(r)}. Can you beat it?`;
  const description = "The Push: daily wrestling trivia. New card every night.";
  return {
    title,
    description,
    robots: { index: false, follow: true },
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SharedResultPage({ params }: { params: Promise<Params> }) {
  const p = await params;
  const r = parseResult(p.game, p.n, p.code);
  if (!r) notFound();
  const tonight = puzzleNumber(todayKey());
  const name = r.game === "five" ? "Daily Five" : "Immaculate Ring";
  const other = r.game === "five" ? { href: "/ring", name: "Immaculate Ring" } : { href: "/five", name: "Daily Five" };

  return (
    <>
      <Bug>
        <Plate tone="dark">Result</Plate>
      </Bug>
      <main className="wrap">
        <div className="final">
          <Plate tone="gold">
            {name} · No. {r.number}
          </Plate>
          {r.game === "five" ? (
            <>
              <div className="num score">{r.score}</div>
              <div className="sub">out of 1000</div>
              <div className="marks" aria-label="Question by question">
                {r.marks.map((m, i) => (
                  <i key={i} style={{ background: MARK_COLOR[m] }} />
                ))}
              </div>
            </>
          ) : (
            <div className="ring-result">
              <div className="minigrid" aria-label="Squares filled">
                {r.cells.map((c, i) => (
                  <i key={i} className={c ? "on" : ""} />
                ))}
              </div>
              <div>
                <div className="num score">{r.squares}/9</div>
                <div className="sub">Rarity {r.rarity} · lower is rarer</div>
              </div>
            </div>
          )}
        </div>

        <div className="upnext">
          <Plate tone="red">Your turn</Plate>
          <h1 className="chrome">Can you beat it?</h1>
          <p>
            {r.number === tonight
              ? `Same card, same questions. Tonight's ${name} is still live.`
              : `That was card No. ${r.number}. Tonight's card is No. ${tonight}.`}
          </p>
          <Link className="cta" href={`/${r.game}`}>
            <span>Ring the bell</span>
          </Link>
        </div>
        <p className="muted center" style={{ marginTop: 18 }}>
          Also on tonight&apos;s card: <Link href={other.href}>{other.name}</Link>
        </p>
      </main>
    </>
  );
}
