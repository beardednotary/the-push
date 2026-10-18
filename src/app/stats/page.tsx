import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FLAIR, flairs, setFlair } from "@/lib/flair";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { Bug, Plate } from "@/components/Chrome";
import { addDays, puzzleNumber, todayKey } from "@/lib/day";
import { readStats } from "@/lib/stats";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Stats · The Push", robots: { index: false, follow: false } };

// Only for emails listed in ADMIN_EMAILS. Everyone else gets a 404.
const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "–");

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ flair?: string }> }) {
  const session = await auth();
  if (!session?.user) notFound();
  if (!isAdmin(session.user.email)) {
    // signed in but not on the list: say which address to add (only ever shows the viewer their own email)
    return (
      <>
        <Bug>
          <Plate tone="dark">Stats</Plate>
        </Bug>
        <main className="wrap">
          <p className="muted" style={{ marginTop: 40 }}>
            You&apos;re signed in as <b>{session.user.email ?? "an account with no email"}</b>, which isn&apos;t on this site&apos;s
            admin list.
          </p>
        </main>
      </>
    );
  }

  const today = todayKey();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, -i)).filter((d) => puzzleNumber(d) >= 1);
  const [rows, subs, given, { flair: flairResult }] = await Promise.all([
    Promise.all(days.map(async (d) => ({ d, s: await readStats(d) }))),
    store.allSubs(),
    flairs(),
    searchParams,
  ]);
  const flairNames = await store.names(Object.keys(given));

  async function grant(form: FormData) {
    "use server";
    const s = await auth();
    if (!isAdmin(s?.user?.email)) notFound();
    const id = await setFlair(String(form.get("code") ?? ""), "road-agent");
    redirect(`/stats?flair=${id ? "given" : "nocode"}#flair`);
  }

  return (
    <>
      <Bug>
        <Plate tone="dark">Stats</Plate>
      </Bug>
      <main className="wrap stats">
        <div className="headline" style={{ marginTop: 34 }}>
          <Plate tone="gold">Private · last 14 days</Plate>
          <h1 className="chrome" style={{ fontSize: "clamp(48px, 12vw, 76px)", marginTop: 14 }}>
            The numbers.
          </h1>
        </div>
        <p className="muted">
          Counted on the server, so ad blockers don&apos;t hide anyone. Devices that visited with ?notrack are excluded. Reminder
          subscribers right now: <b>{Object.keys(subs).length}</b>.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>No.</th>
                <th>Players</th>
                <th>returning</th>
                <th>Five started</th>
                <th>untimed</th>
                <th>finished</th>
                <th>shared</th>
                <th>Ring started</th>
                <th>finished</th>
                <th>shared</th>
                <th>Reminders on</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ d, s }) => {
                const five = (s["five:start"] ?? 0) + (s["five:start_untimed"] ?? 0);
                const ring = s["ring:start"] ?? 0;
                return (
                  <tr key={d}>
                    <td>
                      <b>{puzzleNumber(d)}</b> <span className="muted">{d.slice(5)}</span>
                    </td>
                    <td>{s["players"] ?? 0}</td>
                    <td>
                      {s["returning"] ?? 0} <span className="muted">{pct(s["returning"] ?? 0, s["players"] ?? 0)}</span>
                    </td>
                    <td>{five}</td>
                    <td>{s["five:start_untimed"] ?? 0}</td>
                    <td>
                      {s["five:finish"] ?? 0} <span className="muted">{pct(s["five:finish"] ?? 0, five)}</span>
                    </td>
                    <td>{s["five:share"] ?? 0}</td>
                    <td>{ring}</td>
                    <td>
                      {s["ring:finish"] ?? 0} <span className="muted">{pct(s["ring:finish"] ?? 0, ring)}</span>
                    </td>
                    <td>{s["ring:share"] ?? 0}</td>
                    <td>{s["remind:on"] ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted small">
          Players = unique devices that finished a game. Returning = of those, how many first played on an earlier day. Counts
          began when each column was added; earlier days show zero.
        </p>

        <section id="flair">
          <div className="section-head">
            <Plate tone="red">{FLAIR["road-agent"]}</Plate>
            <Plate tone="dark">For fixed reports</Plate>
          </div>
          <p className="muted small">
            The player signs in and sends you the player code from their account page. The badge shows next to their name on the
            standings.
          </p>
          <form action={grant} className="post">
            <input className="field" name="code" placeholder="Player code" maxLength={12} required />
            <button className="cta ghost">
              <span>Give</span>
            </button>
          </form>
          {flairResult && (
            <p className="muted">
              {flairResult === "given" ? "Badge given." : "No signed-in player has that code."}
            </p>
          )}
          {Object.keys(given).length > 0 && (
            <ul className="muted">
              {Object.entries(given).map(([id, f]) => (
                <li key={id}>
                  {flairNames[id] ?? "No ring name yet"} · {f}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
