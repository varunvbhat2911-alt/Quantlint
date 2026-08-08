"use client";

import * as React from "react";
import Link from "next/link";
import {
  ExternalLink,
  KeyRound,
  Moon,
  Sun,
  Monitor,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/app/page-header";
import { PrimaryButton, SecondaryButton } from "@/components/app/buttons";
import { useToast } from "@/components/app/toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  SettingsSection,
  SettingsRow,
} from "@/components/settings/settings-section";
import {
  SettingsNavigation,
  scrollToSettingsSection,
  type SettingsNavItem,
} from "@/components/settings/settings-navigation";
import { usePreferences } from "@/hooks/use-preferences";
import {
  type ThemePreference,
} from "@/lib/preferences";
import {
  FRAMEWORK_OPTIONS,
  ANALYSIS_DEPTH_OPTIONS,
  RULE_CATEGORIES,
  type RuleCategory,
} from "@/lib/audit-draft";

const SETTINGS_NAV: SettingsNavItem[] = [
  { id: "appearance", label: "Appearance" },
  { id: "interface-preferences", label: "Preferences" },
  { id: "audit-preferences", label: "Audit" },
  { id: "notifications", label: "Notifications" },
  { id: "api-keys", label: "API Keys" },
  { id: "about", label: "About" },
  { id: "danger-zone", label: "Danger Zone" },
];

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: React.ElementType;
}[] = [
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
];

const GITHUB_URL = "https://github.com";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function ThemeSelector({
  value,
  onChange,
  onUpdated,
}: {
  value: ThemePreference;
  onChange: (theme: ThemePreference) => void;
  onUpdated: () => void;
}) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="radiogroup"
      aria-label="Theme"
    >
      {THEME_OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              onChange(option.value);
              onUpdated();
            }}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "border-foreground/20 bg-secondary text-foreground"
                : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function RuleCategoryGrid({
  selected,
  onChange,
}: {
  selected: RuleCategory[];
  onChange: (categories: RuleCategory[]) => void;
}) {
  function toggleCategory(category: RuleCategory) {
    if (selected.includes(category)) {
      onChange(selected.filter((item) => item !== category));
    } else {
      onChange([...selected, category]);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {RULE_CATEGORIES.map((category) => {
        const checked = selected.includes(category);
        const inputId = `rule-${category.toLowerCase().replace(/\s+/g, "-")}`;
        return (
          <label
            key={category}
            htmlFor={inputId}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors",
              checked
                ? "border-foreground/15 bg-secondary/40"
                : "border-border/40 hover:border-border/60"
            )}
          >
            <input
              id={inputId}
              type="checkbox"
              checked={checked}
              onChange={() => toggleCategory(category)}
              className="h-4 w-4 rounded border-border accent-foreground"
            />
            <span className="text-foreground">{category}</span>
          </label>
        );
      })}
    </div>
  );
}

function DisabledApiButton({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon: React.ElementType;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled
      aria-disabled="true"
      title="API access is not available yet"
      className="opacity-50"
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </Button>
  );
}

