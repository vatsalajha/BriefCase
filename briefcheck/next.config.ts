import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "@llamaindex/cloud"],
};

export default nextConfig;
