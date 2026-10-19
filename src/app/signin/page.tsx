import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn, signInEnabled, signInOptions } from "@/auth";
import { Bug, Plate } from "@/components/Chrome";
import { safeNext } from "@/lib/redirect";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in · The Push", robots: { index: false } };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string; callbackUrl?: string }> }) {
  const { sent, error, callbackUrl } = await searchParams;
  // where to land afterwards: a same-site path only (see safeNext), else the account page
  const next = safeNext(callbackUrl);
  if ((await auth())?.user) redirect(next);

  return (
    <>
      <Bug>
        <Plate tone="dark">Sign in</Plate>
      </Bug>
      <main className="wrap">
        <div className="headline" style={{ marginTop: 40 }}>
          <Plate tone="gold">Optional</Plate>
          <h1 className="chrome" style={{ fontSize: "clamp(52px, 13vw, 84px)", marginTop: 14 }}>
            Keep your record.
          </h1>
        </div>
        <p className="muted">Your scores, ring name and reminders follow you to every device. Playing stays free without an account.</p>

        {!signInEnabled && <p className="miss">Sign-in isn&apos;t switched on yet. Check back soon.</p>}
        {sent && (
          <div className="remind">
            <Plate tone="gold">Check your email</Plate>
            <p>
              <b>We sent you a sign-in link.</b> Open it on this device. It expires in 24 hours.
            </p>
          </div>
        )}
        {error && !sent && <p className="miss">That sign-in didn&apos;t go through. Try again, or pick another option.</p>}

        <div className="stack" style={{ marginTop: 26 }}>
          {signInOptions.google && (
            <form action={async () => { "use server"; await signIn("google", { redirectTo: next }); }}>
              <button className="cta full"><span>Continue with Google</span></button>
            </form>
          )}
          {signInOptions.discord && (
            <form action={async () => { "use server"; await signIn("discord", { redirectTo: next }); }}>
              <button className="cta full"><span>Continue with Discord</span></button>
            </form>
          )}
          {signInOptions.email && (
            <form
              className="post"
              action={async (formData: FormData) => {
                "use server";
                await signIn("resend", { email: String(formData.get("email") ?? ""), redirectTo: next });
              }}
            >
              <input className="field" type="email" name="email" placeholder="you@example.com" required autoComplete="email" />
              <button className="cta ghost"><span>Email me a link</span></button>
            </form>
          )}
        </div>
        <p className="muted" style={{ fontSize: 15, marginTop: 22 }}>
          See what we keep in the <Link href="/privacy" style={{ color: "var(--gold)" }}>privacy policy</Link>.
        </p>
      </main>
    </>
  );
}
