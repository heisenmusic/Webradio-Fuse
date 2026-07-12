import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@fuse/shared"],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
