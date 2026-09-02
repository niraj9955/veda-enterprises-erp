"use client";

import { useEffect } from "react";

/**
 * Service Worker Registration
 * ============================================
 * Registers /sw.js on the client. This is what makes Android Chrome
 * fire the `beforeinstallprompt` event, which the <InstallPrompt />
 * component listens for.
 *
 * AUTO-UPDATE (critical for a fast-iterating ERP):
 *  - Calls reg.update() on EVERY page load (cheap metadata check) so a new
 *    deploy is picked up within one visit, not "whenever the hourly timer
 *    happens to fire".
 *  - When an updated SW activates (sw.js has skipWaiting + clients.claim),
 *    `controllerchange` fires → we auto-reload the page ONCE so the running
 *    JavaScript is the fresh build. Without this, users could stay on old
 *    code indefinitely (this is exactly why voice seemed "not working" —
 *    the phone was still running the pre-fix bundle).
 *  - Reload is guarded: only when the page was ALREADY controlled by a SW
 *    at mount (a real update takeover), never on first-ever visit, and only
 *    once per page lifetime. This prevents reload loops.
 *
 * Runs only in production (we don't want SW caching during `next dev`
 * because it would cache stale chunks and make HMR confusing).
 */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // If a SW already controlled this page when we mounted, a later
    // controllerchange means an UPDATED SW took over → reload to run it.
    const controlledAtMount = !!navigator.serviceWorker.controller;
    let reloading = false;

    const onControllerChange = () => {
      if (reloading || !controlledAtMount) return;
      reloading = true;
      // New build is live — refresh so the whole page runs the new JS.
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          // Check for an updated SW immediately on every load — deploys
          // reach users within one visit instead of up to an hour later.
          void reg.update().catch(() => {});
          // ... and keep checking hourly for long-lived tabs.
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
      return () => {
        window.removeEventListener("load", register);
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      };
    }
  }, []);

  return null;
}
