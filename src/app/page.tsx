import { Navbar } from "@/components/landing/navbar";
import { HeroSection } from "@/components/landing/hero-section";
import { LibrariesSection } from "@/components/landing/libraries-section";
import { MetricsSection } from "@/components/landing/metrics-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { WorkflowSection } from "@/components/landing/workflow-section";
import { AuditDemoSection } from "@/components/landing/audit-demo-section";
import { TestimonialsSection } from "@/components/landing/testimonials-section";
import { FaqSection } from "@/components/landing/faq-section";
import { CtaSection } from "@/components/landing/cta-section";
import { FooterSection } from "@/components/landing/footer-section";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1 scroll-smooth">
        <HeroSection />
        <LibrariesSection />
        <MetricsSection />
        <FeaturesSection />
        <WorkflowSection />
        <AuditDemoSection />
        <TestimonialsSection />
        <FaqSection />
        <CtaSection />
      </main>
      <FooterSection />
    </>
  );
}
