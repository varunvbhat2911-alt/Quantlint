"use client";

import * as React from "react";
import NumberFlow from "@number-flow/react";
import { motion } from "framer-motion";
import { Metric, MetricLabel, MetricValue } from "@/components/metric";

const METRICS = [
  { label: "Validation Rules", value: 317, suffix: "+" },
  { label: "Detection Accuracy", value: 98.7, suffix: "%", decimals: 1 },
  { label: "Average Audit Time", value: 2.1, suffix: " sec", decimals: 1 },
  { label: "Strategies Audited", value: 12000, suffix: "+" },
];

function AnimatedMetric({
  value,
  suffix = "",
  decimals = 0,
}: {
  value: number;
  suffix?: string;
  decimals?: number;
}) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <span className="tabular-nums">
        {value.toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}
        {suffix}
      </span>
    );
  }

  return (
    <NumberFlow
      value={value}
      format={{
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }}
      suffix={suffix}
    />
  );
}

export function MetricsSection() {
  return (
    <section id="metrics" className="py-16 md:py-24 border-t border-border/40">
      <div className="mx-auto max-w-7xl px-6 sm:px-8">
        <div className="screen-line-top screen-line-bottom border-x border-line">
          <div className="relative">
            <div className="pointer-events-none absolute inset-0 -z-1 grid grid-cols-2 md:grid-cols-4">
              <div className="border-r border-line" />
              <div className="border-r border-line max-md:hidden" />
              <div className="border-r border-line max-md:hidden" />
            </div>

            <motion.dl
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="grid grid-cols-2 md:grid-cols-4"
            >
              {METRICS.map((metric) => (
                <Metric key={metric.label}>
                  <MetricLabel>{metric.label}</MetricLabel>
                  <MetricValue className="text-2xl md:text-3xl">
                    <AnimatedMetric
                      value={metric.value}
                      suffix={metric.suffix}
                      decimals={metric.decimals}
                    />
                  </MetricValue>
                </Metric>
              ))}
            </motion.dl>
          </div>
        </div>
      </div>
    </section>
  );
}
