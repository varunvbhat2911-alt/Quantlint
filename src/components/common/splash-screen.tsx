"use client";

import * as React from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { usePreferences } from "@/hooks/use-preferences";

const SPLASH_SESSION_KEY = "quantlint_splash_seen";

export function SplashScreen({ children }: { children: React.ReactNode }) {
  const { preferences } = usePreferences();
  const [showSplash, setShowSplash] = React.useState<boolean | null>(null);
  const [stage, setStage] = React.useState<"logo" | "artwork" | "fadeout">("logo");

  React.useEffect(() => {
    // Check session storage so splash only runs on initial load
    try {
      const seen = sessionStorage.getItem(SPLASH_SESSION_KEY);
      if (seen) {
        setShowSplash(false);
        return;
      }
    } catch {
      // Fallback if sessionStorage is disabled
    }

    setShowSplash(true);

    // If reduce motion is enabled, show minimal brief splash (~200ms)
    if (preferences.reduceMotion) {
      const timer = setTimeout(() => {
        setStage("fadeout");
        setTimeout(() => {
          setShowSplash(false);
          try {
            sessionStorage.setItem(SPLASH_SESSION_KEY, "true");
          } catch {}
        }, 150);
      }, 200);
      return () => clearTimeout(timer);
    }

    // Sequence timing (total ~2.0 seconds)
    // 0ms - 500ms: QL logo on black background
    // 500ms - 1500ms: Transition to full Bull/Bear artwork
    // 1500ms - 1950ms: Artwork holds then smoothly fades into application
    const artworkTimer = setTimeout(() => {
      setStage("artwork");
    }, 500);

    const fadeoutTimer = setTimeout(() => {
      setStage("fadeout");
    }, 1500);

    const doneTimer = setTimeout(() => {
      setShowSplash(false);
      try {
        sessionStorage.setItem(SPLASH_SESSION_KEY, "true");
      } catch {}
    }, 1950);

    return () => {
      clearTimeout(artworkTimer);
      clearTimeout(fadeoutTimer);
      clearTimeout(doneTimer);
    };
  }, [preferences.reduceMotion]);

  // Don't render anything until client check completes
  if (showSplash === null) {
    return <>{children}</>;
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {showSplash && (
          <motion.div
            key="splash-screen"
            initial={{ opacity: 1 }}
            animate={{ opacity: stage === "fadeout" ? 0 : 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: "easeInOut" }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black select-none pointer-events-none"
          >
            <div className="relative flex items-center justify-center p-4">
              {/* STEP 1: QL Logo Mark (0ms - 500ms) */}
              {stage === "logo" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.04 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="flex items-center justify-center"
                >
                  <Image
                    src="/branding/quantlint-ql.svg"
                    alt="QuantLint QL logo"
                    width={112}
                    height={112}
                    className="h-24 w-24 sm:h-28 sm:w-28 object-contain"
                    priority
                  />
                </motion.div>
              )}

              {/* STEP 2: Full Bull/Bear Artwork (500ms - 2000ms) */}
              {(stage === "artwork" || stage === "fadeout") && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="flex items-center justify-center max-w-sm sm:max-w-lg px-6"
                >
                  <Image
                    src="/branding/quantlint-artwork-2000.png"
                    alt="QuantLint bull and bear brand artwork"
                    width={480}
                    height={480}
                    className="h-56 w-56 sm:h-80 sm:w-80 max-h-[55vh] max-w-[85vw] object-contain"
                    priority
                  />
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </>
  );
}
