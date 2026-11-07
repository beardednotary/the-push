import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bug, Plate } from "@/components/Chrome";
import { EmailFlag } from "@/components/RemindMe";
import { confirmEmail, stopEmail } from "@/lib/emailRemind";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Email reminders · The Push", robots: { index: false, follow: false } };

// Where the reminder emails' links land. Confirming and unsubscribing each take a tap on a
// button, not just opening the link, so mail scanners that open links can't do either.
export default async function RemindPage({ searchParams }: { searchParams: Promise<{ confirm?: string; stop?: string; done?: string }> }) {
  const { confirm, stop, done } = await searchParams;

  async function doConfirm(form: FormData) {
    "use server";
    const ok = await confirmEmail(String(form.get("t") ?? ""));
    redirect(`/remind?done=${ok ? "on" : "gone"}`);
  }
  async function doStop(form: FormData) {
    "use server";
    await stopEmail(String(form.get("t") ?? ""));
    redirect("/remind?done=off");
  }

  const [title, body] =
    done === "on"
      ? ["You're on the card.", "One email each morning when the new card is live, skipped on days you've already played. Every email has an unsubscribe link."]
      : done === "off"
        ? ["You're unsubscribed.", "We've deleted your address. You won't get any more reminder emails."]
        : done === "gone"
          ? ["That link has expired.", "Sign up again from any game's results screen."]
          : confirm
            ? ["One email a morning?", "Confirm and we'll email you when each night's card is live."]
            : stop
              ? ["Stop the reminder emails?", "We'll delete your address and won't email you again."]
              : ["Email reminders", "Sign up from any game's results screen."];

  return (
    <>
      <Bug>
        <Plate tone="dark">Reminders</Plate>
      </Bug>
      <main className="wrap">
        <div className="headline" style={{ marginTop: 40 }}>
          <Plate tone="gold">Email reminders</Plate>
          <h1 className="chrome" style={{ fontSize: "clamp(44px, 11vw, 72px)", marginTop: 14 }}>
            {title}
          </h1>
        </div>
        <p className="muted">{body}</p>
        {done === "on" && <EmailFlag value="on" />}
        {done === "off" && <EmailFlag value={null} />}
        {!done && confirm && (
          <form action={doConfirm}>
            <input type="hidden" name="t" value={confirm} />
            <button className="cta gold">
              <span>Yes, remind me</span>
            </button>
          </form>
        )}
        {!done && stop && (
          <form action={doStop}>
            <input type="hidden" name="t" value={stop} />
            <button className="cta">
              <span>Unsubscribe</span>
            </button>
          </form>
        )}
        {(done || (!confirm && !stop)) && (
          <Link className="cta" href="/">
            <span>Tonight&apos;s card</span>
          </Link>
        )}
      </main>
    </>
  );
}
