import type { Metadata } from "next";
import Link from "next/link";
import { Bug, Plate } from "@/components/Chrome";
import { categoryHref, longName } from "@/lib/grid";
import { pageMeta } from "@/lib/meta";
import { allCriteria, type Criterion } from "@/lib/ring";

export const metadata: Metadata = pageMeta(
  "/grid",
  "Wrestling grid guide: every category and who fits · The Push",
  "Stuck on a wrestling grid square? Every Immaculate Ring category, its exact rule, and every wrestler who fits each pair of categories.",
);

const GROUPS: [string, string][] = [
  ["promotion", "Promotions"],
  ["title", "Championships"],
  ["accolade", "Accolades"],
  ["match", "Match types"],
  ["era", "Eras"],
  ["faction", "Factions"],
  ["life", "Outside the ring"],
  ["name", "Names"],
  ["place", "Birthplace"],
];

export default function GridGuide() {
  const byGroup = new Map<string, Criterion[]>();
  for (const c of allCriteria()) byGroup.set(c.group, [...(byGroup.get(c.group) ?? []), c]);

  return (
    <>
      <Bug>
        <Plate tone="dark">Grid guide</Plate>
      </Bug>
      <main className="wrap">
        <div className="headline" style={{ marginTop: 40 }}>
          <Plate tone="gold">Every category</Plate>
          <h1 className="chrome" style={{ fontSize: "clamp(52px, 13vw, 84px)", marginTop: 14 }}>
            The grid guide.
          </h1>
        </div>
        <p className="muted">
          Every category the Immaculate Ring uses, the exact rule for each, and who fits every pairing. Squares on
          tonight&apos;s grid stay locked until midnight Eastern.
        </p>
        <Link className="cta" href="/ring">
          <span>Play tonight&apos;s Ring</span>
        </Link>

        {GROUPS.filter(([g]) => byGroup.has(g)).map(([g, name]) => (
          <div key={g}>
            <div className="section-head" style={{ marginTop: 30 }}>
              <Plate tone="gold">{name}</Plate>
            </div>
            <ul className="pairlist">
              {byGroup.get(g)!.map((c) => (
                <li key={c.id}>
                  <Link href={categoryHref(c)}>
                    <span>{longName(c)}</span>
                    <span className="num">{c.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </main>
    </>
  );
}
