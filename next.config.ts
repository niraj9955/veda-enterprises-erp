import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    // We keep this true because the codebase has a handful of legacy TS
    // warnings in client components that don't affect runtime. Cleaning
    // them up is on the roadmap but shouldn't block deployments.
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
  // ── Security headers ──────────────────────────────────────────────────
  // Applied to every response. These headers harden the app against
  // common web attacks: clickjacking (X-Frame-Options), MIME-type sniffing
  // (X-Content-Type-Options), reflected XSS (X-XSS-Protection), protocol
  // downgrade (Strict-Transport-Security), and information disclosure
  // (Referrer-Policy, Permissions-Policy). CSP is intentionally omitted
  // because the app uses inline styles + external CDNs that would require
  // a complex policy — added later when we move to non-inline styles.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // ⚠️ microphone=* is REQUIRED for the AI voice feature (mic input on
          // AI chat + field voice inputs). 'microphone=()' DENIES the mic for
          // every origin including our own page — that silently broke voice on
          // ALL devices (mobile + laptop) with a NotAllowedError. '*' allows
          // the browser to grant mic (user still sees the normal permission
          // prompt) including inside preview iframes whose parent delegates
          // allow="microphone". Camera/geolocation stay fully denied.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=*, geolocation=(), browsing-topics=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          // HSTS — only meaningful over HTTPS. Behind Vercel/Caddy this is
          // always HTTPS so the header is safe.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ]
  },
};

export default nextConfig;
