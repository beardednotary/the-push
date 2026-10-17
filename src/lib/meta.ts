import type { Metadata } from "next";

export const SITE_DESCRIPTION =
  "Daily wrestling trivia: five questions, fifteen seconds each, and the Immaculate Ring. New card every night.";

/** Page metadata with a canonical URL and matching og:url (paths resolve against metadataBase). */
export function pageMeta(path: string, title: string, description = SITE_DESCRIPTION, extra: Metadata = {}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName: "The Push", type: "website" },
    twitter: { card: "summary_large_image", title, description },
    ...extra,
  };
}
