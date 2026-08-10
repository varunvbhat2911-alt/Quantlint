"use client";

import * as React from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { usePreferences } from "@/hooks/use-preferences";

const SPLASH_SESSION_KEY = "quantlint_splash_seen";

export function SplashScreen({ children }: { children: React.ReactNode }) {
  const { preferences } = usePreferences();
  const [showSplash, setShowSplash] = React.useState<boolean | null>(null);
  const [stage, setStage] = React.useState<"artwork" | "fadeout">("artwork");

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

    // If reduce motion is enabled, show minimal brief splash (~300ms)
    if (preferences.reduceMotion) {
      const timer = setTimeout(() => {
        setStage("fadeout");
        setTimeout(() => {
          setShowSplash(false);
          try {
            sessionStorage.setItem(SPLASH_SESSION_KEY, "true");
          } catch {}
        }, 200);
      }, 300);
      return () => clearTimeout(timer);
    }

    // Sequence timing (total ~3.5 seconds)
    // 0ms – 1000ms:  Black background, artwork fades/scales in
    // 1000ms – 3000ms: Artwork remains clearly visible
    // 3000ms – 3500ms: Smooth fade into the application
    const fadeoutTimer = setTimeout(() => {
      setStage("fadeout");
    }, 3000);

    const doneTimer = setTimeout(() => {
      setShowSplash(false);
      try {
        sessionStorage.setItem(SPLASH_SESSION_KEY, "true");
      } catch {}
    }, 3500);

    return () => {
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
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black select-none pointer-events-none"
          >
            {/* Full Bull/Bear QuantLint Artwork — the only splash visual */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="flex items-center justify-center p-6"
            >
              <Image
                src="/branding/quantlint-artwork-2000.png"
                alt="QuantLint bull and bear brand artwork"
                width={600}
                height={600}
                className="w-[340px] sm:w-[480px] md:w-[560px] lg:w-[600px] max-h-[70vh] max-w-[90vw] object-contain"
                priority
                unoptimized
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </>
  );
}
