"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CodeBlockCommand } from "@/components/code-block-command";

export function CtaSection() {
  return (
    <section
      id="documentation"
      className="py-24 md:py-32 border-t border-border/40"
    >
      <div className="mx-auto max-w-7xl px-6 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/50 px-6 py-12 sm:px-12 text-center"
        >
          <div className="mb-8 flex justify-center">
            <Image
              src="/branding/quantlint-artwork-1600.png"
              alt="QuantLint bull and bear brand artwork"
              width={280}
              height={280}
              className="h-44 sm:h-52 w-auto object-contain drop-shadow-md pointer-events-none select-none"
              unoptimized
            />
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Start auditing your strategies today.
          </h2>
          <p className="mt-4 text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Join thousands of quantitative researchers who validate strategy logic
            before committing capital.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" className="rounded-full px-8" asChild>
              <Link href="/audit/new">
                Start Free Audit
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full px-8 border-border/80"
              asChild
            >
              <Link href="/docs">Documentation</Link>
            </Button>
          </div>

          <div className="mt-10 max-w-md mx-auto">
            <div className="relative overflow-hidden rounded-xl border border-border/60 bg-code text-left">
              <CodeBlockCommand
                npm="pip install quantlint"
                pnpm="pip install quantlint"
                yarn="pip install quantlint"
                bun="pip install quantlint"
              />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
