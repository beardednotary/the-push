import Link from "next/link";
import { Bug, Plate } from "@/components/Chrome";
import { prettyDay, puzzleNumber, todayKey } from "@/lib/day";

export const dynamic = "force-dynamic";

export default function Home() {
  const day = todayKey();
  return (
    <>
      <Bug>
        <Plate tone="dark">No. {puzzleNumber(day)}</Plate>
      </Bug>
      <main className="wrap">
        <div className="headline">
          <Plate tone="gold">Tonight&apos;s card · {prettyDay(day)}</Plate>
          <h1 className="chrome" style={{ marginTop: 14 }}>
            Two matches.
            <br />
            One night.
          </h1>
        </div>

        <section className="segment">
          <div className="meta">
            <Plate tone="dark">Opening contest</Plate>
            <Plate tone="clock">2:00</Plate>
          </div>
          <h2 className="chrome">Daily Five</h2>
          <p>Five wrestling questions, fifteen seconds each. Right answers score. Fast right answers score more.</p>
          <Link className="cta" href="/five">
            <span>Ring the bell</span>
          </Link>
        </section>

        <section className="segment">
          <div className="meta">
            <Plate tone="dark">Main event</Plate>
            <Plate tone="clock">5:00</Plate>
          </div>
          <h2 className="chrome">Immaculate Ring</h2>
          <p>Nine squares, nine guesses. Name a wrestler who fits the row and the column. Rare picks rank higher.</p>
          <Link className="cta" href="/ring">
            <span>Ring the bell</span>
          </Link>
        </section>
      </main>
    </>
  );
}
