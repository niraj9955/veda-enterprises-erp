"use client";

import { useEffect } from "react";

/**
 * Service Worker Registration
 * ============================================
 * Registers /sw.js on the client. This is what makes Android Chrome
 * fire the `beforeinstallprompt` event, which the <InstallPrompt />
 * component listens for.
 *
 * Runs only in production (we don't want SW caching during `next dev`
 * because it would cache stale chunks and make HMR confusing).
 */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Register after window load so it doesn't compete with first paint
    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          // Check for updates every hour
          setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
        })
        .catch((err) => {
          console.warn("[PWA] SW registration failed:", err);
        });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
