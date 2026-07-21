"use client";

import { useEffect, useState, useCallback } from "react";
import { Download, Share, PlusSquare, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/**
 * Install App Button
 * ============================================
 * A PERMANENT button in the app header that lets the user install the
 * PWA on demand — bypassing the auto-prompt criteria (which require
 * 30+ seconds of engagement on Android, and only fire once on iOS).
 *
 * Behavior:
 *  - Android (Chrome/Edge/Samsung): button calls deferredPrompt.prompt()
 *    if available. If beforeinstallprompt hasn't fired yet (user just
 *    landed), shows a tooltip telling them to interact more or use the
 *    browser menu's "Install app" option.
 *  - iOS (Safari): button opens the instructions sheet explaining how
 *    to use Share → Add to Home Screen. iOS does NOT support
 *    programmatic install, so this is the only path.
 *  - Desktop / unsupported: button is hidden (no install flow available).
 *  - Already installed (standalone mode): button is hidden.
 */

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (/Mac/.test(ua) && (navigator.maxTouchPoints || 0) > 1)
  );
}

function isInstallableBrowser() {
  if (typeof window === "undefined") return false;
  // Chrome, Edge, Samsung Browser, Brave, Opera — all support beforeinstallprompt
  const ua = window.navigator.userAgent;
  return (
    /Android/i.test(ua) ||
    /Chrome/i.test(ua) ||
    /Edg/i.test(ua) ||
    /SamsungBrowser/i.test(ua) ||
    /Brave/i.test(ua) ||
    /Opera/i.test(ua)
  );
}

export function InstallAppButton({
  className = "",
}: {
  className?: string;
}) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosSheet, setShowIosSheet] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    if (isStandalone()) return; // already installed

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const installedHandler = () => {
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleClick = useCallback(async () => {
    // iOS — always show instructions (iOS doesn't support beforeinstallprompt)
    if (isIOS()) {
      setShowIosSheet(true);
      return;
    }
    // Android / Chromium — call prompt() if we have it
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setDeferredPrompt(null);
      }
      return;
    }
    // Android but beforeinstallprompt hasn't fired yet —
    // tell user to use the browser menu
    setShowFallback(true);
  }, [deferredPrompt]);

  // Don't render until mounted (avoid SSR hydration mismatch)
  if (!mounted) return null;
  // Hide if already installed
  if (isStandalone()) return null;
  // Hide on browsers that can't install (e.g. desktop Firefox without PWA support)
  if (!isIOS() && !isInstallableBrowser()) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleClick}
        title="Install app on your device"
        aria-label="Install app"
        className={className}
      >
        <Download className="h-4 w-4" />
      </Button>

      {/* iOS instructions sheet */}
      <Sheet open={showIosSheet} onOpenChange={setShowIosSheet}>
        <SheetContent side="bottom" className="mx-auto max-w-md rounded-t-2xl">
          <SheetHeader className="text-center">
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/40">
              <Smartphone className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <SheetTitle className="text-lg">
              Install Veda ERP on iPhone
            </SheetTitle>
            <SheetDescription className="text-sm">
              Add the app to your home screen — it works just like a native app,
              even offline.
            </SheetDescription>
          </SheetHeader>

          <ol className="mt-6 space-y-4">
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
                1
              </span>
              <div className="flex-1 pt-0.5">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Tap the{" "}
                  <Share className="inline h-4 w-4 align-text-bottom text-emerald-600" />{" "}
                  Share button
                </p>
                <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                  It&apos;s at the bottom-center of Safari (or top-right on
                  iPad).
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
                2
              </span>
              <div className="flex-1 pt-0.5">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Scroll down and tap{" "}
                  <span className="inline-flex items-center gap-1">
                    <PlusSquare className="inline h-4 w-4 align-text-bottom text-emerald-600" />
                    &ldquo;Add to Home Screen&rdquo;
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                  You may need to scroll past a few options.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
                3
              </span>
              <div className="flex-1 pt-0.5">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Tap &ldquo;Add&rdquo;
                </p>
                <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                  That&apos;s it — Veda ERP will appear on your home screen.
                </p>
              </div>
            </li>
          </ol>

          <div className="mt-6 rounded-lg bg-emerald-50 p-3 dark:bg-emerald-900/20">
            <p className="text-xs text-emerald-800 dark:text-emerald-200">
              <strong>Tip:</strong> Once installed, the app opens in full-screen
              mode without the Safari address bar — just like a native app.
            </p>
          </div>

          <Button
            onClick={() => setShowIosSheet(false)}
            className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700"
          >
            Got it
          </Button>
        </SheetContent>
      </Sheet>

      {/* Fallback sheet — Android but beforeinstallprompt hasn't fired yet */}
      <Sheet open={showFallback} onOpenChange={setShowFallback}>
        <SheetContent side="bottom" className="mx-auto max-w-md rounded-t-2xl">
          <SheetHeader>
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/40">
              <Download className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <SheetTitle className="text-center text-lg">
              Install Veda ERP
            </SheetTitle>
            <SheetDescription className="text-center text-sm">
              The browser hasn&apos;t enabled the quick-install yet. You can
              still install it from the browser menu:
            </SheetDescription>
          </SheetHeader>

          <ol className="mt-6 space-y-4">
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
                1
              </span>
              <div className="flex-1 pt-0.5">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Tap the browser menu (⋮ or ⠮)
                </p>
                <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                  Top-right corner of Chrome / Edge / Samsung Browser.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
                2
              </span>
              <div className="flex-1 pt-0.5">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Tap &ldquo;Install app&rdquo; or &ldquo;Add to Home
                  screen&rdquo;
                </p>
                <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                  The option appears after the page has fully loaded.
                </p>
              </div>
            </li>
          </ol>

          <div className="mt-6 rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
            <p className="text-xs text-amber-800 dark:text-amber-200">
              <strong>Note:</strong> If the option doesn&apos;t appear, try
              visiting the site again after a few seconds — the service worker
              needs to register first.
            </p>
          </div>

          <Button
            onClick={() => setShowFallback(false)}
            className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700"
          >
            Got it
          </Button>
        </SheetContent>
      </Sheet>
    </>
  );
}
