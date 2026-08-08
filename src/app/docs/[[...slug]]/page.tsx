import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Terminal,
  Shield,
  BarChart3,
  Code2,
  Blocks,
  FileText,
  AlertCircle,
} from "lucide-react";
import { DocumentationLayout } from "@/components/layouts/documentation-layout";
import { PageHeader } from "@/components/app/page-header";
import { CodeBlock } from "@/components/app/code-block";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/app/empty-state";
import { PrimaryButton, SecondaryButton } from "@/components/app/buttons";
import {
  DOCS_REGISTRY,
  getDocBySlug,
  getDocPagination,
  type DocPage,
  type DocStatus,
} from "@/lib/docs/registry";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const slugPath = slug ? slug.join("/") : "getting-started";
  const doc = getDocBySlug(slugPath);

  return {
    title: doc
      ? `${doc.title} — QuantLint Documentation`
      : "Documentation — QuantLint",
    description: doc?.description,
  };
}

/* ── Status Badge ────────────────────────────────────────── */

function StatusBadge({ status }: { status: DocStatus }) {
  if (status === "available") return null;

  const config: Record<
    Exclude<DocStatus, "available">,
    { label: string; description: string; className: string }
  > = {
    planned: {
      label: "PLANNED INTERFACE",
      description:
        "This functionality is part of the planned QuantLint architecture and is not currently live.",
      className: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    },
    example: {
      label: "DEMONSTRATION / EXAMPLE",
      description:
        "This is an illustrative code example. Commands or APIs shown are for documentation purposes.",
      className: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    },
    "coming-soon": {
      label: "COMING SOON",
      description: "This feature is currently under active development.",
      className: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    },
  };

  const item = config[status as keyof typeof config];
  if (!item) return null;

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border p-3.5 text-xs leading-relaxed",
        item.className
      )}
    >
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
      <div>
        <span className="font-mono font-bold tracking-wider mr-2">
          [{item.label}]
        </span>
        <span>{item.description}</span>
      </div>
    </div>
  );
}

/* ── Home Page Category Grid ──────────────────────────────── */

const PORTAL_CATEGORIES = [
  {
    title: "Getting Started",
    description: "Install QuantLint and run your first strategy audit.",
    href: "/docs/getting-started",
    icon: BookOpen,
  },
  {
    title: "CLI Reference",
    description: "Run audits and manage configuration directly from your terminal.",
    href: "/docs/cli",
    icon: Terminal,
    badge: "PLANNED",
  },
  {
    title: "Validation Rules",
    description: "Explore 317+ deterministic rules across bias, risk, and execution.",
    href: "/docs/rules",
    icon: Shield,
  },
  {
    title: "Financial Metrics",
    description: "Understand performance, risk, and trade statistics calculations.",
    href: "/docs/metrics",
    icon: BarChart3,
  },
  {
    title: "API Reference",
    description: "Integrate QuantLint audits programmatically into your CI/CD pipeline.",
    href: "/docs/api",
    icon: Code2,
    badge: "PLANNED",
  },
  {
    title: "Strategy Examples",
    description: "Browse example quantitative strategies and audit outputs.",
    href: "/docs/examples",
    icon: Blocks,
    badge: "EXAMPLE",
  },
];

