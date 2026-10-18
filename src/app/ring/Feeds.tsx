import Link from "next/link";
import { Plate } from "@/components/Chrome";
import { REGIONS, type Region } from "@/lib/regions";

/** Switch between the main Ring and the region Rings, like changing the broadcast feed. */
export function Feeds({ region }: { region?: Region }) {
  const feeds = [{ href: "/ring", name: "Main card", on: !region }, ...(Object.keys(REGIONS) as Region[]).map((r) => ({ href: `/ring/${REGIONS[r].slug}`, name: REGIONS[r].name, on: r === region }))];
  return (
    <nav className="feeds" aria-label="Choose a Ring">
      {feeds.map((f) => (
        <Link key={f.href} href={f.href} aria-current={f.on ? "page" : undefined}>
          <Plate tone={f.on ? "gold" : "dark"}>{f.name}</Plate>
        </Link>
      ))}
    </nav>
  );
}
