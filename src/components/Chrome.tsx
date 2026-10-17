import Link from "next/link";

type Tone = "white" | "red" | "gold" | "dark" | "clock";

export function Plate({ tone, children, className = "" }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={`plate ${tone} ${className}`}>
      <span>{children}</span>
    </span>
  );
}

/** Top-left score bug: logo, LIVE, and a context plate (issue number or clock). */
export function Bug({ children }: { children?: React.ReactNode }) {
  return (
    <header className="wrap bug">
      <Link href="/" aria-label="The Push home">
        <Plate tone="white">THE PUSH</Plate>
      </Link>
      <Plate tone="red">
        <i className="dot" aria-hidden /> Live
      </Plate>
      {children}
    </header>
  );
}

export function Ticker() {
  const items = (
    <>
      <Link href="/five">Opening contest · Daily Five · 5 questions, 15 seconds each</Link>
      <Link href="/ring">Main event · Immaculate Ring · 9 squares, 9 guesses</Link>
      <Link href="/titles">Championships · Daily and weekly belts for both games</Link>
      <Link href="/yesterday">Post-show · Yesterday&apos;s answers and the Ring answer key</Link>
      <span>New card every night at midnight Eastern</span>
    </>
  );
  return (
    <div className="ticker" role="marquee" aria-label="Tonight on The Push">
      <span className="tag">Tonight</span>
      <span className="crawl">
        {items}
        {items}
      </span>
    </div>
  );
}
