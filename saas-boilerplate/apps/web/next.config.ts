import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client", "prisma", "@prisma/adapter-pg"],
  outputFileTracingRoot: path.join(__dirname, "..", ".."),
  outputFileTracingIncludes: {
    "/*": [
      "../../node_modules/.prisma/client/**/*",
      "../../node_modules/.pnpm/@prisma+client@6.19.3*/node_modules/.prisma/client/**/*",
    ],
    "/api/auth/register": [
      "../../node_modules/.prisma/client/**/*",
      "../../node_modules/.pnpm/@prisma+client@6.19.3*/node_modules/.prisma/client/**/*",
    ],
    "/api/auth/[...nextauth]": [
      "../../node_modules/.prisma/client/**/*",
      "../../node_modules/.pnpm/@prisma+client@6.19.3*/node_modules/.prisma/client/**/*",
    ],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-DNS-Prefetch-Control", value: "on" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-XSS-Protection", value: "1; mode=block" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    },
  ],
};

export default nextConfig;
