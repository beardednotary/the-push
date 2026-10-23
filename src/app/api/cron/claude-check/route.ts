import { NextResponse } from "next/server";
import { checkTomorrow } from "@/lib/claudecheck";
import { isGuess } from "@/lib/factcheck";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // one Claude pass per grid, with web search, run side by side

// Vercel Cron calls this daily at 13:30 UTC (vercel.json), half an hour before the fact-check
// post goes out with the reminder cron, with "Authorization: Bearer $CRON_SECRET".
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await checkTomorrow(isGuess));
}
