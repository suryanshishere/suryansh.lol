import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: { root: process.cwd() },
};

export default nextConfig;
