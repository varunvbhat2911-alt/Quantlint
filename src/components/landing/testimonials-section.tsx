"use client";

import {
  Marquee,
  MarqueeContent,
  MarqueeFade,
  MarqueeItem,
} from "@/components/kibo-ui/marquee";
import {
  Testimonial,
  TestimonialQuote,
  TestimonialAuthor,
  TestimonialAvatar,
  TestimonialAuthorName,
  TestimonialAuthorTagline,
} from "@/components/testimonial";
import { cn } from "@/lib/utils";

const TESTIMONIALS = [
  {
    role: "Quant Researcher",
    quote:
      "Detected a subtle look-ahead bias that slipped through our manual review.",
    initials: "QR",
  },
  {
    role: "Algorithmic Trader",
    quote:
      "The audit report saved hours of debugging before deployment.",
    initials: "AT",
  },
  {
    role: "Data Scientist",
    quote:
      "The deterministic rule engine makes strategy validation significantly more reliable.",
    initials: "DS",
  },
];

function TestimonialCard({
  role,
  quote,
  initials,
}: {
  role: string;
  quote: string;
  initials: string;
}) {
  return (
    <Testimonial
      className={cn(
        "w-[320px] shrink-0 rounded-xl border border-border/50 bg-card/40",
        "screen-line-top screen-line-bottom"
      )}
    >
      <TestimonialQuote className="text-sm leading-relaxed">
        &ldquo;{quote}&rdquo;
      </TestimonialQuote>
      <TestimonialAuthor>
        <TestimonialAvatar>
          <div
            className={cn(
              "flex size-8 items-center justify-center rounded-full",
              "border border-border/60 bg-secondary/60",
              "text-[10px] font-mono font-medium text-muted-foreground"
            )}
          >
            {initials}
          </div>
        </TestimonialAvatar>
        <TestimonialAuthorName>{role}</TestimonialAuthorName>
        <TestimonialAuthorTagline>QuantLint user</TestimonialAuthorTagline>
      </TestimonialAuthor>
    </Testimonial>
  );
}

export function TestimonialsSection() {
  return (
    <section
      id="testimonials"
      className="py-24 md:py-32 border-t border-border/40 overflow-hidden"
    >
      <div className="mx-auto max-w-7xl px-6 sm:px-8 mb-12">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">
            Testimonials
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Trusted by quantitative teams.
          </h2>
        </div>
      </div>

      <Marquee className="py-2">
        <MarqueeFade side="left" />
        <MarqueeFade side="right" />
        <MarqueeContent speed={30} pauseOnHover>
          {TESTIMONIALS.map((item) => (
            <MarqueeItem key={item.role}>
              <TestimonialCard {...item} />
            </MarqueeItem>
          ))}
          {TESTIMONIALS.map((item) => (
            <MarqueeItem key={`${item.role}-dup`}>
              <TestimonialCard {...item} />
            </MarqueeItem>
          ))}
        </MarqueeContent>
      </Marquee>
    </section>
  );
}
