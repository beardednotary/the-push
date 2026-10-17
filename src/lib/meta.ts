import type { Metadata } from "next";

export const SITE_DESCRIPTION =
  "Daily wrestling trivia: five questions, fifteen seconds each, and the Immaculate Ring. New card every night.";

const BANNER = {
  url: "/opengraph-image.jpg",
  width: 1200,
  height: 630,
  alt: "A wrestler in silhouette walks out through the curtain into a packed arena, under the words THE PUSH and Daily Wrestling Trivia.",
};

/**
 * Page metadata with a canonical URL and matching og:url (paths resolve against metadataBase).
 * Pass banner: false where the segment has its own opengraph-image file (the per-result share
 * cards); naming the banner here would replace that card.
 */
export function pageMeta(path: string, title: string, description = SITE_DESCRIPTION, extra: Metadata = {}, banner = true): Metadata {
  // omit the key entirely when not naming the banner: an explicit undefined also wipes the file-based card
  const images = banner ? { images: [BANNER] } : {};
  return {
    title,
    description,
    alternates: { canonical: path },
    // a page's own openGraph replaces the inherited one, so name the banner explicitly
    openGraph: { title, description, url: path, siteName: "The Push", type: "website", ...images },
    twitter: { card: "summary_large_image", title, description, ...images },
    ...extra,
  };
}
