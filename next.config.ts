import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray package-lock.json in the home folder makes Next guess the wrong workspace root.
  outputFileTracingRoot: process.cwd(),
  // the per-result share images read their fonts and backdrop from disk
  // the fact-check post reads the import's guesses and the hand-added tags
  outputFileTracingIncludes: {
    "/r/**": ["./src/share-assets/**"],
    "/api/cron/**": ["./data/generated/fact_check.csv", "./data/curation/tags.csv"],
  },
};

export default nextConfig;
