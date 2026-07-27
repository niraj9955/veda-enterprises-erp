"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Download, Share, PlusSquare, Smartphone, X, Clock, Chrome, Menu } from "lucide-react";
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
 *    if available. If beforeinstallprompt hasn't fired yet, shows a
 *    helpful sheet with:
 *      • A retry/wait option (SW may still be registering)
 *      • A direct APK download link as fallback (instant install)
 *      • Manual Chrome menu instructions
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
  const [swReady, setSwReady] = useState(false);
  const waitedRef = useRef(false);

  useEffect(() => {
    setMounted(true);

    if (isStandalone()) return; // already installed

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // SW is now ready since beforeinstallprompt fired
      setSwReady(true);
    };
    const installedHandler = () => {
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);

    // Check if SW is already registered
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration("/").then((reg) => {
        if (reg) {
          setSwReady(true);
          // If SW is registered but beforeinstallprompt hasn't fired in 5s,
          // it likely won't fire (user needs 30s engagement or already dismissed)
          setTimeout(() => {
            if (!waitedRef.current) {
              waitedRef.current = true;
            }
          }, 5000);
        }
      });
    }

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
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setDeferredPrompt(null);
        }
      } catch (err) {
        // prompt() can throw if called twice — fall back to manual instructions
        setShowFallback(true);
      }
      return;
    }
    // Android but beforeinstallprompt hasn't fired yet — show helpful fallback
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

      {/* Android fallback sheet — much more helpful now */}
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
              Two easy ways to install on your phone:
            </SheetDescription>
          </SheetHeader>

          {/* Option 1: Direct APK download — instant install */}
          <div className="mt-5 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-900/20">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                A
              </span>
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                Direct APK Install (Recommended)
              </p>
            </div>
            <p className="mb-3 text-xs text-emerald-800 dark:text-emerald-200">
              Download the standalone Android app — installs immediately, no
              browser needed.
            </p>
            <a
              href="/Veda-ERP.apk"
              download
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <Download className="h-4 w-4" />
              Download APK
            </a>
          </div>

          {/* Option 2: Chrome menu install */}
          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-600 text-xs font-bold text-white">
                B
              </span>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Install via Chrome Menu
              </p>
            </div>
            <ol className="space-y-3">
              <li className="flex gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-300 text-xs font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100">
                  1
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Tap the{" "}
                    <Menu className="inline h-4 w-4 align-text-bottom text-zinc-600" />{" "}
                    menu (⋮)
                  </p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    Top-right corner of Chrome.
                  </p>
                </div>
              </li>
              <li className="flex gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-300 text-xs font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100">
                  2
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Tap &ldquo;Install app&rdquo; or &ldquo;Add to Home
                    screen&rdquo;
                  </p>
                </div>
              </li>
            </ol>
          </div>

          {/* Status note */}
          {!swReady && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-xs text-amber-800 dark:text-amber-200">
                <strong>Just a moment:</strong> The service worker is still
                registering. If the Chrome menu doesn&apos;t show
                &ldquo;Install app&rdquo; yet, wait 30 seconds, refresh the
                page, then try again — or use the APK download above for
                instant install.
              </p>
            </div>
          )}

          <Button
            onClick={() => setShowFallback(false)}
            variant="outline"
            className="mt-4 w-full"
          >
            Close
          </Button>
        </SheetContent>
      </Sheet>
    </>
  );
}
