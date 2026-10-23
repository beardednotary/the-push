import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FLAIR, flairs, setFlair } from "@/lib/flair";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { Bug, Plate } from "@/components/Chrome";
import { addDays, puzzleNumber, todayKey } from "@/lib/day";
import { disputeGroups, settleDispute } from "@/lib/disputes";
import { pollFor, writeIns } from "@/lib/polls";
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
  const [rows, subs, given, disputes, { flair: flairResult }] = await Promise.all([
    Promise.all(days.map(async (d) => ({ d, s: await readStats(d) }))),
    store.allSubs(),
    flairs(),
    disputeGroups(),
    searchParams,
  ]);
  const flairNames = await store.names(Object.keys(given));
  // the last week's write-in answers, for this page only (players see one Write-ins bar)
  const written = (await Promise.all(days.slice(0, 7).map(async (d) => ({ d, poll: await pollFor(d), answers: await writeIns(d) })))).filter((x) => x.poll && x.answers.length);

  async function grant(form: FormData) {
    "use server";
    const s = await auth();
    if (!isAdmin(s?.user?.email)) notFound();
    const id = await setFlair(String(form.get("code") ?? ""), "road-agent");
    redirect(`/stats?flair=${id ? "given" : "nocode"}#flair`);
  }

  async function settle(form: FormData) {
    "use server";
    const s = await auth();
    if (!isAdmin(s?.user?.email)) notFound();
    const verdict = form.get("verdict") === "accepted" ? "accepted" : "rejected";
    await settleDispute(String(form.get("key") ?? ""), verdict);
    redirect("/stats#disputes");
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
                <th>Wordle started</th>
                <th>finished</th>
                <th>shared</th>
                <th>Reminders on</th>
                <th>Leagues started</th>
                <th>joins</th>
                <th>Disputes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ d, s }) => {
                const five = (s["five:start"] ?? 0) + (s["five:start_untimed"] ?? 0);
                const ring = s["ring:start"] ?? 0;
                const wordle = s["wordle:start"] ?? 0;
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
                    <td>
                      {s["five:share"] ?? 0} <span className="muted">of {s["five:share_tap"] ?? 0} taps</span>
                    </td>
                    <td>{ring}</td>
                    <td>
                      {s["ring:finish"] ?? 0} <span className="muted">{pct(s["ring:finish"] ?? 0, ring)}</span>
                    </td>
                    <td>
                      {s["ring:share"] ?? 0} <span className="muted">of {s["ring:share_tap"] ?? 0} taps</span>
                    </td>
                    <td>{wordle}</td>
                    <td>
                      {s["wordle:finish"] ?? 0} <span className="muted">{pct(s["wordle:finish"] ?? 0, wordle)}</span>
                    </td>
                    <td>
                      {s["wordle:share"] ?? 0} <span className="muted">of {s["wordle:share_tap"] ?? 0} taps</span>
                    </td>
                    <td>{s["remind:on"] ?? 0}</td>
                    <td>{s["league:create"] ?? 0}</td>
                    <td>{s["league:join"] ?? 0}</td>
                    <td>{s["ring:dispute"] ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted small">
          Players = unique devices that finished a game. Returning = of those, how many first played on an earlier day. Counts
          began when each column was added; earlier days show zero. Taps = pressed Challenge a friend; shared = actually sent
          or copied it. Leagues started = new friend leagues; joins = players joining someone else&apos;s league. Disputes =
          rejected Ring guesses players said were right.
        </p>

        <section id="disputes">
          <div className="section-head">
            <Plate tone="red">Disputes</Plate>
            <Plate tone="dark">Rejected guesses</Plate>
          </div>
          <p className="muted small">
            Accept makes the answer count right away. Then paste its row into the tags sheet so the next data build keeps it.
          </p>
          {disputes.length === 0 ? (
            <p className="muted">None yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Wrestler</th>
                    <th>Should count for</th>
                    <th>Disputes</th>
                    <th>Days</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {disputes.map((g) => (
                    <tr key={g.key}>
                      <td>
                        <b>{g.wrestler}</b>
                      </td>
                      <td>{g.label}</td>
                      <td>
                        {g.count}
                        {g.players > 0 && <span className="muted"> · {g.players} {g.players === 1 ? "player" : "players"}</span>}
                      </td>
                      <td className="muted">{g.days.map((d) => d.slice(5)).join(", ")}</td>
                      <td>
                        {g.status === "accepted" ? (
                          <>
                            Accepted{g.players > 0 ? `; ${g.players} Road Agent${g.players === 1 ? "" : "s"} made` : ""}. tags.csv row: <code>{g.csv}</code>
                          </>
                        ) : g.status === "rejected" ? (
                          <span className="muted">Rejected</span>
                        ) : (
                          <form action={settle} style={{ display: "flex", gap: 8 }}>
                            <input type="hidden" name="key" value={g.key} />
                            <button className="cta ghost" name="verdict" value="accepted">
                              <span>Accept</span>
                            </button>
                            <button className="cta ghost" name="verdict" value="rejected">
                              <span>Reject</span>
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section id="writeins">
          <div className="section-head">
            <Plate tone="gold">Poll write-ins</Plate>
            <Plate tone="dark">Last 7 nights</Plate>
          </div>
          <p className="muted small">What players typed under Something else, most votes first. Only you see these; a popular one makes a good option for a future poll.</p>
          {written.length === 0 ? (
            <p className="muted">None yet.</p>
          ) : (
            written.map(({ d, poll, answers }) => (
              <div key={d} className="key" style={{ marginBottom: 8 }}>
                <h3 className="caps">
                  No. {poll!.n} · {poll!.question}
                </h3>
                <p>{answers.map((a) => `${a.text}${a.votes > 1 ? ` (${a.votes})` : ""}`).join(" · ")}</p>
              </div>
            ))
          )}
        </section>

        <section id="flair">
          <div className="section-head">
            <Plate tone="red">{FLAIR["road-agent"]}</Plate>
            <Plate tone="dark">For fixed reports</Plate>
          </div>
          <p className="muted small">
            Accepting a dispute makes everyone who sent it a Road Agent automatically. For other help, the player signs in and sends you the player code from their account page. The badge shows next to their name on the
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
