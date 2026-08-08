import { AppNavbar } from "@/components/app/navbar";
import { AppFooter } from "@/components/app/footer";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <AppNavbar />
      <div className="flex flex-1 flex-col">{children}</div>
      <AppFooter />
    </div>
  );
}
