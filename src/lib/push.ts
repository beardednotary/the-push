// Daily "tonight's card is live" reminders over standard web push.
import { createHash } from "node:crypto";
import webpush, { type PushSubscription } from "web-push";
import { career } from "./career";
import { puzzleNumber, todayKey } from "./day";
import { store } from "./store";

// Browsers' push services. Anything else is refused, so the sender can't be
// pointed at arbitrary URLs.
const PUSH_HOSTS = [/(^|\.)fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];

export function subKey(endpoint: string) {
  return createHash("sha256").update(endpoint).digest("hex").slice(0, 32);
}

export function validSubscription(raw: unknown): PushSubscription | null {
  const s = raw as PushSubscription | null;
  if (!s || typeof s.endpoint !== "string" || !s.keys?.p256dh || !s.keys?.auth) return null;
  let url: URL;
  try {
    url = new URL(s.endpoint);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !PUSH_HOSTS.some((re) => re.test(url.hostname))) return null;
  return { endpoint: s.endpoint, keys: { p256dh: String(s.keys.p256dh), auth: String(s.keys.auth) } };
}

function configured() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:hello@playthepush.com", pub, priv);
  return true;
}

/** `force` (manual tests) also reminds players who already played today. */
export async function sendReminders({ force = false } = {}) {
  if (!configured()) return { error: "VAPID keys are not set" };
  const day = todayKey();
  const [subs, played] = await Promise.all([store.allSubs(), store.playedOn(day)]);
  const number = puzzleNumber(day);
  const generic = JSON.stringify({
    title: `Card No. ${number} is live`,
    body: "Five questions, fifteen seconds each, plus the Immaculate Ring. Ring the bell.",
    url: "/",
  });
  // someone on an Iron Man streak gets told what's at stake
  const payloadFor = async (playerId?: string) => {
    const streak = playerId ? (await career(playerId)).streak : 0;
    if (streak < 2) return generic;
    return JSON.stringify({
      title: `Keep your ${streak}-day streak alive`,
      body: `Card No. ${number} is live. Don't break the Iron Man streak now.`,
      url: "/",
    });
  };
  let sent = 0;
  let skipped = 0;
  let removed = 0;
  let failed = 0;
  await Promise.all(
    Object.entries(subs).map(async ([key, json]) => {
      let rec: { sub: PushSubscription; playerId?: string };
      try {
        rec = JSON.parse(json);
      } catch {
        await store.deleteSub(key);
        removed++;
        return;
      }
      if (!force && rec.playerId && played.has(rec.playerId)) {
        skipped++;
        return;
      }
      try {
        await webpush.sendNotification(rec.sub, await payloadFor(rec.playerId), { TTL: 60 * 60 * 12, urgency: "normal" });
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await store.deleteSub(key); // the browser unsubscribed or the subscription expired
          removed++;
        } else {
          failed++;
        }
      }
    }),
  );
  return { day, subscribers: Object.keys(subs).length, sent, skipped, removed, failed };
}
