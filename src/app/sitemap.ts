import type { MetadataRoute } from "next";

const BASE = "https://playthepush.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/five`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/ring`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/yesterday`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
