import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bug, Plate } from "@/components/Chrome";
import { DayNav, RingBoard, RingKey } from "@/components/Replay";
import { datedDay, jsonLd, parseNumber, pastDay, pastRing } from "@/lib/archive";
import { puzzleNumber, todayKey } from "@/lib/day";
import { pageMeta } from "@/lib/meta";
import { ringPicks } from "@/lib/picks";

// which numbers exist moves at midnight Eastern
export const dynamic = "force-dynamic";

type Params = { n: string };

async function load(raw: string) {
  const past = pastDay(parseNumber(raw));
  if (!past) notFound();
  const grid = await pastRing(past.day);
  return { ...past, grid };
}

const labels = (cs: { label: string }[]) => cs.map((c) => c.label).join(", ");

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { n, day, grid } = await load((await params).n);
  return pageMeta(
    `/ring/answers/${n}`,
    `Immaculate Ring No. ${n} answers: ${grid.rows[0].label} × ${grid.cols[0].label} …`,
    `Every answer to Immaculate Ring No. ${n} (${datedDay(day)}), the daily wrestling grid. Rows: ${labels(grid.rows)}. Columns: ${labels(grid.cols)}. Most-picked wrestlers for all nine squares.`,
  );
}

export default async function RingAnswersPage({ params }: { params: Promise<Params> }) {
  const { n, day, grid } = await load((await params).n);
  const picks = await ringPicks(day, grid, 8);
  const last = puzzleNumber(todayKey()) - 1;
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    name: `Immaculate Ring No. ${n} answers`,
    mainEntity: grid.rows.flatMap((r, ri) =>
      grid.cols.map((c, ci) => {
        const p = picks[ri * 3 + ci];
        const names = [...new Set([...p.top.map((t) => t.name), ...p.examples])].slice(0, 6);
        return {
          "@type": "Question",
          name: `Which wrestlers fit ${r.label} × ${c.label}?`,
          acceptedAnswer: {
            "@type": "Answer",
            text: `${names.join(", ")}. ${p.possible} wrestlers counted for this square.`,
          },
        };
      }),
    ),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faq) }} />
      <Bug>
        <Plate tone="dark">Ring · No. {n}</Plate>
      </Bug>
      <main className="wrap">
        <div className="headline" style={{ marginTop: 40 }}>
          <Plate tone="gold">
            Immaculate Ring No. {n} · {datedDay(day)}
          </Plate>
          <h1 className="chrome" style={{ fontSize: "clamp(52px, 13vw, 84px)", marginTop: 14 }}>
            The answers.
          </h1>
        </div>
        <p className="muted">
          Every right answer for all nine squares of card No. {n}, and who the room picked. Tonight&apos;s grid is
          already live.
        </p>
        <Link className="cta" href="/ring">
          <span>Play today&apos;s Ring</span>
        </Link>

        <div className="section-head" style={{ marginTop: 34 }}>
          <Plate tone="gold">The grid</Plate>
          <Plate tone="dark">Top pick per square</Plate>
        </div>
        <RingBoard grid={grid} picks={picks} />

        <div className="section-head" style={{ marginTop: 30 }}>
          <Plate tone="gold">Answer key</Plate>
          <Plate tone="dark">All nine squares</Plate>
        </div>
        <RingKey grid={grid} picks={picks} />
        <p className="muted" style={{ fontSize: 15 }}>
          Same night&apos;s opener: <Link className="gold" href={`/five/answers/${n}`}>Daily Five No. {n} answers</Link>
        </p>
        <DayNav game="ring" n={n} last={last} />
      </main>
    </>
  );
}
