import { NextResponse } from "next/server";
import { postDaily } from "@/lib/discord";

export const dynamic = "force-dynamic";

// The morning Discord post rides along with the daily reminder cron; this route is for
// manual sends ("Authorization: Bearer $CRON_SECRET", ?force=1 to post again today).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const force = new URL(req.url).searchParams.get("force") === "1";
  return NextResponse.json(await postDaily({ force }));
}
