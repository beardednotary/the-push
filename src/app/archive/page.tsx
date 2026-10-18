import type { Metadata } from "next";
import Link from "next/link";
import { Bug, Plate } from "@/components/Chrome";
import { datedDay, jsonLd, pastDays } from "@/lib/archive";
import { pageMeta } from "@/lib/meta";

// a new card joins the archive at midnight Eastern
export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMeta(
  "/archive",
  "Every past card: Immaculate Ring and Daily Five answers · The Push",
  "The full archive of The Push: answers to every past Immaculate Ring wrestling grid and every Daily Five trivia card, one page per night.",
);

const BASE = "https://playthepush.com";

export default function ArchivePage() {
  const days = pastDays();
  const list = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "The Push answer archive",
    itemListElement: days.flatMap((d, i) => [
      { "@type": "ListItem", position: 2 * i + 1, name: `Immaculate Ring No. ${d.n} answers`, url: `${BASE}/ring/answers/${d.n}` },
      { "@type": "ListItem", position: 2 * i + 2, name: `Daily Five No. ${d.n} answers`, url: `${BASE}/five/answers/${d.n}` },
    ]),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(list) }} />
      <Bug>
        <Plate tone="dark">Archive</Plate>
      </Bug>
      <main className="wrap">
        <div className="headline" style={{ marginTop: 40 }}>
          <Plate tone="gold">Every past card</Plate>
          <h1 className="chrome" style={{ fontSize: "clamp(52px, 13vw, 84px)", marginTop: 14 }}>
            The tape library.
          </h1>
        </div>
        <p className="muted">
          Answers to every Immaculate Ring and Daily Five since the first bell. Tonight&apos;s card stays off the shelf
          until midnight Eastern.
        </p>
        <Link className="cta" href="/">
          <span>Tonight&apos;s card</span>
        </Link>

        <div className="section-head" style={{ marginTop: 34 }}>
          <Plate tone="gold">Past cards</Plate>
          <Plate tone="dark">{days.length}</Plate>
        </div>
        {days.length ? (
          <ol className="archive-list" reversed>
            {days.map((d) => (
              <li key={d.n}>
                <span className="no">{d.n}</span>
                <span className="when">{datedDay(d.day)}</span>
                <span className="links">
                  <Link href={`/ring/answers/${d.n}`}>
                    <b>Immaculate Ring</b> No. {d.n} answers
                  </Link>
                  <Link href={`/five/answers/${d.n}`}>
                    <b>Daily Five</b> No. {d.n} answers
                  </Link>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">The first card is still live. Its answers land here after midnight Eastern.</p>
        )}
      </main>
    </>
  );
}
