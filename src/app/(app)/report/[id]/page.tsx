import { redirect } from "next/navigation";

/* Legacy report route — reports are the audit results themselves. Redirects
 * to the single source of truth (/audit/result?jobId=), which enforces
 * per-user access server-side through the results API + RLS. */
export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/audit/result?jobId=${encodeURIComponent(id)}`);
}
