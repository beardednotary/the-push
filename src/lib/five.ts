// The Daily Five: five multiple-choice questions, 15 seconds each.
import bank from "../../data/generated/trivia.json";
import { puzzleNumber } from "./day";
import { mulberry32, shuffled } from "./rng";
import { pointsFor } from "./scoring";

export interface Question {
  id: string;
  type: string;
  prompt: string;
  options: string[];
  answer: number;
}
export type PublicQuestion = Omit<Question, "answer">;

const QUESTIONS = bank as Question[];

// Five disjoint buckets, so a day always mixes kinds and nothing repeats until
// its bucket wraps: a marquee moment, a promotion, a title change, two classics.
const ofType = (...types: string[]) => QUESTIONS.filter((q) => types.includes(q.type));
const classics = shuffled(ofType("classic"), mulberry32(0xc1a5));
const BUCKETS: Question[][] = [
  shuffled(ofType("rumble", "wmMain", "wmCity"), mulberry32(0x5ee0)),
  shuffled(ofType("promotion"), mulberry32(0x5ee1)),
  shuffled(ofType("lineage"), mulberry32(0x5ee2)),
  classics.filter((_, i) => i % 2 === 0),
  classics.filter((_, i) => i % 2 === 1),
];

export function questionsFor(day: string): Question[] {
  const n = puzzleNumber(day);
  return BUCKETS.map((b) => b[((n % b.length) + b.length) % b.length]);
}

export function publicQuestions(day: string): PublicQuestion[] {
  return questionsFor(day).map(({ answer: _answer, ...q }) => q);
}

export interface FiveAnswer {
  choice: number | null; // null = time ran out
  ms: number;
}

export function scoreFive(day: string, answers: FiveAnswer[]): { score: number; correct: boolean[] } {
  const qs = questionsFor(day);
  const correct = qs.map((q, i) => answers[i]?.choice === q.answer);
  const score = qs.reduce((sum, _q, i) => sum + pointsFor(correct[i], Number(answers[i]?.ms) || 0), 0);
  return { score, correct };
}
