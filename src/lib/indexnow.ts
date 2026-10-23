// Tells Bing (and DuckDuckGo, Yahoo, Ecosia, which read its index) about last night's
// answer pages as soon as they exist. Rides along with the daily cron; Google doesn't use
// IndexNow and finds them through the sitemap. The key file is public/<KEY>.txt; the
// whole sitemap can be sent by hand with scripts/indexnow.py.
import { pastDay } from "./archive";
import { puzzleNumber, todayKey } from "./day";
import { store } from "./store";
import { hadWordle } from "./wordle";

const HOST = "playthepush.com";
const KEY = "42852ffc3ae747a6a782c18ad4afbcae";

export async function submitLastNight({ force = false } = {}): Promise<{ submitted: boolean; reason?: string; urls?: number }> {
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") return { submitted: false, reason: "not production" };
  const today = todayKey();
  const past = pastDay(puzzleNumber(today) - 1, today);
  if (!past) return { submitted: false, reason: "no past card yet" };
  if (!force && !(await store.setOnce(`indexnow:${today}`, "1"))) return { submitted: false, reason: "already submitted today" };
  const { n, day } = past;
  const urlList = [
    `/ring/answers/${n}`,
    `/five/answers/${n}`,
    ...(hadWordle(day) ? [`/wordle/answers/${n}`] : []),
    "/yesterday",
    "/archive",
  ].map((p) => `https://${HOST}${p}`);
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key: KEY, urlList }),
  });
  // 200 = accepted, 202 = accepted while the key is still being checked
  return res.ok ? { submitted: true, urls: urlList.length } : { submitted: false, reason: `IndexNow said ${res.status}` };
}
