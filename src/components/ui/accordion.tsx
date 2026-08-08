"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccordionItemProps {
  value: string;
  title: React.ReactNode;
  children: React.ReactNode;
  isOpen?: boolean;
  onToggle?: () => void;
  className?: string;
}

export function AccordionItem({
  title,
  children,
  isOpen = false,
  onToggle,
  className,
}: AccordionItemProps) {
  return (
    <div className={cn("border-b border-border/80 last:border-b-0", className)}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between py-4 text-left font-medium text-foreground transition-all hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-1"
        aria-expanded={isOpen}
      >
        <span className="text-base font-semibold">{title}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180 text-primary"
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-all duration-200 ease-in-out text-sm text-muted-foreground",
          isOpen
            ? "grid-rows-[1fr] opacity-100 pb-4 pt-1"
            : "grid-rows-[0fr] opacity-0 overflow-hidden"
        )}
      >
        <div className="overflow-hidden leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

interface AccordionProps {
  children: React.ReactNode;
  className?: string;
  allowMultiple?: boolean;
  defaultOpenIndex?: number;
}

export function Accordion({
  children,
  className,
  allowMultiple = false,
  defaultOpenIndex = 0,
}: AccordionProps) {
  const [openItems, setOpenItems] = React.useState<Record<string, boolean>>({
    [`item-${defaultOpenIndex}`]: true,
  });

  const toggleItem = (key: string) => {
    setOpenItems((prev) => {
      if (allowMultiple) {
        return { ...prev, [key]: !prev[key] };
      }
      const isCurrentlyOpen = !!prev[key];
      return isCurrentlyOpen ? {} : { [key]: true };
    });
  };

  return (
    <div className={cn("divide-y divide-border", className)}>
      {React.Children.map(children, (child, index) => {
        if (!React.isValidElement<AccordionItemProps>(child)) return child;
        const itemKey = child.props.value || `item-${index}`;
        return React.cloneElement(child, {
          isOpen: !!openItems[itemKey],
          onToggle: () => toggleItem(itemKey),
        });
      })}
    </div>
  );
}
