import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Silence "multiple lockfiles" warning — pin workspace root to this project
  turbopack: { root: import.meta.dirname },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
