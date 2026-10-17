import { NextResponse, type NextRequest } from "next/server";

// One public address. Production visitors on any other host (the old
// *.vercel.app alias) are sent to playthepush.com, so every shared link uses it.
// Preview deployments keep their own URLs.
const CANONICAL = "playthepush.com";

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  if (process.env.VERCEL_ENV === "production" && host !== CANONICAL) {
    const url = req.nextUrl.clone();
    url.protocol = "https";
    url.host = CANONICAL;
    url.port = "";
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

// api/cron is skipped: Vercel Cron may call the deployment's own host and doesn't follow redirects
export const config = { matcher: "/((?!_next/static|_next/image|api/cron).*)" };
