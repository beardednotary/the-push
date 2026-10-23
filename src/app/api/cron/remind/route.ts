import { NextResponse } from "next/server";
import { postDaily } from "@/lib/discord";
import { postFactCheck } from "@/lib/factcheck";
import { submitLastNight } from "@/lib/indexnow";
import { sendReminders } from "@/lib/push";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel Cron calls this once a day (vercel.json) with "Authorization: Bearer $CRON_SECRET".
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const force = new URL(req.url).searchParams.get("force") === "1"; // manual test sends
  // the morning Discord post goes out with the reminders (once a day; see /api/cron/discord)
  const discord = await postDaily().catch((e) => ({ posted: false, reason: String(e) }));
  // and tomorrow's grids go to the fact-checkers' private channel
  const factcheck = await postFactCheck().catch((e) => ({ posted: false, reason: String(e) }));
  // and last night's answer pages go to Bing through IndexNow
  const indexnow = await submitLastNight().catch((e) => ({ submitted: false, reason: String(e) }));
  return NextResponse.json({ ...(await sendReminders({ force })), discord, factcheck, indexnow });
}
