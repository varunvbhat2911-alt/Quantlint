"use client";

import { PageHeader, SectionHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeBlock } from "@/components/app/code-block";
import { ThemeToggle } from "@/components/common/theme-toggle";

export default function SettingsPage() {
  return (
    <div className="space-y-10 max-w-2xl">
      <PageHeader
        title="Settings"
        subtitle="Manage your workspace preferences and API configuration."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings" },
        ]}
      />

      <section>
        <SectionHeader title="Appearance" />
        <Card className="border-border/40 bg-card/40">
          <CardHeader className="p-5">
            <CardTitle className="text-sm">Theme</CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Switch between dark and light mode.
            </p>
            <ThemeToggle />
          </CardContent>
        </Card>
      </section>

      <section>
        <SectionHeader title="API Key" description="Use this key for CLI and API access." />
        <CodeBlock code="export QUANTLINT_API_KEY=ql_live_your_key_here" />
      </section>

      <section>
        <SectionHeader title="Default Language" />
        <Card className="border-border/40 bg-card/40">
          <CardContent className="p-5">
            <select
              className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              defaultValue="python"
            >
              <option value="python">Python</option>
              <option value="pine">Pine Script</option>
            </select>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
