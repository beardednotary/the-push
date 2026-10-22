import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Bug, Plate } from "@/components/Chrome";
import { datedDay, jsonLd, ringHistory } from "@/lib/archive";
import { ringOverrides } from "@/lib/disputes";
import { MIN_INDEXED, categoryHref, fromSlug, longName, onTonight, ordered, pairHref, pairable, pairsWith, partner } from "@/lib/grid";
import { pageMeta } from "@/lib/meta";
import { wrestlersWith, type Criterion } from "@/lib/ring";

// tonight's squares lock until midnight Eastern
export const dynamic = "force-dynamic";

type Params = { a: string; b: string };

const BASE = "https://playthepush.com";
const SHOWN = 300;

function load({ a, b }: Params): [Criterion, Criterion] {
  const x = fromSlug(a);
  const y = fromSlug(b);
  if (!x || !y || !pairable(x, y)) notFound();
  const [first, second] = ordered(x, y);
  if (first !== x) permanentRedirect(pairHref(x, y));
  return [first, second];
}

const title = (a: Criterion, b: Criterion) => `${longName(a)} × ${longName(b)}`;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const [a, b] = load(await params);
  const count = wrestlersWith([a.id, b.id]).length;
  return pageMeta(
    pairHref(a, b),
    `${title(a, b)}: every wrestler who fits · Wrestling grid`,
    `${count} wrestler${count === 1 ? "" : "s"} fit ${title(a, b)} on a wrestling grid. ${a.detail} ${b.detail} The full list, the rarer picks, and every night it was on the Immaculate Ring.`,
    count < MIN_INDEXED ? { robots: { index: false, follow: true } } : {},
  );
}

export default async function PairPage({ params }: { params: Promise<Params> }) {
  const [a, b] = load(await params);
  const [extra, locked, history] = await Promise.all([ringOverrides(), onTonight(a, b), ringHistory()]);
  const all = wrestlersWith([a.id, b.id], extra);
  if (!all.length) notFound();

  const best = all.slice(0, 6).map((w) => w.name);
  // the least-known quarter of a big list; in a small one (Rumble winners) everyone is famous
  const rare = all.length >= 30 ? all.slice(-Math.min(8, Math.floor(all.length / 4))).reverse() : [];
  const seen = history.filter(({ grid }) =>
    grid.rows.some((r) => grid.cols.some((c) => (r.id === a.id && c.id === b.id) || (r.id === b.id && c.id === a.id))),
  );
  const more = (c: Criterion) =>
    pairsWith(c, MIN_INDEXED)
      .filter((p) => partner(p, c).id !== (c === a ? b : a).id)
      .slice(0, 8);

  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Wrestling grid guide", item: `${BASE}/grid` },
        { "@type": "ListItem", position: 2, name: longName(a), item: `${BASE}${categoryHref(a)}` },
        { "@type": "ListItem", position: 3, name: title(a, b), item: `${BASE}${pairHref(a, b)}` },
      ],
    },
    ...(locked
      ? []
      : [
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: `Which wrestlers fit ${title(a, b)}?`,
                acceptedAnswer: { "@type": "Answer", text: `${best.join(", ")}. ${all.length} wrestlers fit both.` },
              },
            ],
          },
        ]),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <Bug>
        <Plate tone="dark">Grid guide</Plate>
      </Bug>
      <main className="wrap">
        <div className="headline" style={{ marginTop: 40 }}>
          <Plate tone="gold">Wrestling grid guide</Plate>
          <h1 className="chrome" style={{ fontSize: "clamp(40px, 10vw, 68px)", marginTop: 14 }}>
            {title(a, b)}
          </h1>
        </div>
        <p className="muted">
          {all.length} wrestler{all.length === 1 ? "" : "s"} in our archive fit both. The rules, exactly as the Immaculate Ring
          checks them:
        </p>
        <div className="keylist">
          {[a, b].map((c, i) => (
            <div key={c.id} className="key">
              <h2 className="caps">
                <Link className={i ? "c" : "r"} href={categoryHref(c)}>
                  {longName(c)}
                </Link>
              </h2>
              <p>{c.detail}</p>
            </div>
          ))}
        </div>

        {locked ? (
          <>
            <div className="section-head" style={{ marginTop: 30 }}>
              <Plate tone="red">Live tonight</Plate>
            </div>
            <p>
              This square is on tonight&apos;s grid, so its answers stay locked until midnight Eastern. Think you know one?
            </p>
            <Link className="cta" href="/ring">
              <span>Play tonight&apos;s Ring</span>
            </Link>
          </>
        ) : (
          <>
            <div className="section-head" style={{ marginTop: 30 }}>
              <Plate tone="gold">Every answer</Plate>
              <Plate tone="dark">{all.length}</Plate>
            </div>
            <p className="muted small">Best known first.</p>
            <ol className="names">
              {all.slice(0, SHOWN).map((w) => (
                <li key={w.id}>
                  {w.name}
                  {w.aka[0] && <span className="aka">aka {w.aka.slice(0, 2).join(", ")}</span>}
                </li>
              ))}
            </ol>
            {all.length > SHOWN && <p className="muted small">And {all.length - SHOWN} more.</p>}

            {rare.length > 0 && (
              <>
                <div className="section-head" style={{ marginTop: 30 }}>
                  <Plate tone="gold">Rarer picks</Plate>
                </div>
                <p className="muted">
                  The Ring scores rarer answers higher. Deeper cuts that fit:{" "}
                  {rare.map((w) => w.name).join(", ")}.
                </p>
              </>
            )}
          </>
        )}

        {seen.length > 0 && (
          <>
            <div className="section-head" style={{ marginTop: 30 }}>
              <Plate tone="gold">On the Ring</Plate>
              <Plate tone="dark">{seen.length}</Plate>
            </div>
            <ul className="pairlist">
              {seen.map((d) => (
                <li key={d.n}>
                  <Link href={`/ring/answers/${d.n}`}>
                    <span>No. {d.n}</span>
                    <span className="muted">{datedDay(d.day)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        {[a, b].map((c) => {
          const list = more(c);
          return list.length ? (
            <div key={c.id}>
              <div className="section-head" style={{ marginTop: 30 }}>
                <Plate tone="gold">More with {longName(c)}</Plate>
              </div>
              <ul className="pairlist">
                {list.map((p) => (
                  <li key={partner(p, c).id}>
                    <Link href={pairHref(p.a, p.b)}>
                      <span>{longName(partner(p, c))}</span>
                      <span className="num">{p.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null;
        })}

        <Link className="cta" href="/ring" style={{ marginTop: 30 }}>
          <span>Play tonight&apos;s Ring</span>
        </Link>
        <p className="muted small" style={{ marginTop: 16 }}>
          <Link className="gold" href="/grid">
            Every category
          </Link>
        </p>
      </main>
    </>
  );
}
