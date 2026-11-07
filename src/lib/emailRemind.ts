// Daily email reminders: the same morning nudge as web push, for players whose browser
// can't take notifications (most iPhones, unless the site is on the home screen).
// Double opt-in: an address gets nothing but one confirmation email until its link is
// clicked. Every reminder carries a one-click unsubscribe, which deletes the address.
// Sent through Resend with AUTH_RESEND_KEY, the key that already sends sign-in emails.
import { randomBytes } from "node:crypto";
import { career } from "./career";
import { puzzleNumber, todayKey } from "./day";
import { countStat } from "./stats";
import { store } from "./store";

const SUBS = "email:subs"; // token -> JSON Sub
const BY_ADDR = "email:byaddr"; // address -> token, so one address has one entry
const TRIES = (day: string) => `email:tries:${day}`; // sign-up attempts per player, and in all
const FROM = "The Push <reminders@playthepush.com>";
const SITE = "https://playthepush.com";
const PER_PLAYER_PER_DAY = 3;
const CONFIRMS_PER_DAY = 200; // a cap on confirmation emails, so the form can't be used to spam

interface Sub {
  email: string;
  playerId?: string;
  confirmed: boolean;
  since: number;
}

export const emailRemindersOn = () => Boolean(process.env.AUTH_RESEND_KEY);

/** A plausible address, lowercased, or null. */
export function cleanEmail(raw: unknown): string | null {
  const s = String(raw ?? "").trim().toLowerCase();
  return s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? s : null;
}

type Message = { to: string; subject: string; html: string; text: string; headers?: Record<string, string> };

/** Send up to 100 emails per request through Resend's batch endpoint. */
async function send(messages: Message[]): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.AUTH_RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(chunk.map((m) => ({ from: FROM, ...m, to: [m.to] }))),
    });
    if (res.ok) sent += chunk.length;
    else failed += chunk.length;
  }
  return { sent, failed };
}

// the sender's postal address, which CAN-SPAM asks for in every reminder
const postal = () => process.env.EMAIL_POSTAL_ADDRESS?.trim() || "PO Box 3506, Seal Beach, CA 90740";

