import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bug, Plate } from "@/components/Chrome";
import { jsonLd } from "@/lib/archive";
import { MIN_INDEXED, categoryHref, fromSlug, longName, pairHref, pairsWith, partner } from "@/lib/grid";
import { pageMeta } from "@/lib/meta";
import { wrestlersWith } from "@/lib/ring";

type Params = { a: string };

const BASE = "https://playthepush.com";
const SHOWN = 120;

function load({ a }: Params) {
  const c = fromSlug(a);
  if (!c) notFound();
  return c;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const c = load(await params);
  const count = wrestlersWith([c.id]).length;
  return pageMeta(
    categoryHref(c),
    `${longName(c)}: every wrestler and grid pairing · Wrestling grid`,
    `${count} wrestlers count as ${longName(c)} on a wrestling grid. ${c.detail} See who fits, and who fits it with every other category.`,
  );
}

export default async function CategoryPage({ params }: { params: Promise<Params> }) {
  const c = load(await params);
  const all = wrestlersWith([c.id]);
  const pairs = pairsWith(c, MIN_INDEXED);
  const ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Wrestling grid guide", item: `${BASE}/grid` },
      { "@type": "ListItem", position: 2, name: longName(c), item: `${BASE}${categoryHref(c)}` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <Bug>
        <Plate tone="dark">Grid guide</Plate>
      </Bug>
      <main className="wrap">
        <div className="headline" style={{ marginTop: 40 }}>
          <Plate tone="gold">Wrestling grid guide</Plate>
          <h1 className="chrome" style={{ fontSize: "clamp(44px, 11vw, 76px)", marginTop: 14 }}>
            {longName(c)}
          </h1>
        </div>
        <div className="keylist">
          <div className="key">
            <h2 className="caps">The rule</h2>
            <p>{c.detail}</p>
          </div>
        </div>

        {pairs.length > 0 && (
          <>
            <div className="section-head" style={{ marginTop: 30 }}>
              <Plate tone="gold">Pairings</Plate>
              <Plate tone="dark">{pairs.length}</Plate>
            </div>
            <p className="muted small">{longName(c)} with every other category, and how many wrestlers fit both.</p>
            <ul className="pairlist">
              {pairs.map((p) => (
                <li key={partner(p, c).id}>
                  <Link href={pairHref(p.a, p.b)}>
                    <span>{longName(partner(p, c))}</span>
                    <span className="num">{p.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="section-head" style={{ marginTop: 30 }}>
          <Plate tone="gold">Who counts</Plate>
          <Plate tone="dark">{all.length}</Plate>
        </div>
        <p className="muted small">{all.length > SHOWN ? `The ${SHOWN} best known.` : "Best known first."}</p>
        <ol className="names">
          {all.slice(0, SHOWN).map((w) => (
            <li key={w.id}>{w.name}</li>
          ))}
        </ol>
        {all.length > SHOWN && <p className="muted small">And {all.length - SHOWN} more.</p>}

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
