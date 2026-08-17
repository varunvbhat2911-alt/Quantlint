"use client";

import { useEffect } from "react";

/**
 * Registers the QuantLint service worker on mount.
 *
 * Only runs in the browser, only when the browser supports service workers,
 * and only on HTTPS (or localhost for development). The service worker uses
 * a conservative caching strategy that never caches authenticated or private
 * data — see /public/sw.js for details.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    /* Service workers require HTTPS except on localhost */
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    const isSecure = window.location.protocol === "https:" || isLocalhost;
    if (!isSecure) return;

    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          /* Check for updates daily */
          setInterval(() => {
            registration.update();
          }, 24 * 60 * 60 * 1000);
        })
        .catch(() => {
          /* Registration failed — the app still works normally */
        });
    });
  }, []);

  return null;
}
