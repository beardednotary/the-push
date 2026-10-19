import type { Metadata } from "next";
import Link from "next/link";
import { auth, signInEnabled } from "@/auth";
import { Bug, Plate } from "@/components/Chrome";
import { StartLeague } from "@/components/league";
import { MAX_LEAGUES, MAX_MEMBERS } from "@/lib/leagues";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Start a league · The Push", robots: { index: false } };

export default async function NewLeaguePage() {
  // starting a league needs an account (joining one doesn't); local dev without auth keys skips this
  const signedIn = !signInEnabled || Boolean((await auth())?.user);
  return (
    <>
      <Bug>
        <Plate tone="dark">League</Plate>
      </Bug>
      <main className="wrap">
        <div className="headline" style={{ marginTop: 40 }}>
          <Plate tone="gold">Friend leagues</Plate>
          <h1 className="chrome" style={{ fontSize: "clamp(48px, 12vw, 76px)", marginTop: 14 }}>
            Your own card.
          </h1>
        </div>
        <ul className="rules">
          <li>
            <b>Name it, send the link.</b> Anyone who opens it can join, up to {MAX_MEMBERS} people. No account needed to join.
          </li>
          <li>
            <b>Every night, your own standings</b> for the Daily Five and the Immaculate Ring, pulled from the main board.
          </li>
          <li>
            <b>A belt on the line.</b> The league&apos;s top score in each game takes its title at midnight Eastern.
          </li>
        </ul>
        {signedIn ? (
          <StartLeague />
        ) : (
          <div className="remind">
            <Plate tone="dark">Sign in first</Plate>
            <p>
              <b>Starting a league takes an account</b>, so it stays yours on every device. Your friends can join without one.
            </p>
            <Link className="cta ghost" href="/signin">
              <span>Sign in</span>
            </Link>
          </div>
        )}
        <p className="muted small">You can be in up to {MAX_LEAGUES} leagues.</p>
      </main>
    </>
  );
}