function DocsPortalHome() {
  return (
    <div className="space-y-10">
      <div className="space-y-3 border-b border-border/40 pb-8">
        <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          QuantLint Developer Documentation
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Documentation
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed max-w-2xl">
          Validate quantitative trading strategies with deterministic static analysis,
          financial risk metrics, and actionable audit reports.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PORTAL_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <Link key={cat.title} href={cat.href} className="group">
              <Card className="h-full border-border/40 bg-card/40 transition-all hover:bg-card/70 hover:border-border/80">
                <CardHeader className="p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-secondary/50 text-foreground group-hover:text-primary transition-colors">
                      <Icon className="h-4 w-4" />
                    </div>
                    {cat.badge && (
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-border/60 text-muted-foreground">
                        {cat.badge}
                      </span>
                    )}
                  </div>
                  <CardTitle className="text-base group-hover:text-foreground">
                    {cat.title}
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                    {cat.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ── Previous / Next Navigation ───────────────────────────── */

function DocsPagination({ slug }: { slug: string }) {
  const { prev, next } = getDocPagination(slug);

  if (!prev && !next) return null;

  return (
    <div className="flex items-center justify-between border-t border-border/40 pt-6 mt-12 gap-4">
      {prev ? (
        <Link
          href={`/docs/${prev.slug}`}
          className="group flex flex-col items-start gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="flex items-center gap-1 font-mono text-[10px] uppercase text-muted-foreground/70">
            <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-0.5" />
            Previous
          </span>
          <span className="font-semibold text-foreground">{prev.title}</span>
        </Link>
      ) : (
        <div />
      )}

      {next ? (
        <Link
          href={`/docs/${next.slug}`}
          className="group flex flex-col items-end gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors text-right ml-auto"
        >
          <span className="flex items-center gap-1 font-mono text-[10px] uppercase text-muted-foreground/70">
            Next
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </span>
          <span className="font-semibold text-foreground">{next.title}</span>
        </Link>
      ) : (
        <div />
      )}
    </div>
  );
}

/* ── Right-hand Table of Contents ─────────────────────────── */

function TableOfContents({ doc }: { doc: DocPage }) {
  if (!doc.sections || doc.sections.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        On this page
      </p>
      <nav aria-label="Table of contents" className="flex flex-col gap-1.5">
        {doc.sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors line-clamp-1"
          >
            {s.heading}
          </a>
        ))}
      </nav>
    </div>
  );
}

/* ── Catch-All Documentation Page ─────────────────────────── */

export default async function DocsCatchAllPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;

  // Handle bare /docs route -> show portal home
  const isPortalHome = !slug || slug.length === 0;
  const slugPath = isPortalHome ? "getting-started" : slug.join("/");

  const doc = getDocBySlug(slugPath);

  if (!doc && !isPortalHome) {
    return (
      <DocumentationLayout>
        <EmptyState
          icon={FileText}
          title="Documentation Page Not Found"
          description={`The documentation page "/docs/${slugPath}" could not be found.`}
          action={
            <SecondaryButton size="sm" asChild>
              <Link href="/docs">Back to Documentation Home</Link>
            </SecondaryButton>
          }
        />
      </DocumentationLayout>
    );
  }

  // If user requests bare /docs, show Portal Home with full sidebar
  if (isPortalHome) {
    return (
      <DocumentationLayout>
        <DocsPortalHome />
      </DocumentationLayout>
    );
  }

  if (!doc) return null;

  return (
    <DocumentationLayout toc={<TableOfContents doc={doc} />}>
      <article className="space-y-8">
        {/* Header */}
        <div className="space-y-3 border-b border-border/40 pb-6">
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span>Docs</span>
            <span>/</span>
            <span>{doc.category}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {doc.title}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {doc.description}
          </p>
        </div>

        {/* Status Alert if planned/example */}
        <StatusBadge status={doc.status} />

        {/* Sections */}
        <div className="space-y-8">
          {doc.sections.map((section) => (
            <section key={section.id} id={section.id} className="space-y-3 scroll-mt-20">
              <h2 className="text-lg font-semibold tracking-tight text-foreground border-b border-border/20 pb-1.5">
                {section.heading}
              </h2>

              {section.content && (
                <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line space-y-2">
                  {section.content}
                </div>
              )}

              {section.code && (
                <div className="space-y-1.5 pt-1">
                  {section.code.title && (
                    <p className="text-[11px] font-mono text-muted-foreground">
                      {section.code.title}
                    </p>
                  )}
                  <CodeBlock code={section.code.body} />
                </div>
              )}

              {section.note && (
                <p className="text-xs font-mono text-amber-500/90 bg-amber-500/5 border border-amber-500/20 rounded-md p-2.5">
                  Note: {section.note}
                </p>
              )}
            </section>
          ))}
        </div>

        {/* Prev / Next Pagination */}
        <DocsPagination slug={doc.slug} />
      </article>
    </DocumentationLayout>
  );
}
