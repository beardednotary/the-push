import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray package-lock.json in the home folder makes Next guess the wrong workspace root.
  outputFileTracingRoot: process.cwd(),
  // the per-result share images read their fonts and backdrop from disk
  outputFileTracingIncludes: { "/r/**": ["./src/share-assets/**"] },
};

export default nextConfig;
