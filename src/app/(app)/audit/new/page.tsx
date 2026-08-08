"use client";

import Link from "next/link";
import { Upload, FileCode2 } from "lucide-react";
import { PageHeader, SectionHeader } from "@/components/app/page-header";
import { PrimaryButton, SecondaryButton } from "@/components/app/buttons";
import { CodeBlock } from "@/components/app/code-block";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewAuditPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="New Audit"
        subtitle="Upload a strategy file or paste code to begin static analysis and rule validation."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "New Audit" },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/40 bg-card/40">
          <CardHeader className="p-6">
            <CardTitle className="text-sm flex items-center gap-2">
              <Upload className="h-4 w-4 text-muted-foreground" />
              Upload Strategy
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0 space-y-4">
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-secondary/20 px-6 py-12 text-center">
              <FileCode2 className="h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground">
                Drop your strategy file here
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Python (.py) or Pine Script (.pine)
              </p>
              <SecondaryButton size="sm" className="mt-4 text-xs">
                Browse files
              </SecondaryButton>
            </div>
            <PrimaryButton className="w-full" asChild>
              <Link href="/audit/running">Start Audit</Link>
            </PrimaryButton>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <SectionHeader
            title="Or use the CLI"
            description="Run audits from your terminal."
          />
          <CodeBlock code="quantlint audit strategy.py" />
          <CodeBlock code="pip install quantlint" />
        </div>
      </div>
    </div>
  );
}