export default function SettingsPage() {
  const {
    preferences,
    mounted,
    updatePreference,
    resetPreferences,
    resetSection,
  } = usePreferences();
  const { showToast, toastElement } = useToast();
  const [activeSection, setActiveSection] = React.useState("appearance");
  const [resetDialogOpen, setResetDialogOpen] = React.useState(false);

  React.useEffect(() => {
    const sections = SETTINGS_NAV.map((item) => item.id);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) {
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.25, 0.5] }
    );

    sections.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, []);

  function handleNavSelect(id: string) {
    setActiveSection(id);
    scrollToSettingsSection(id);
  }

  function handleResetConfirm() {
    resetPreferences();
    setResetDialogOpen(false);
    showToast("Preferences reset to defaults.");
  }

  if (!mounted) {
    return (
      <div className="space-y-10">
        <PageHeader
          title="Settings"
          subtitle="Manage your QuantLint preferences and analysis configuration."
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Settings" },
          ]}
        />
        <div className="h-64 animate-pulse rounded-xl border border-border/40 bg-card/40" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8">
        <PageHeader
          title="Settings"
          subtitle="Manage your QuantLint preferences and analysis configuration."
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Settings" },
          ]}
        />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[200px_1fr] xl:grid-cols-[220px_1fr]">
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <SettingsNavigation
              items={SETTINGS_NAV}
              activeId={activeSection}
              onSelect={handleNavSelect}
            />
          </aside>

          <div className="min-w-0 space-y-10">
            {/* Appearance */}
            <SettingsSection
              id="appearance"
              title="Appearance"
              description="Customize how QuantLint looks."
            >
              <Card className="border-border/40 bg-card/40">
                <CardContent className="p-5">
                  <SettingsRow label="Theme" htmlFor="theme-dark">
                    <ThemeSelector
                      value={preferences.theme}
                      onChange={(theme) => updatePreference("theme", theme)}
                      onUpdated={() =>
                        showToast("Theme preference updated.")
                      }
                    />
                  </SettingsRow>
                </CardContent>
              </Card>
            </SettingsSection>

            {/* Interface Preferences */}
            <SettingsSection
              id="interface-preferences"
              title="Interface Preferences"
              action={
                <button
                  type="button"
                  onClick={() => {
                    resetSection("interface");
                    showToast("Interface preferences reset to defaults.");
                  }}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Reset to default
                </button>
              }
            >
              <Card className="border-border/40 bg-card/40">
                <CardContent className="p-5">
                  <SettingsRow
                    label="Compact Mode"
                    description="Use denser spacing throughout the application."
                    htmlFor="compact-mode"
                  >
                    <Switch
                      id="compact-mode"
                      checked={preferences.compactMode}
                      onCheckedChange={(checked) => {
                        updatePreference("compactMode", checked);
                        showToast("Preference updated.");
                      }}
                      aria-labelledby="compact-mode-label"
                      aria-describedby="compact-mode-description"
                    />
                  </SettingsRow>
                  <SettingsRow
                    label="Reduce Motion"
                    description="Reduce non-essential interface animations."
                    htmlFor="reduce-motion"
                  >
                    <Switch
                      id="reduce-motion"
                      checked={preferences.reduceMotion}
                      onCheckedChange={(checked) => {
                        updatePreference("reduceMotion", checked);
                        showToast("Preference updated.");
                      }}
                    />
                  </SettingsRow>
                  <SettingsRow
                    label="Show Tooltips"
                    description="Display contextual explanations for technical metrics and controls."
                    htmlFor="show-tooltips"
                  >
                    <Switch
                      id="show-tooltips"
                      checked={preferences.showTooltips}
                      onCheckedChange={(checked) => {
                        updatePreference("showTooltips", checked);
                        showToast("Preference updated.");
                      }}
                    />
                  </SettingsRow>
                </CardContent>
              </Card>
            </SettingsSection>

            {/* Audit Preferences */}
            <SettingsSection
              id="audit-preferences"
              title="Audit Preferences"
              description="Set default values for new strategy audits."
              action={
                <button
                  type="button"
                  onClick={() => {
                    resetSection("audit");
                    showToast("Audit preferences reset to defaults.");
                  }}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Reset to default
                </button>
              }
            >
              <Card className="border-border/40 bg-card/40">
                <CardContent className="space-y-6 p-5">
                  <SettingsRow
                    label="Default Analysis Depth"
                    htmlFor="default-analysis-depth"
                  >
                    <select
                      id="default-analysis-depth"
                      value={preferences.defaultAnalysisDepth}
                      onChange={(event) => {
                        updatePreference(
                          "defaultAnalysisDepth",
                          event.target.value as typeof preferences.defaultAnalysisDepth
                        );
                        showToast("Preference updated.");
                      }}
                      className="min-w-[140px] rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {ANALYSIS_DEPTH_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </SettingsRow>

                  <SettingsRow
                    label="Default Framework"
                    htmlFor="default-framework"
                  >
                    <select
                      id="default-framework"
                      value={preferences.defaultFramework}
                      onChange={(event) => {
                        updatePreference(
                          "defaultFramework",
                          event.target.value as typeof preferences.defaultFramework
                        );
                        showToast("Preference updated.");
                      }}
                      className="min-w-[160px] rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {FRAMEWORK_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </SettingsRow>

                  <div className="space-y-3 border-t border-border/40 pt-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        Default Rule Categories
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Categories enabled by default on the New Audit page.
                      </p>
                    </div>
                    <RuleCategoryGrid
                      selected={preferences.defaultRuleCategories}
                      onChange={(categories) => {
                        updatePreference("defaultRuleCategories", categories);
                        showToast("Preference updated.");
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            </SettingsSection>

            {/* Notifications */}
            <SettingsSection
              id="notifications"
              title="Notifications"
              description="Configure notification preferences for audit events."
              action={
                <button
                  type="button"
                  onClick={() => {
                    resetSection("notifications");
                    showToast("Notification preferences reset to defaults.");
                  }}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Reset to default
                </button>
              }
            >
              <Card className="border-border/40 bg-card/40">
                <CardContent className="p-5">
                  <p className="mb-4 text-xs text-muted-foreground leading-relaxed">
                    Notification delivery will be available once accounts and
                    backend services are connected.
                  </p>
                  <SettingsRow
                    label="Audit Completed"
                    description="Receive a notification when an audit finishes."
                    htmlFor="notify-audit-completed"
                  >
                    <Switch
                      id="notify-audit-completed"
                      checked={preferences.notifications.auditCompleted}
                      onCheckedChange={(checked) => {
                        updatePreference("notifications", {
                          ...preferences.notifications,
                          auditCompleted: checked,
                        });
                        showToast("Preference updated.");
                      }}
                    />
                  </SettingsRow>
                  <SettingsRow
                    label="Critical Findings"
                    description="Notify when critical audit findings are detected."
                    htmlFor="notify-critical-findings"
                  >
                    <Switch
                      id="notify-critical-findings"
                      checked={preferences.notifications.criticalFindings}
                      onCheckedChange={(checked) => {
                        updatePreference("notifications", {
                          ...preferences.notifications,
                          criticalFindings: checked,
                        });
                        showToast("Preference updated.");
                      }}
                    />
                  </SettingsRow>
                  <SettingsRow
                    label="Report Ready"
                    description="Notify when a report is available."
                    htmlFor="notify-report-ready"
                  >
                    <Switch
                      id="notify-report-ready"
                      checked={preferences.notifications.reportReady}
                      onCheckedChange={(checked) => {
                        updatePreference("notifications", {
                          ...preferences.notifications,
                          reportReady: checked,
                        });
                        showToast("Preference updated.");
                      }}
                    />
                  </SettingsRow>
                  <SettingsRow
                    label="Documentation Updates"
                    description="Receive updates about QuantLint documentation."
                    htmlFor="notify-docs-updates"
                  >
                    <Switch
                      id="notify-docs-updates"
                      checked={preferences.notifications.documentationUpdates}
                      onCheckedChange={(checked) => {
                        updatePreference("notifications", {
                          ...preferences.notifications,
                          documentationUpdates: checked,
                        });
                        showToast("Preference updated.");
                      }}
                    />
                  </SettingsRow>
                </CardContent>
              </Card>
            </SettingsSection>

            {/* API Keys */}
            <SettingsSection
              id="api-keys"
              title="API Keys"
              description="Use API keys to integrate QuantLint into your research and development workflows."
            >
              <Card className="border-border/40 bg-card/40">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">COMING SOON</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    API access is not available yet. API keys will become
                    available when the QuantLint API is launched.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <DisabledApiButton icon={Plus}>
                      Create API Key
                    </DisabledApiButton>
                    <DisabledApiButton icon={Eye}>Reveal</DisabledApiButton>
                    <DisabledApiButton icon={EyeOff}>Hide</DisabledApiButton>
                    <DisabledApiButton icon={Copy}>Copy</DisabledApiButton>
                    <DisabledApiButton icon={Trash2}>Revoke</DisabledApiButton>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/60 bg-secondary/20 px-4 py-6 text-sm text-muted-foreground">
                    <KeyRound className="h-4 w-4 shrink-0 opacity-60" />
                    <span>No API keys configured</span>
                  </div>
                </CardContent>
              </Card>
            </SettingsSection>

            {/* About */}
            <SettingsSection id="about" title="About">
              <Card className="border-border/40 bg-card/40">
                <CardContent className="space-y-5 p-5">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-foreground">
                      QuantLint
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Quality assurance for quantitative trading.
                    </p>
                  </div>
                  <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-muted-foreground">Version</dt>
                      <dd className="font-medium text-foreground">v0.1.0</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Environment
                      </dt>
                      <dd className="font-medium text-foreground">
                        Development Preview
                      </dd>
                    </div>
                  </dl>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href="/docs"
                      className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/50"
                    >
                      View Documentation
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </Link>
                    <a
                      href={GITHUB_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/50"
                    >
                      <GithubIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      GitHub
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </a>
                  </div>
                </CardContent>
              </Card>
            </SettingsSection>

            {/* Danger Zone */}
            <SettingsSection
              id="danger-zone"
              title="Danger Zone"
              description="Reset local preferences stored in your browser."
            >
              <Card className="border-destructive/20 bg-card/40">
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Reset Local Preferences
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Restore QuantLint interface and audit preferences to their
                      defaults.
                    </p>
                  </div>
                  <SecondaryButton
                    className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
                    onClick={() => setResetDialogOpen(true)}
                  >
                    Reset Preferences
                  </SecondaryButton>
                </CardContent>
              </Card>
            </SettingsSection>
          </div>
        </div>
      </div>

      <Dialog
        open={resetDialogOpen}
        onOpenChange={setResetDialogOpen}
        title="Reset all local preferences?"
        description="This will restore your QuantLint preferences to their default values."
      >
        <DialogActions>
          <SecondaryButton onClick={() => setResetDialogOpen(false)}>
            Cancel
          </SecondaryButton>
          <PrimaryButton
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={handleResetConfirm}
          >
            Reset Preferences
          </PrimaryButton>
        </DialogActions>
      </Dialog>

      {toastElement}
    </>
  );
}
