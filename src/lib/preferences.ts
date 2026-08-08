import {
  type AnalysisDepth,
  type Framework,
  type RuleCategory,
  RULE_CATEGORIES,
} from "@/lib/audit-draft";

export type ThemePreference = "dark" | "light" | "system";

export type NotificationPreferences = {
  auditCompleted: boolean;
  criticalFindings: boolean;
  reportReady: boolean;
  documentationUpdates: boolean;
};

export type QuantLintPreferences = {
  theme: ThemePreference;
  compactMode: boolean;
  reduceMotion: boolean;
  showTooltips: boolean;
  defaultAnalysisDepth: AnalysisDepth;
  defaultFramework: Framework;
  defaultRuleCategories: RuleCategory[];
  notifications: NotificationPreferences;
};

export const PREFERENCES_STORAGE_KEY = "quantlint_preferences";

export const DEFAULT_PREFERENCES: QuantLintPreferences = {
  theme: "dark",
  compactMode: false,
  reduceMotion: false,
  showTooltips: true,
  defaultAnalysisDepth: "standard",
  defaultFramework: "auto",
  defaultRuleCategories: [...RULE_CATEGORIES],
  notifications: {
    auditCompleted: true,
    criticalFindings: true,
    reportReady: true,
    documentationUpdates: false,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "dark" || value === "light" || value === "system";
}

function isAnalysisDepth(value: unknown): value is AnalysisDepth {
  return value === "standard" || value === "deep" || value === "fast";
}

function isFramework(value: unknown): value is Framework {
  return (
    value === "auto" ||
    value === "vectorbt" ||
    value === "backtrader" ||
    value === "zipline" ||
    value === "pandas"
  );
}

function isRuleCategory(value: unknown): value is RuleCategory {
  return (
    typeof value === "string" &&
    (RULE_CATEGORIES as readonly string[]).includes(value)
  );
}

function parseNotifications(value: unknown): NotificationPreferences {
  if (!isRecord(value)) {
    return DEFAULT_PREFERENCES.notifications;
  }

  return {
    auditCompleted:
      typeof value.auditCompleted === "boolean"
        ? value.auditCompleted
        : DEFAULT_PREFERENCES.notifications.auditCompleted,
    criticalFindings:
      typeof value.criticalFindings === "boolean"
        ? value.criticalFindings
        : DEFAULT_PREFERENCES.notifications.criticalFindings,
    reportReady:
      typeof value.reportReady === "boolean"
        ? value.reportReady
        : DEFAULT_PREFERENCES.notifications.reportReady,
    documentationUpdates:
      typeof value.documentationUpdates === "boolean"
        ? value.documentationUpdates
        : DEFAULT_PREFERENCES.notifications.documentationUpdates,
  };
}

export function parsePreferences(value: unknown): QuantLintPreferences {
  if (!isRecord(value)) {
    return DEFAULT_PREFERENCES;
  }

  const ruleCategories = Array.isArray(value.defaultRuleCategories)
    ? value.defaultRuleCategories.filter(isRuleCategory)
    : DEFAULT_PREFERENCES.defaultRuleCategories;

  return {
    theme: isThemePreference(value.theme)
      ? value.theme
      : DEFAULT_PREFERENCES.theme,
    compactMode:
      typeof value.compactMode === "boolean"
        ? value.compactMode
        : DEFAULT_PREFERENCES.compactMode,
    reduceMotion:
      typeof value.reduceMotion === "boolean"
        ? value.reduceMotion
        : DEFAULT_PREFERENCES.reduceMotion,
    showTooltips:
      typeof value.showTooltips === "boolean"
        ? value.showTooltips
        : DEFAULT_PREFERENCES.showTooltips,
    defaultAnalysisDepth: isAnalysisDepth(value.defaultAnalysisDepth)
      ? value.defaultAnalysisDepth
      : DEFAULT_PREFERENCES.defaultAnalysisDepth,
    defaultFramework: isFramework(value.defaultFramework)
      ? value.defaultFramework
      : DEFAULT_PREFERENCES.defaultFramework,
    defaultRuleCategories:
      ruleCategories.length > 0
        ? ruleCategories
        : DEFAULT_PREFERENCES.defaultRuleCategories,
    notifications: parseNotifications(value.notifications),
  };
}

export function loadPreferences(): QuantLintPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_PREFERENCES;
  }

  try {
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_PREFERENCES;
    }
    return parsePreferences(JSON.parse(raw));
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(preferences: QuantLintPreferences): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences)
    );
  } catch {
    // Storage unavailable — ignore
  }
}
