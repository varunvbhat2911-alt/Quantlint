"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import {
  type QuantLintPreferences,
  type ThemePreference,
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
} from "@/lib/preferences";

type PreferenceKey = keyof QuantLintPreferences;

type PreferencesContextValue = {
  preferences: QuantLintPreferences;
  mounted: boolean;
  updatePreference: <K extends PreferenceKey>(
    key: K,
    value: QuantLintPreferences[K]
  ) => void;
  updatePreferences: (
    patch: Partial<QuantLintPreferences>
  ) => void;
  resetPreferences: () => void;
  resetSection: (section: "interface" | "audit" | "notifications") => void;
};

const PreferencesContext = React.createContext<PreferencesContextValue | null>(
  null
);

export function changeThemeWithTransition(
  newTheme: ThemePreference,
  setTheme: (theme: string) => void,
  reduceMotion: boolean = false
) {
  const applyTheme = () => setTheme(newTheme);

  const isReduced =
    reduceMotion ||
    (typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  if (
    !isReduced &&
    typeof document !== "undefined" &&
    "startViewTransition" in document
  ) {
    (
      document as Document & {
        startViewTransition: (callback: () => void) => void;
      }
    ).startViewTransition(applyTheme);
  } else {
    applyTheme();
  }
}

function applyDocumentAttributes(preferences: QuantLintPreferences): void {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.classList.toggle("quantlint-compact", preferences.compactMode);
  root.classList.toggle("quantlint-reduce-motion", preferences.reduceMotion);
  root.dataset.compactMode = preferences.compactMode ? "true" : "false";
  root.dataset.reduceMotion = preferences.reduceMotion ? "true" : "false";
}

export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme: nextTheme, setTheme } = useTheme();
  const [nonThemePreferences, setNonThemePreferences] =
    React.useState<Omit<QuantLintPreferences, "theme">>(() => {
      const { theme: _, ...rest } = DEFAULT_PREFERENCES;
      return rest;
    });
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    const stored = loadPreferences();
    const { theme: _, ...rest } = stored;
    setNonThemePreferences(rest);
    applyDocumentAttributes(stored);
    setMounted(true);
  }, []);

  const activeTheme: ThemePreference =
    (nextTheme as ThemePreference) || "dark";

  const preferences: QuantLintPreferences = React.useMemo(
    () => ({
      ...nonThemePreferences,
      theme: activeTheme,
    }),
    [nonThemePreferences, activeTheme]
  );

  const updatePreference = React.useCallback(
    <K extends PreferenceKey>(key: K, value: QuantLintPreferences[K]) => {
      if (key === "theme") {
        changeThemeWithTransition(
          value as ThemePreference,
          setTheme,
          nonThemePreferences.reduceMotion
        );
        return;
      }

      setNonThemePreferences((current) => {
        const next = { ...current, [key]: value };
        const fullPrefs = { ...next, theme: activeTheme };
        savePreferences(fullPrefs);
        applyDocumentAttributes(fullPrefs);
        return next;
      });
    },
    [setTheme, nonThemePreferences.reduceMotion, activeTheme]
  );

  const updatePreferences = React.useCallback(
    (patch: Partial<QuantLintPreferences>) => {
      if (patch.theme) {
        changeThemeWithTransition(
          patch.theme,
          setTheme,
          nonThemePreferences.reduceMotion
        );
      }

      const { theme: _, ...restPatch } = patch;
      if (Object.keys(restPatch).length > 0) {
        setNonThemePreferences((current) => {
          const next = { ...current, ...restPatch };
          const fullPrefs = { ...next, theme: activeTheme };
          savePreferences(fullPrefs);
          applyDocumentAttributes(fullPrefs);
          return next;
        });
      }
    },
    [setTheme, nonThemePreferences.reduceMotion, activeTheme]
  );

  const resetPreferences = React.useCallback(() => {
    const { theme: defaultTheme, ...restDefaults } = DEFAULT_PREFERENCES;
    setNonThemePreferences(restDefaults);
    savePreferences(DEFAULT_PREFERENCES);
    applyDocumentAttributes(DEFAULT_PREFERENCES);
    changeThemeWithTransition(
      defaultTheme,
      setTheme,
      DEFAULT_PREFERENCES.reduceMotion
    );
  }, [setTheme]);

  const resetSection = React.useCallback(
    (section: "interface" | "audit" | "notifications") => {
      setNonThemePreferences((current) => {
        let next = { ...current };

        if (section === "interface") {
          next = {
            ...next,
            compactMode: DEFAULT_PREFERENCES.compactMode,
            reduceMotion: DEFAULT_PREFERENCES.reduceMotion,
            showTooltips: DEFAULT_PREFERENCES.showTooltips,
          };
        } else if (section === "audit") {
          next = {
            ...next,
            defaultAnalysisDepth: DEFAULT_PREFERENCES.defaultAnalysisDepth,
            defaultFramework: DEFAULT_PREFERENCES.defaultFramework,
            defaultRuleCategories: [
              ...DEFAULT_PREFERENCES.defaultRuleCategories,
            ],
          };
        } else {
          next = {
            ...next,
            notifications: { ...DEFAULT_PREFERENCES.notifications },
          };
        }

        const fullPrefs = { ...next, theme: activeTheme };
        savePreferences(fullPrefs);
        applyDocumentAttributes(fullPrefs);
        return next;
      });
    },
    [activeTheme]
  );

  const value = React.useMemo(
    () => ({
      preferences,
      mounted,
      updatePreference,
      updatePreferences,
      resetPreferences,
      resetSection,
    }),
    [
      preferences,
      mounted,
      updatePreference,
      updatePreferences,
      resetPreferences,
      resetSection,
    ]
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const context = React.useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within PreferencesProvider");
  }
  return context;
}

export function useShowTooltips(): boolean {
  const { preferences, mounted } = usePreferences();
  return mounted ? preferences.showTooltips : DEFAULT_PREFERENCES.showTooltips;
}
