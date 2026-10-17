import type { MetadataRoute } from "next";

// Lets The Push be added to a home screen as an app. iPhones only allow web
// notifications for sites opened from the home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The Push: daily wrestling trivia",
    short_name: "The Push",
    description: "Five questions and the Immaculate Ring. New card every night.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#07080b",
    theme_color: "#07080b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
