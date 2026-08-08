import { AppLayout } from "@/components/layouts/app-layout";
import { Sidebar } from "@/components/app/sidebar";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout>
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
            {children}
          </div>
        </main>
      </div>
    </AppLayout>
  );
}
