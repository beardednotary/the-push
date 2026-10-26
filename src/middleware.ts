import { NextResponse, type NextRequest } from "next/server";
import { COUNTRY_COOKIE } from "@/lib/consent";

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
  const res = NextResponse.next();
  // the visitor's country, for the analytics consent banner (shown in the EEA, UK and
  // Switzerland only). Readable by the page; not a tracking cookie.
  const country = req.headers.get("x-vercel-ip-country");
  if (country && req.cookies.get(COUNTRY_COOKIE)?.value !== country) {
    res.cookies.set(COUNTRY_COOKIE, country, { path: "/", maxAge: 60 * 60 * 24, sameSite: "lax", secure: true });
  }
  return res;
}

// api/cron is skipped: Vercel Cron may call the deployment's own host and doesn't follow redirects
export const config = { matcher: "/((?!_next/static|_next/image|api/cron).*)" };
