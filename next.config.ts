import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // API proxying is handled by src/app/api/[...path]/route.ts
  // This avoids Next.js rewrite proxy timeouts on long-running agentic requests
};

export default nextConfig;
