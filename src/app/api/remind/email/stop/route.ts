import { NextResponse } from "next/server";
import { stopEmail } from "@/lib/emailRemind";

// The List-Unsubscribe address in every reminder. Mail apps' unsubscribe buttons POST here
// (one-click); a plain GET (older apps, or a pasted link) unsubscribes and shows the page.
export async function POST(req: Request) {
  await stopEmail(new URL(req.url).searchParams.get("t") ?? "");
  return new NextResponse(null, { status: 200 });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  await stopEmail(url.searchParams.get("t") ?? "");
  return NextResponse.redirect(new URL("/remind?done=off", url));
}
