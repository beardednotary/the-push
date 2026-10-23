import Link from "next/link";
import { Bug, Plate } from "@/components/Chrome";
import { Poll } from "@/components/Poll";
import { jsonLd } from "@/lib/archive";
import { prettyDay, puzzleNumber, todayKey } from "@/lib/day";
import { SITE_DESCRIPTION } from "@/lib/meta";

export const dynamic = "force-dynamic";

const SITE = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "The Push",
  alternateName: "Play The Push",
  url: "https://playthepush.com/",
  description: SITE_DESCRIPTION,
  publisher: { "@type": "Organization", name: "DahVio Studios", url: "https://dahvio.com" },
};

export default function Home() {
  const day = todayKey();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(SITE) }} />
      <section className="hero">
        <picture>
          <source media="(min-width: 700px)" srcSet="/hero-wide.jpg" />
          <img src="/hero-tall.jpg" alt="A wrestler walks out through the curtain into a packed arena" fetchPriority="high" />
        </picture>
        <div className="hero-shade" aria-hidden />
        <div className="hero-top">
          <Bug>
            <Plate tone="dark">No. {puzzleNumber(day)}</Plate>
          </Bug>
        </div>
        <div className="hero-copy wrap">
          <Plate tone="gold">Tonight&apos;s card · {prettyDay(day)}</Plate>
          <h1 className="chrome">
            Two matches.
            <br />
            One night.
          </h1>
          <p>Daily wrestling trivia. A new card drops every night at midnight Eastern.</p>
          <Link className="cta" href="/five">
            <span>Ring the bell</span>
          </Link>
        </div>
      </section>
      <main className="wrap">
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
        <section className="segment">
          <div className="meta">
            <Plate tone="dark">Dark match</Plate>
            <Plate tone="red">New</Plate>
          </div>
          <h2 className="chrome">Wrestling Wordle</h2>
          <p>One mystery wrestler, eight guesses. Every guess shows promotions, era, world titles and more. Fewer guesses ranks higher.</p>
          <Link className="cta" href="/wordle">
            <span>Ring the bell</span>
          </Link>
        </section>
        <Poll />
        <section className="segment">
          <div className="meta">
            <Plate tone="dark">Stable wars</Plate>
          </div>
          <h2 className="chrome">Friend leagues</h2>
          <p>Start a league and drop the link in your group chat. Your crew gets its own nightly standings and its own belt.</p>
          <Link className="cta" href="/league">
            <span>Start a league</span>
          </Link>
        </section>
        <section className="segment">
          <div className="meta">
            <Plate tone="dark">Post-show</Plate>
          </div>
          <h2 className="chrome">Yesterday&apos;s card</h2>
          <p>
            The answers, how everyone did, and the full Immaculate Ring answer key. Older cards live in{" "}
            <Link href="/archive" style={{ color: "var(--gold)" }}>the archive</Link>.
          </p>
          <Link className="cta ghost" href="/yesterday">
            <span>See the replay</span>
          </Link>
        </section>
        <section className="segment">
          <div className="meta">
            <Plate tone="gold">Championships</Plate>
          </div>
          <h2 className="chrome">The belts</h2>
          <p>Win the night or win the week. Daily and World Heavyweight titles for both games, with full title histories.</p>
          <Link className="cta ghost" href="/titles">
            <span>See the champions</span>
          </Link>
        </section>
      </main>
    </>
  );
}
