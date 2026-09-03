"use client";

import { useEffect, useState, useCallback } from "react";
import { Download, X, Share, PlusSquare, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/**
 * Install Prompt — Android + iOS
 * ============================================
 *
 * Android (Chrome / Edge / Samsung Browser):
 *  - Listens for `beforeinstallprompt` event
 *  - Shows a custom "Install App" banner with the install button
 *  - Calls `prompt()` on the captured event when user clicks install
 *  - Hides automatically once installed (or if user dismisses 2 times)
 *
 * iOS (Safari):
 *  - iOS does NOT support `beforeinstallprompt` — it can only be installed
 *    via the Share menu → "Add to Home Screen"
 *  - We detect iOS Safari in standalone mode (or not) and show an
 *    instructional sheet with screenshots/icons explaining the steps
 *  - The sheet auto-opens once per device (localStorage flag)
 *
 * Both:
 *  - If the app is already running in standalone mode (installed),
 *    nothing is shown — the install prompt is irrelevant.
 */

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const DISMISS_KEY = "veda-pwa-install-dismissed";
const DISMISS_COUNT_KEY = "veda-pwa-install-dismiss-count";
const IOS_SHOWN_KEY = "veda-pwa-ios-sheet-shown";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari sets navigator.standalone to true when launched from home screen
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  // iPadOS 13+ reports as Mac, so check for touch + Mac platform
  const isIPad =
    /iPad|iPhone|iPod/.test(ua) ||
    (/Mac/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
  return isIPad;
}

function isAndroid() {
  if (typeof window === "undefined") return false;
  return /Android/i.test(window.navigator.userAgent);
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showAndroidBanner, setShowAndroidBanner] = useState(false);
  const [showIosSheet, setShowIosSheet] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Already installed (running in standalone mode) → don't bother
    if (isStandalone()) return;

    const dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    const dismissCount = parseInt(
      localStorage.getItem(DISMISS_COUNT_KEY) || "0",
      10
    );

    // ── Android: listen for beforeinstallprompt ───────────────────
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault(); // Stop Chrome from showing its own default prompt
      const evt = e as BeforeInstallPromptEvent;
      setDeferredPrompt(evt);
      // Only show our banner if user hasn't dismissed it twice already
      if (!dismissed && dismissCount < 2) {
        setShowAndroidBanner(true);
      }
    };

    // ── Detect if app was installed (event fires after install) ──
    const handleAppInstalled = () => {
      setShowAndroidBanner(false);
      setDeferredPrompt(null);
      localStorage.setItem(DISMISS_KEY, "1");
      console.log("[PWA] App installed successfully");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    // ── iOS: show instructions sheet once ─────────────────────────
    if (
      isIOS() &&
      !isStandalone() &&
      !dismissed &&
      localStorage.getItem(IOS_SHOWN_KEY) !== "1"
    ) {
      // Small delay so it doesn't fight with the page's first paint
      const t = setTimeout(() => {
        setShowIosSheet(true);
        localStorage.setItem(IOS_SHOWN_KEY, "1");
      }, 2500);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
        window.removeEventListener("appinstalled", handleAppInstalled);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "dismissed") {
      // Bump dismiss count — after 2 dismissals we stop nagging
      const count = parseInt(
        localStorage.getItem(DISMISS_COUNT_KEY) || "0",
        10
      );
      localStorage.setItem(DISMISS_COUNT_KEY, String(count + 1));
      if (count + 1 >= 2) {
        localStorage.setItem(DISMISS_KEY, "1");
      }
    }
    setDeferredPrompt(null);
    setShowAndroidBanner(false);
  }, [deferredPrompt]);

  const handleAndroidDismiss = useCallback(() => {
    setShowAndroidBanner(false);
    const count = parseInt(
      localStorage.getItem(DISMISS_COUNT_KEY) || "0",
      10
    );
    localStorage.setItem(DISMISS_COUNT_KEY, String(count + 1));
    if (count + 1 >= 2) {
      localStorage.setItem(DISMISS_KEY, "1");
    }
  }, []);

  // Don't render anything until after mount (avoids SSR hydration mismatch)
  if (!mounted) return null;
  // If installed, render nothing
  if (isStandalone()) return null;

  return (
    <>
      {/* ── Android / Chrome install banner ─────────────────────── */}
      {showAndroidBanner && deferredPrompt && (
        <div
          className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-in slide-in-from-bottom-4 duration-300"
          role="dialog"
          aria-labelledby="pwa-install-title"
        >
          <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-2xl dark:border-emerald-900 dark:bg-zinc-900">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                <Download className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <h3
                  id="pwa-install-title"
                  className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
                >
                  Install Veda ERP
                </h3>
                <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                  Add to your home screen for quick access — works offline too.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleInstallClick}
                    className="h-8 bg-emerald-600 text-xs hover:bg-emerald-700"
                  >
                    <Download className="mr-1 h-3.5 w-3.5" />
                    Install
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleAndroidDismiss}
                    className="h-8 text-xs"
                  >
                    Not now
                  </Button>
                </div>
              </div>
              <button
                onClick={handleAndroidDismiss}
                aria-label="Dismiss"
                className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── iOS instructions sheet ─────────────────────────────── */}
      <Sheet open={showIosSheet} onOpenChange={setShowIosSheet}>
        <SheetContent
          side="bottom"
          className="mx-auto max-w-md rounded-t-2xl"
        >
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
    </>
  );
}
