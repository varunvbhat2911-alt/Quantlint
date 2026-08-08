import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";

export function PrimaryButton({
  className,
  asChild,
  ...props
}: ButtonProps) {
  return (
    <Button
      className={cn("rounded-full text-sm font-medium font-mono", className)}
      asChild={asChild}
      {...props}
    />
  );
}

export function SecondaryButton({
  className,
  asChild,
  ...props
}: ButtonProps) {
  return (
    <Button
      variant="outline"
      className={cn(
        "rounded-full text-sm font-medium font-mono border-border/80",
        className
      )}
      asChild={asChild}
      {...props}
    />
  );
}

export type ButtonLinkProps = ButtonProps & {
  href: string;
};

export function PrimaryButtonLink({
  href,
  children,
  className,
  ...props
}: Omit<ButtonLinkProps, "asChild">) {
  return (
    <PrimaryButton asChild className={className} {...props}>
      <a href={href}>{children}</a>
    </PrimaryButton>
  );
}
