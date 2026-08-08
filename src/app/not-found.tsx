import { AppLayout } from "@/components/layouts/app-layout";
import { ErrorLayout } from "@/components/layouts/error-layout";

export default function NotFound() {
  return (
    <AppLayout>
      <ErrorLayout
        code="404"
        title="Page Not Found"
        description="The page you're looking for doesn't exist or may have been moved."
      />
    </AppLayout>
  );
}
