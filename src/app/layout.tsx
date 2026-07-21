import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/erp/theme-provider";
import { RegisterSW } from "@/components/pwa/register-sw";
import { InstallPrompt } from "@/components/pwa/install-prompt";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Veda Enterprises ERP - Management System",
  description:
    "ERP & Management System for Veda Enterprises. Manage production, stock, dispatch, payments, and reports from one platform.",
  applicationName: "Veda ERP",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-256x256.png", sizes: "256x256", type: "image/png" },
      { url: "/icons/icon-384x384.png", sizes: "384x384", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/favicon.ico"],
  },
  appleWebApp: {
    capable: true,
    title: "Veda ERP",
    statusBarStyle: "default",
    startupImage: [
      // iPhone SE / 5 (320x568 @2x = 640x1136)
      {
        url: "/icons/apple-splash-320x568.png",
        media:
          "(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)",
      },
      // iPhone 6/7/8 (375x667 @2x = 750x1334)
      {
        url: "/icons/apple-splash-375x667.png",
        media:
          "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)",
      },
      // iPhone 6/7/8 Plus (414x736 @3x = 1242x2208)
      {
        url: "/icons/apple-splash-414x736.png",
        media:
          "(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)",
      },
      // iPhone X/XS/11 Pro (375x812 @3x)
      {
        url: "/icons/apple-splash-375x812.png",
        media:
          "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)",
      },
      // iPhone XR/XS Max/11 (414x896 @2x)
      {
        url: "/icons/apple-splash-414x896.png",
        media:
          "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)",
      },
      // iPhone 12/13/14 (390x844 @3x)
      {
        url: "/icons/apple-splash-390x844.png",
        media:
          "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)",
      },
      // iPhone 12/13/14 Pro Max (428x926 @3x)
      {
        url: "/icons/apple-splash-428x926.png",
        media:
          "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)",
      },
      // iPad mini/Air (768x1024 @2x)
      {
        url: "/icons/apple-splash-768x1024.png",
        media:
          "(min-device-width: 768px) and (max-device-width: 1024px) and (-webkit-min-device-pixel-ratio: 2)",
      },
      // iPad Pro 11" (834x1194 @2x)
      {
        url: "/icons/apple-splash-834x1194.png",
        media:
          "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)",
      },
      // iPad Pro 12.9" (1024x1366 @2x)
      {
        url: "/icons/apple-splash-1024x1366.png",
        media:
          "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)",
      },
    ],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* iOS Safari PWA meta tags — Next.js doesn't emit all of these via Metadata API */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Veda ERP" />
        <meta name="application-name" content="Veda ERP" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="apple-touch-fullscreen" content="yes" />
        {/* Force iOS to use the emerald status bar tint when running standalone */}
        <meta name="theme-color" content="#059669" />
        {/* Disable tap highlight on iOS — feels more like a native app */}
        <meta
          name="apple-mobile-web-app-capable"
          content="yes"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <SonnerToaster />
          {/* PWA: register service worker (Android install eligibility + offline) */}
          <RegisterSW />
          {/* PWA: install prompt — Android banner + iOS instructions sheet */}
          <InstallPrompt />
        </ThemeProvider>
      </body>
    </html>
  );
}
