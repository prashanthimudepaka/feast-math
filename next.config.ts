import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server (.next/standalone) so the Docker runtime
  // image needs no node_modules. Vercel ignores this and builds natively.
  output: "standalone",
};

export default nextConfig;
