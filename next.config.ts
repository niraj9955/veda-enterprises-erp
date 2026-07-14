import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // ── Image optimization ────────────────────────────────────────────────
  // Allow next/image to optimize images served from the ZAI OSS CDN where
  // dashboard tile photos live. We don't use next/image for the tiles (we
  // use raw <img> with loading="lazy" for simplicity), but enabling the
  // remote pattern here means future code can switch to next/image without
  // hitting the "hostname not configured" error.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'sfile.chatglm.cn' },
    ],
  },
  // ── Production performance ────────────────────────────────────────────
  // reactStrictMode is false because double-rendering in dev causes two
  // API calls per data fetch (visible in the Network tab) and confuses the
  // user during testing. We rely on proper useEffect cleanup instead.
  // compress: true is the default but we set it explicitly so future
  // contributors don't accidentally disable it.
  compress: true,
  // Generate static pages where possible. The app is fully client-side
  // after login (all pages use 'use client'), so this mostly affects
  // the initial HTML shell.
  poweredByHeader: false,
};

export default nextConfig;
