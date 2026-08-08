"use client";

import { LogosCarousel } from "@/components/logos-carousel";
import { cn } from "@/lib/utils";

const TECHNOLOGIES = [
  "Python",
  "Pandas",
  "NumPy",
  "Polars",
  "Backtrader",
  "vectorbt",
  "Zipline",
  "TA-Lib",
];

function TechLogo({ name }: { name: string }) {
  return (
    <div
      className={cn(
        "flex h-12 min-w-[120px] items-center justify-center rounded-lg border border-border/50",
        "bg-card/40 px-5 font-mono text-sm font-medium text-muted-foreground"
      )}
    >
      {name}
    </div>
  );
}

export function LibrariesSection() {
  return (
    <section
      id="libraries"
      className="py-16 md:py-20 border-t border-border/40 overflow-hidden"
    >
      <div className="mx-auto max-w-7xl px-6 sm:px-8">
        <div className="mx-auto max-w-3xl text-center mb-12">
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">
            Ecosystem
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Supported libraries
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Native analysis for the Python quantitative stack.
          </p>
        </div>

        <LogosCarousel columnCount={4} direction="ltr" className="max-w-4xl mx-auto gap-4">
          {TECHNOLOGIES.map((tech) => (
            <TechLogo key={tech} name={tech} />
          ))}
        </LogosCarousel>
      </div>
    </section>
  );
}
