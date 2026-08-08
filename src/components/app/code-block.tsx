import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/copy-button";

export function CodeBlock({
  code,
  showCopy = true,
  className,
}: {
  code: string;
  showCopy?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative rounded-xl border border-border/60 bg-code overflow-hidden",
        className
      )}
    >
      <pre className="overflow-x-auto p-4 font-mono text-sm text-code-foreground leading-relaxed">
        <code>{code}</code>
      </pre>
      {showCopy && (
        <CopyButton
          className="absolute top-2 right-2 size-8 rounded-md"
          variant="ghost"
          size="icon"
          text={code}
        />
      )}
    </div>
  );
}
