import type { Metadata } from "next";
import { pageMeta } from "@/lib/meta";
import { puzzleNumber, todayKey } from "@/lib/day";
import WordleGame from "./WordleGame";

export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMeta(
  "/wordle",
  "Wrestling Wordle: guess the wrestler · The Push",
  "Guess the mystery wrestler in eight tries. Every guess shows promotions, era, world titles and more. New wrestler every night.",
);

// the answer never ships with the page: guesses are checked by /api/wordle/guess
export default function WordlePage() {
  const day = todayKey();
  return <WordleGame key={day} day={day} number={puzzleNumber(day)} />;
}
