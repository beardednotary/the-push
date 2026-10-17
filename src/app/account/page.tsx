import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { Bug, Plate } from "@/components/Chrome";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Account · The Push", robots: { index: false } };

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const { name, email } = session.user;

  return (
    <>
      <Bug>
        <Plate tone="dark">Account</Plate>
      </Bug>
      <main className="wrap">
        <div className="headline" style={{ marginTop: 40 }}>
          <Plate tone="gold">Signed in</Plate>
          <h1 className="chrome" style={{ fontSize: "clamp(48px, 12vw, 76px)", marginTop: 14 }}>
            {name || "Welcome back"}
          </h1>
        </div>
        {email && <p className="muted">{email}</p>}
        <p className="muted">
          Your scores, ring name and reminders now follow this account. Sign in the same way on any other device.
        </p>
        <div className="stack">
          <Link className="cta full" href="/">
            <span>Tonight&apos;s card</span>
          </Link>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
            <button className="cta ghost full"><span>Sign out</span></button>
          </form>
        </div>
        <p className="muted" style={{ fontSize: 15 }}>
          To delete your account, email <a href="mailto:ray@dahvio.com" style={{ color: "var(--gold)" }}>ray@dahvio.com</a>.
        </p>
      </main>
    </>
  );
}
