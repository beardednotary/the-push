import type { Metadata } from "next";
import { notFound } from "next/navigation";
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

export default async function StatsPage() {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) notFound();

  const today = todayKey();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, -i)).filter((d) => puzzleNumber(d) >= 1);
  const [rows, subs] = await Promise.all([Promise.all(days.map(async (d) => ({ d, s: await readStats(d) }))), store.allSubs()]);

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
      </main>
    </>
  );
}
