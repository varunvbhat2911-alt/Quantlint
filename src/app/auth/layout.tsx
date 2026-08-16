import { QuantLintLogo } from "@/components/common/quantlint-logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex justify-center">
          <QuantLintLogo />
        </div>
        {children}
      </div>
    </div>
  );
}
