import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bug, Plate } from "@/components/Chrome";
import { DayNav, FiveAnswers } from "@/components/Replay";
import { datedDay, jsonLd, parseNumber, pastDay, pastFive } from "@/lib/archive";
import { puzzleNumber, todayKey } from "@/lib/day";
import { pageMeta } from "@/lib/meta";
import { readStats } from "@/lib/stats";

// which numbers exist moves at midnight Eastern
export const dynamic = "force-dynamic";

type Params = { n: string };

async function load(raw: string) {
  const past = pastDay(parseNumber(raw));
  if (!past) notFound();
  return { ...past, questions: await pastFive(past.day) };
}

const clip = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`);

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { n, day, questions } = await load((await params).n);
  const answers = questions.map((q) => q.options[q.answer]).join(", ");
  return pageMeta(
    `/five/answers/${n}`,
    `Daily Five No. ${n} answers: ${clip(questions[0].prompt, 60)}`,
    clip(`Answers to Daily Five No. ${n} (${datedDay(day)}), five wrestling trivia questions: ${answers}. Every question, every option, and how players did.`, 300),
  );
}

export default async function FiveAnswersPage({ params }: { params: Promise<Params> }) {
  const { n, day, questions } = await load((await params).n);
  const stats = await readStats(day);
  const last = puzzleNumber(todayKey()) - 1;
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    name: `Daily Five No. ${n} answers`,
    mainEntity: questions.map((q) => ({
      "@type": "Question",
      name: q.prompt,
      acceptedAnswer: { "@type": "Answer", text: q.options[q.answer] },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faq) }} />
      <Bug>
        <Plate tone="dark">Five · No. {n}</Plate>
      </Bug>
      <main className="wrap">
        <div className="headline" style={{ marginTop: 40 }}>
          <Plate tone="gold">
            Daily Five No. {n} · {datedDay(day)}
          </Plate>
          <h1 className="chrome" style={{ fontSize: "clamp(52px, 13vw, 84px)", marginTop: 14 }}>
            The answers.
          </h1>
        </div>
        <p className="muted">
          All five questions from card No. {n}, the right answers, and how the room voted. Tonight&apos;s five are
          already live.
        </p>
        <Link className="cta" href="/five">
          <span>Play today&apos;s Five</span>
        </Link>

        <div className="section-head" style={{ marginTop: 34 }}>
          <Plate tone="gold">Daily Five</Plate>
          <Plate tone="dark">Answers</Plate>
        </div>
        <FiveAnswers questions={questions} stats={stats} />
        <p className="muted" style={{ fontSize: 15 }}>
          Same night&apos;s main event: <Link className="gold" href={`/ring/answers/${n}`}>Immaculate Ring No. {n} answers</Link>
        </p>
        <DayNav game="five" n={n} last={last} />
      </main>
    </>
  );
}
