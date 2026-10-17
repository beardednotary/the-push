import type { Metadata } from "next";
import { pageMeta } from "@/lib/meta";
import { puzzleNumber, todayKey } from "@/lib/day";
import { ringCard } from "@/lib/cards";
import RingGame from "./RingGame";

export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMeta("/ring", "Immaculate Ring · The Push", "Nine squares, nine guesses: name a wrestler who fits the row and the column. New grid every night.");

export default async function RingPage() {
  const day = todayKey();
  const grid = await ringCard(day);
  const side = ({ id, label, detail }: { id: string; label: string; detail: string }) => ({ id, label, detail });
  return <RingGame key={day} day={day} number={puzzleNumber(day)} rows={grid.rows.map(side)} cols={grid.cols.map(side)} />;
}
