import type { Metadata } from "next";
import { pageMeta } from "@/lib/meta";
import { puzzleNumber, todayKey } from "@/lib/day";
import { ringCard } from "@/lib/cards";
import RingGame from "../RingGame";

export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMeta("/ring/japan", "Immaculate Ring Japan: the daily puroresu grid · The Push", "The Immaculate Ring for puroresu fans: IWGP, Triple Crown, GHC, G1 Climax and more. New grid every night.");

export default async function RingJapanPage() {
  const day = todayKey();
  const grid = await ringCard(day, "jp");
  const side = ({ id, label, detail }: { id: string; label: string; detail: string }) => ({ id, label, detail });
  return <RingGame key={`jp:${day}`} day={day} number={puzzleNumber(day)} rows={grid.rows.map(side)} cols={grid.cols.map(side)} region="jp" />;
}
