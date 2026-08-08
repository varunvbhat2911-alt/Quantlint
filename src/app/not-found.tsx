import { ErrorLayout } from "@/components/layouts/error-layout";

export default function NotFound() {
  return (
    <ErrorLayout
      code="404"
      title="Page not found"
      description="The page you're looking for doesn't exist or has been moved."
    />
  );
}
