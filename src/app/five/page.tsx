import type { Metadata } from "next";
import { puzzleNumber, todayKey } from "@/lib/day";
import { publicQuestions } from "@/lib/five";
import FiveGame from "./FiveGame";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Daily Five · The Push" };

export default function FivePage() {
  const day = todayKey();
  return <FiveGame key={day} day={day} number={puzzleNumber(day)} questions={publicQuestions(day)} />;
}
