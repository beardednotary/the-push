import type { Metadata } from "next";
import { Bug, Plate } from "@/components/Chrome";

export const metadata: Metadata = { title: "Privacy · The Push" };

const UPDATED = "October 17, 2026";
const CONTACT = "ray@dahvio.com";

export default function PrivacyPage() {
  return (
    <>
      <Bug>
        <Plate tone="dark">Privacy</Plate>
      </Bug>
      <main className="wrap prose">
        <div className="headline" style={{ marginTop: 40 }}>
          <Plate tone="gold">Updated {UPDATED}</Plate>
          <h1 className="chrome" style={{ fontSize: "clamp(48px, 12vw, 76px)", marginTop: 14 }}>
            Privacy
          </h1>
        </div>

        <p>
          The Push (playthepush.com) is a free daily wrestling trivia game made by DahVio Studios. This page explains what we
          collect, why, and what you can do about it. Short version: you can play without an account, we don&apos;t sell
          anything about you, and there are no ad trackers or tracking cookies.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <b>A random player ID, stored in your browser.</b> It lets the site remember today&apos;s progress and your
            leaderboard entries. Your game progress itself stays in your browser.
          </li>
          <li>
            <b>Leaderboard entries.</b> If you post a score, we store the ring name you type, your score and your player ID.
            Daily boards are deleted after about 45 days.
          </li>
          <li>
            <b>Answers and Ring picks.</b> Your answers are sent to our server to be checked and scored. Correct Ring picks are
            counted, without names, to show how rare each pick is.
          </li>
          <li>
            <b>Reminders, if you turn them on.</b> Your browser gives us a push address for your device. We store it with your
            player ID until you turn reminders off or the address stops working, plus a note that you played today (kept for
            three days) so we don&apos;t remind you about a card you already finished.
          </li>
          <li>
            <b>Your account, if you sign in.</b> Signing in is optional. If you use Google or Discord we receive your name, email
            address and profile picture from them; if you use an email link we receive your email address. We use these only to
            run your account and keep your scores and settings together across devices.
          </li>
          <li>
            <b>Visit statistics.</b> We use Vercel Web Analytics to count page views, referring sites, countries and device
            types. It uses no cookies and doesn&apos;t identify you or follow you across other sites.
          </li>
          <li>
            <b>Server logs.</b> Our hosting provider records standard request information such as IP address and browser type to
            keep the site running and secure.
          </li>
        </ul>

        <h2>What we don&apos;t do</h2>
        <ul>
          <li>We don&apos;t sell or rent your information.</li>
          <li>We don&apos;t use advertising trackers or cookie-based analytics. If that ever changes, this page will be updated first and we&apos;ll ask for consent where the law requires it.</li>
        </ul>

        <h2>Who helps us run the site</h2>
        <ul>
          <li><b>Vercel</b> hosts the site and provides the cookie-free visit statistics.</li>
          <li><b>Upstash</b> stores leaderboards, reminder subscriptions and accounts.</li>
          <li><b>Apple, Google, Mozilla and Microsoft</b> deliver push notifications to your device, if you turn reminders on.</li>
          <li><b>Google and Discord</b> handle sign-in, if you choose them, and <b>Resend</b> sends sign-in emails.</li>
        </ul>

        <h2>Your choices</h2>
        <ul>
          <li>Turn reminders off any time from a results screen, or in your browser or phone settings.</li>
          <li>Clear this site&apos;s data in your browser to reset your player ID and saved progress.</li>
          <li>
            Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a> to delete your account, your leaderboard names or anything else
            we hold about you, or to ask what that is.
          </li>
        </ul>

        <h2>Kids</h2>
        <p>The Push isn&apos;t aimed at children under 13, and we don&apos;t knowingly collect their information.</p>

        <h2>Changes and contact</h2>
        <p>
          If this policy changes, we&apos;ll update this page and the date at the top. Questions:{" "}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>
      </main>
    </>
  );
}
