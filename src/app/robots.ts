import type { MetadataRoute } from "next";

// /r/ (shared results) stays crawlable so X and other preview bots can fetch the cards;
// those pages carry a noindex tag instead.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/signin", "/account", "/stats"] },
    sitemap: "https://playthepush.com/sitemap.xml",
  };
}
