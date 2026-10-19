import { NextResponse } from "next/server";
import { postDaily } from "@/lib/discord";
import { factCheckPosts, postFactCheck } from "@/lib/factcheck";

export const dynamic = "force-dynamic";

// The morning Discord post rides along with the daily reminder cron; this route is for
// manual sends ("Authorization: Bearer $CRON_SECRET", ?force=1 to post again today).
// ?factcheck=1 sends tomorrow's grid review instead; ?factcheck=preview returns it without posting.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const params = new URL(req.url).searchParams;
  const force = params.get("force") === "1";
  if (params.get("factcheck") === "preview") return NextResponse.json({ posts: await factCheckPosts() });
  if (params.get("factcheck") === "1") return NextResponse.json(await postFactCheck({ force }));
  return NextResponse.json(await postDaily({ force }));
}
