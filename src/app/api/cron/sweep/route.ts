import { NextResponse } from "next/server";
import { collectSweep, submitSweep, sweepFindings } from "@/lib/sweep";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// The one-time Wikidata sweep (lib/sweep.ts), run by hand with "Authorization: Bearer $CRON_SECRET":
// ?do=submit sends the batch, ?do=collect reads finished results (call until all are in),
// ?do=findings lists what was found. Not on the cron schedule. Remove after the review.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const action = new URL(req.url).searchParams.get("do");
  if (action === "submit") return NextResponse.json(await submitSweep());
  if (action === "collect") return NextResponse.json(await collectSweep());
  if (action === "findings") return NextResponse.json(await sweepFindings());
  return NextResponse.json({ error: "use ?do=submit, collect or findings" }, { status: 400 });
}
