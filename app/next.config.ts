import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // the repo root holds the lockfile and the engine this app imports
  turbopack: { root: path.join(import.meta.dirname, "..") },
  outputFileTracingRoot: path.join(import.meta.dirname, ".."),
};

export default nextConfig;
