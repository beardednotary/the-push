import { NextResponse } from "next/server";
import { searchWrestlers } from "@/lib/ring";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return NextResponse.json(searchWrestlers(q.slice(0, 40)), {
    headers: { "Cache-Control": "public, s-maxage=86400" },
  });
}
