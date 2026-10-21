import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bug, Plate } from "@/components/Chrome";
import { DayNav } from "@/components/Replay";
import { datedDay, jsonLd, parseNumber, pastDay } from "@/lib/archive";
import { puzzleNumber, todayKey } from "@/lib/day";
import { pageMeta } from "@/lib/meta";
import { WORDLE_LAUNCH, clueRow, hadWordle, pastWordle, profileLines } from "@/lib/wordle";
import { ClueHeads, ClueRow } from "../../Clues";

// which numbers exist moves at midnight Eastern
export const dynamic = "force-dynamic";

type Params = { n: string };

async function load(raw: string) {
  const past = pastDay(parseNumber(raw));
  if (!past || !hadWordle(past.day)) notFound();
  return { ...past, answer: await pastWordle(past.day) };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { n, day, answer } = await load((await params).n);
  return pageMeta(
    `/wordle/answers/${n}`,
    `Wrestling Wordle No. ${n} answer: ${answer.name} · The Push`,
    `The answer to Wrestling Wordle No. ${n} (${datedDay(day)}) was ${answer.name}. See the clues: promotions, era, world titles, Rumble and main events, faction.`,
  );
}

export default async function WordleAnswerPage({ params }: { params: Promise<Params> }) {
  const { n, day, answer } = await load((await params).n);
  const last = puzzleNumber(todayKey()) - 1;
  const facts = profileLines(answer, day);
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    name: `Wrestling Wordle No. ${n} answer`,
    mainEntity: [
      {
        "@type": "Question",
        name: `Who was the Wrestling Wordle answer on ${datedDay(day)}?`,
        acceptedAnswer: { "@type": "Answer", text: `${answer.name}. ${facts.join(". ")}.` },
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faq) }} />
      <Bug>
        <Plate tone="dark">Wordle · No. {n}</Plate>
      </Bug>
      <main className="wrap">
        <div className="headline" style={{ marginTop: 40 }}>
          <Plate tone="gold">
            Wrestling Wordle No. {n} · {datedDay(day)}
          </Plate>
          <h1 className="chrome" style={{ fontSize: "clamp(52px, 13vw, 84px)", marginTop: 14 }}>
            {answer.name}.
          </h1>
        </div>
        <p className="muted">The mystery wrestler for card No. {n}. Tonight&apos;s is already live.</p>
        <Link className="cta" href="/wordle">
          <span>Play today&apos;s Wordle</span>
        </Link>

        <div className="section-head" style={{ marginTop: 34 }}>
          <Plate tone="gold">The clues</Plate>
        </div>
        <div className="wd-board wd-answer">
          <ClueHeads />
          <ClueRow row={clueRow(answer, answer, day)} label="The answer" />
        </div>
        <ul className="rules">
          {facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <p className="muted" style={{ fontSize: 15 }}>
          Same night: <Link className="gold" href={`/ring/answers/${n}`}>Immaculate Ring No. {n} answers</Link>
        </p>
        <DayNav game="wordle" n={n} last={last} first={puzzleNumber(WORDLE_LAUNCH)} />
      </main>
    </>
  );
}