function layout(body: string, footer: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f4f6;font-family:Arial,Helvetica,sans-serif;color:#111">
<div style="max-width:480px;margin:0 auto;background:#fff;padding:28px 24px;border-left:6px solid #ffd400">
<div style="font-weight:800;letter-spacing:2px;font-size:13px;color:#e8112d">THE PUSH</div>
${body}
<p style="margin:28px 0 0;font-size:12px;color:#666;line-height:1.5">${footer}</p>
</div></body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:22px 0"><a href="${href}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-weight:800;padding:12px 22px;letter-spacing:1px">${label}</a></p>`;

/** Sign up an address: sends the confirmation email (or does nothing if it's already confirmed). */
export async function requestEmailReminder(raw: unknown, playerId?: string): Promise<"sent" | "already" | "invalid" | "limited" | "off"> {
  if (!emailRemindersOn()) return "off";
  const email = cleanEmail(raw);
  if (!email) return "invalid";
  const day = todayKey();
  if ((await store.incr(TRIES(day), playerId ?? "anon")) > PER_PLAYER_PER_DAY) return "limited";

  let token = (await store.hashGet(BY_ADDR))[email];
  const existing = token ? (await store.hashGet(SUBS))[token] : undefined;
  if (existing && (JSON.parse(existing) as Sub).confirmed) return "already";
  if ((await store.incr(TRIES(day), "all")) > CONFIRMS_PER_DAY) return "limited";
  if (!token || !existing) {
    token = randomBytes(18).toString("base64url");
    const sub: Sub = { email, playerId, confirmed: false, since: Date.now() };
    await store.hashSet(SUBS, { [token]: JSON.stringify(sub) });
    await store.hashSet(BY_ADDR, { [email]: token });
  }
  const confirm = `${SITE}/remind?confirm=${token}`;
  const { sent } = await send([
    {
      to: email,
      subject: "Confirm your daily card reminder",
      text: `Tap to get one email each morning when The Push's new card is live:\n${confirm}\n\nIf you didn't ask for this, ignore this email and you won't hear from us.`,
      html: layout(
        `<h1 style="font-size:22px;margin:14px 0 8px">One email a morning?</h1>
<p style="margin:0;line-height:1.5">Confirm and we'll email you when each night's card is live: the Daily Five, the Immaculate Ring and Wrestling Wordle. Skipped on days you've already played.</p>
${button(confirm, "YES, REMIND ME")}`,
        "If you didn't ask for this, ignore this email and you won't hear from us.",
      ),
    },
  ]);
  return sent ? "sent" : "off";
}

async function find(token: string): Promise<Sub | null> {
  if (!/^[\w-]{10,64}$/.test(token)) return null;
  const raw = (await store.hashGet(SUBS))[token];
  return raw ? (JSON.parse(raw) as Sub) : null;
}

/** The confirmation link: true when the address is now on the list. */
export async function confirmEmail(token: string): Promise<boolean> {
  const sub = await find(token);
  if (!sub) return false;
  if (!sub.confirmed) {
    await store.hashSet(SUBS, { [token]: JSON.stringify({ ...sub, confirmed: true }) });
    await countStat(todayKey(), "remind:email");
  }
  return true;
}

/** Unsubscribe: the address is deleted, not just switched off. */
export async function stopEmail(token: string): Promise<boolean> {
  const sub = await find(token);
  if (!sub) return false;
  await store.hashDel(SUBS, token);
  await store.hashDel(BY_ADDR, sub.email);
  return true;
}

/** The morning email to every confirmed address whose player hasn't played today. */
export async function sendEmailReminders({ force = false } = {}) {
  if (!emailRemindersOn()) return { error: "AUTH_RESEND_KEY is not set" };
  const day = todayKey();
  const number = puzzleNumber(day);
  const [subs, played] = await Promise.all([store.hashGet(SUBS), store.playedOn(day)]);
  const messages: Message[] = [];
  let skipped = 0;
  for (const [token, raw] of Object.entries(subs)) {
    let sub: Sub;
    try {
      sub = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!sub.confirmed) continue;
    if (!force && sub.playerId && played.has(sub.playerId)) {
      skipped++;
      continue;
    }
    const streak = sub.playerId ? (await career(sub.playerId)).streak : 0;
    const stop = `${SITE}/api/remind/email/stop?t=${token}`;
    const play = `${SITE}/?utm_source=email&utm_medium=reminder`;
    const subject = streak >= 2 ? `Keep your ${streak}-day streak alive · Card No. ${number}` : `Card No. ${number} is live`;
    const lead = streak >= 2 ? `You're on a ${streak}-day Iron Man streak. Card No. ${number} is live: don't break it now.` : `Card No. ${number} is live.`;
    const footer = `You asked for one email a morning, skipped on days you've already played. <a href="${SITE}/remind?stop=${token}" style="color:#666">Unsubscribe</a>.${postal() ? `<br>DahVio Studios · ${postal()}` : " DahVio Studios."}`;
    messages.push({
      to: sub.email,
      subject,
      headers: { "List-Unsubscribe": `<${stop}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      text: `${lead}\n\nDaily Five: five questions, fifteen seconds each.\nImmaculate Ring: nine squares, nine guesses.\nWrestling Wordle: guess the wrestler in eight.\n\nPlay: ${play}\n\nUnsubscribe: ${SITE}/remind?stop=${token}${postal() ? `\nDahVio Studios · ${postal()}` : ""}`,
      html: layout(
        `<h1 style="font-size:22px;margin:14px 0 8px">${lead}</h1>
<p style="margin:0;line-height:1.6"><b>Daily Five</b>: five questions, fifteen seconds each.<br><b>Immaculate Ring</b>: nine squares, nine guesses.<br><b>Wrestling Wordle</b>: guess the wrestler in eight.</p>
${button(play, "RING THE BELL")}`,
        footer,
      ),
    });
  }
  const { sent, failed } = await send(messages);
  return { day, subscribers: Object.keys(subs).length, sent, skipped, failed };
}
