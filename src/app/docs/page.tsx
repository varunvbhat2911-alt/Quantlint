import { DocumentationLayout } from "@/components/layouts/documentation-layout";
import { PageHeader, SectionHeader } from "@/components/app/page-header";
import { CodeBlock } from "@/components/app/code-block";
import { DOC_SECTIONS, CLI_EXAMPLES } from "@/lib/mock-data/docs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Documentation — QuantLint",
};

export default function DocsPage() {
  return (
    <DocumentationLayout>
      <div className="space-y-12">
        <PageHeader
          title="Documentation"
          subtitle="Everything you need to install, configure, and integrate QuantLint."
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Documentation" },
          ]}
        />

        {DOC_SECTIONS.map((section) => (
          <section key={section.id} id={section.id}>
            <SectionHeader
              title={section.title}
              description={section.description}
            />

            {section.id === "cli" && (
              <div className="space-y-3">
                {CLI_EXAMPLES.map((ex) => (
                  <div key={ex.command} className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">{ex.description}</p>
                    <CodeBlock code={ex.command} />
                  </div>
                ))}
              </div>
            )}

            {section.id === "rules" && (
              <Card className="border-border/40 bg-card/40">
                <CardHeader className="p-5">
                  <CardTitle className="text-sm font-mono">
                    317+ validation rules
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-0 space-y-2 text-xs text-muted-foreground">
                  <p>QL-104 — Look-Ahead Bias Detection</p>
                  <p>QL-087 — Unrealistic Slippage Assumption</p>
                  <p>QL-112 — Position Size Exceeds Limit</p>
                  <p>QL-201 — Unhandled Exception in Signal Path</p>
                  <p>QL-318 — Data Leakage via Future Index</p>
                </CardContent>
              </Card>
            )}

            {section.id === "api" && (
              <CodeBlock
                code={`curl -X POST https://api.quantlint.com/v1/audit \\
  -H "Authorization: Bearer $QUANTLINT_API_KEY" \\
  -F "file=@strategy.py"`}
              />
            )}

            {section.id === "intro" && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                QuantLint performs static AST analysis, deterministic risk engine
                calculations, and AI explainability on strategy code to catch logic
                bugs, look-ahead bias, and unrealistic risk metrics before
                backtesting or deployment.
              </p>
            )}
          </section>
        ))}
      </div>
    </DocumentationLayout>
  );
}
