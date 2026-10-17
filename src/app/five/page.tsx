import type { Metadata } from "next";
import { pageMeta } from "@/lib/meta";
import { puzzleNumber, todayKey } from "@/lib/day";
import { publicQuestions } from "@/lib/five";
import FiveGame from "./FiveGame";

export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMeta("/five", "Daily Five · The Push", "Five wrestling questions, fifteen seconds each. A new card every night.");

export default function FivePage() {
  const day = todayKey();
  return <FiveGame key={day} day={day} number={puzzleNumber(day)} questions={publicQuestions(day)} />;
}
