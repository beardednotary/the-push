import { NextResponse } from "next/server";
import { sendReminders } from "@/lib/push";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel Cron calls this once a day (vercel.json) with "Authorization: Bearer $CRON_SECRET".
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await sendReminders());
}
