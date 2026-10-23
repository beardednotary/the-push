import type { MetadataRoute } from "next";
import { pastDays } from "@/lib/archive";
import { MIN_INDEXED, allPairs, categoryHref, pairHref } from "@/lib/grid";
import { allCriteria } from "@/lib/ring";
import { hadWordle } from "@/lib/wordle";

const BASE = "https://playthepush.com";

// rebuilt hourly so last night's card joins soon after midnight Eastern
export const revalidate = 3600;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  // a past card never changes once its night is over
  const archive = pastDays().flatMap(({ n, day }) => {
    const lastModified = new Date(`${day}T12:00:00Z`);
    return [
      { url: `${BASE}/ring/answers/${n}`, lastModified, changeFrequency: "monthly" as const, priority: 0.6 },
      { url: `${BASE}/five/answers/${n}`, lastModified, changeFrequency: "monthly" as const, priority: 0.5 },
      ...(hadWordle(day) ? [{ url: `${BASE}/wordle/answers/${n}`, lastModified, changeFrequency: "monthly" as const, priority: 0.5 }] : []),
    ];
  });
  // the grid guide only changes when the data is re-imported
  const guide = [
    ...allCriteria().map((c) => ({ url: `${BASE}${categoryHref(c)}`, changeFrequency: "monthly" as const, priority: 0.5 })),
    ...allPairs()
      .filter((p) => p.count >= MIN_INDEXED)
      .map((p) => ({ url: `${BASE}${pairHref(p.a, p.b)}`, changeFrequency: "monthly" as const, priority: 0.4 })),
  ];
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/five`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/ring`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/wordle`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/ring/japan`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/titles`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE}/yesterday`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/archive`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/grid`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/poll`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE}/polls`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    ...archive,
    ...guide,
    { url: `${BASE}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
