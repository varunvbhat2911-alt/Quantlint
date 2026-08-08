import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-foreground/10 text-foreground",
        secondary:
          "bg-muted text-muted-foreground",
        outline: "text-muted-foreground border border-border",
        success:
          "bg-emerald-500/8 text-emerald-600 dark:text-emerald-400",
        warning:
          "bg-amber-500/8 text-amber-600 dark:text-amber-400",
        destructive:
          "bg-red-500/8 text-red-600 dark:text-red-400",
        indigo:
          "bg-foreground/5 text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
